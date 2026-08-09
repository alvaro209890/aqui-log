/**
 * `DISP-01` — reoferta resiliente por anéis de raio (plano §6.1, `DEC-03`).
 *
 * Tudo aqui é puro: recebe candidatos, configuração e o "agora" por parâmetro.
 * A regra de reoferta é exatamente o tipo de código que quebra em produção por
 * causa de relógio e de banco, então ela vive fora dos dois.
 *
 * Vocabulário:
 *
 * - **rodada** (`round`): uma tentativa de oferta que de fato existiu. Uma
 *   rodada só é consumida quando uma oferta é criada — anel vazio não gasta
 *   rodada, senão o job (que roda a cada 10 s) queimaria o limite em menos de
 *   um minuto enquanto ninguém está online;
 * - **anel** (`ring`): a faixa de raio da rodada. O anel `n` tem raio
 *   `inicial + (n - 1) × incremento`. Anel e rodada andam juntos: a rodada 3
 *   usa o anel 3;
 * - **duração total**: o tempo máximo do ciclo inteiro, contado do primeiro
 *   despacho. É ele que impede o loop infinito quando não há ninguém para
 *   receber a oferta e nenhuma rodada é consumida.
 *
 * `DEC-03` proíbe aumento silencioso de preço. Aqui não existe preço: a
 * reoferta usa o snapshot congelado do pedido (`DEC-19`) e nada recalcula. A
 * rodada com preço maior, mediante consentimento explícito, é `DISP-02`.
 */

const MINUTE_MS = 60_000;

/** Tolerância de borda do anel — 1 m. Evita perder o candidato exatamente no raio. */
const RADIUS_EPSILON_KM = 0.001;

/**
 * Motivo de término do ciclo de reoferta de um pedido.
 *
 * Recusa e expiração **não** aparecem aqui de propósito: elas encerram uma
 * rodada, não o ciclo — o status da própria oferta (`delivery_offers.status`)
 * é quem guarda o desfecho de cada rodada. O que esta lista responde é
 * "por que o sistema parou de tentar".
 */
export const DISPATCH_END_REASONS = [
  /** Alguém aceitou. */
  'ACCEPTED',
  /** Acabaram as rodadas configuradas (a última terminou em recusa/expiração). */
  'MAX_ROUNDS',
  /** A duração total acabou depois de ao menos uma oferta feita. */
  'TIMEBOX',
  /** A duração total acabou sem nunca haver candidato em nenhum anel. */
  'NO_CANDIDATE',
  /** O pedido foi cancelado no meio do ciclo. */
  'CANCELED',
] as const;

export type DispatchEndReason = (typeof DISPATCH_END_REASONS)[number];

/** Estados em que o ciclo parou sozinho e o cliente precisa agir (plano §6.1.5). */
export const RECOVERABLE_END_REASONS: readonly DispatchEndReason[] = [
  'MAX_ROUNDS',
  'TIMEBOX',
  'NO_CANDIDATE',
];

export type DispatchRingConfig = {
  /** Raio do primeiro anel, em km. */
  initialRadiusKm: number;
  /** Quanto cada anel seguinte acrescenta, em km. */
  ringIncrementKm: number;
  /** Máximo de rodadas (ofertas efetivas) por pedido. */
  maxRounds: number;
  /** Duração total do ciclo, do primeiro despacho ao último. */
  totalDurationMinutes: number;
};

export type DispatchCandidate = {
  courierId: string;
  distanceKm: number;
};

export type RingSelection = {
  /** Rodada/anel escolhido, 1-based. */
  round: number;
  radiusKm: number;
  courierId: string;
  /** Quantos candidatos não tentados cabiam neste anel. */
  eligibleCount: number;
};

/** Raio do anel `round` (1-based). */
export function ringRadiusKm(
  round: number,
  config: DispatchRingConfig,
): number {
  const ring = Math.max(1, Math.trunc(round));
  const radius =
    config.initialRadiusKm + (ring - 1) * Math.max(0, config.ringIncrementKm);
  return Number(radius.toFixed(3));
}

/** Raio do último anel permitido pela configuração. */
export function maxRadiusKm(config: DispatchRingConfig): number {
  return ringRadiusKm(config.maxRounds, config);
}

/**
 * Escolhe o candidato da próxima rodada.
 *
 * Começa no anel `fromRound` e vai ampliando até achar alguém ou esgotar as
 * rodadas. Ampliar dentro da mesma chamada é deliberado: se ninguém está no
 * anel 1, esperar 10 s pelo próximo tick para tentar o anel 2 só faz o cliente
 * esperar sem motivo. O que a rodada registra é o anel **efetivamente usado**.
 *
 * `candidates` já deve vir sem quem foi tentado (recusa/expiração) e sem quem
 * não tem agenda livre — a exclusão é responsabilidade de quem consulta o
 * banco; aqui só se decide raio e vencedor.
 */
export function selectRingCandidate(
  candidates: readonly DispatchCandidate[],
  config: DispatchRingConfig,
  fromRound: number,
): RingSelection | null {
  const first = Math.max(1, Math.trunc(fromRound));
  for (let round = first; round <= config.maxRounds; round += 1) {
    const radiusKm = ringRadiusKm(round, config);
    const inRing = candidates.filter(
      (candidate) => candidate.distanceKm <= radiusKm + RADIUS_EPSILON_KM,
    );
    if (!inRing.length) continue;
    const nearest = [...inRing].sort((a, b) => a.distanceKm - b.distanceKm)[0];
    return {
      round,
      radiusKm,
      courierId: nearest.courierId,
      eligibleCount: inRing.length,
    };
  }
  return null;
}

/** A duração total do ciclo já passou? `startedAt` nulo = ciclo ainda não começou. */
export function dispatchTimeboxExhausted(
  startedAt: Date | null | undefined,
  now: Date,
  config: DispatchRingConfig,
): boolean {
  if (!startedAt) return false;
  const elapsedMinutes =
    (now.getTime() - new Date(startedAt).getTime()) / MINUTE_MS;
  return elapsedMinutes >= config.totalDurationMinutes;
}

/** Rodadas já consumidas (pedido legado, sem a coluna preenchida, vale 0). */
export function roundsUsed(delivery: {
  dispatchRound?: number | null;
}): number {
  return Math.max(0, delivery.dispatchRound ?? 0);
}

/** Ainda cabe rodada nova? */
export function hasRoundsLeft(
  delivery: { dispatchRound?: number | null },
  config: DispatchRingConfig,
): boolean {
  return roundsUsed(delivery) < config.maxRounds;
}

/**
 * Motivo de término quando o relógio estourou: quem nunca conseguiu ofertar
 * parou por falta de candidato, não por tempo — e essa diferença é o dado que
 * o `DISP-03` vai querer contar.
 */
export function timeboxEndReason(delivery: {
  dispatchRound?: number | null;
}): DispatchEndReason {
  return roundsUsed(delivery) > 0 ? 'TIMEBOX' : 'NO_CANDIDATE';
}

/**
 * O ciclo deve recomeçar porque a janela do agendado chegou?
 *
 * Um agendado é ofertado na criação (`DEC-20`, aceite antecipado). Se ninguém
 * aceitou naquela hora, o ciclo termina — mas quando a janela finalmente abre a
 * situação é outra: outros motoboys estão online, e insistir é legítimo. Sem
 * isso, um agendado feito com um dia de antecedência morreria 20 minutos depois
 * de criado.
 *
 * A condição é auto-idempotente: depois do reinício, `dispatchStartedAt` passa
 * a ser posterior ao início da janela e a resposta vira `false`. Por isso o job
 * pode chamá-la a cada 10 s sem reiniciar o ciclo em looping.
 */
export function shouldReopenForWindow(
  delivery: {
    dispatchStartedAt?: Date | null;
    pickupWindowStart?: Date | null;
  },
  now: Date,
): boolean {
  if (!delivery.pickupWindowStart) return false;
  const windowStart = new Date(delivery.pickupWindowStart).getTime();
  if (now.getTime() < windowStart) return false;
  if (!delivery.dispatchStartedAt) return false;
  return new Date(delivery.dispatchStartedAt).getTime() < windowStart;
}

/** Frase curta do término, para evento e notificação. */
export function describeEndReason(reason: DispatchEndReason): string {
  switch (reason) {
    case 'ACCEPTED':
      return 'oferta aceita';
    case 'MAX_ROUNDS':
      return 'limite de rodadas de reoferta atingido';
    case 'TIMEBOX':
      return 'duracao total da reoferta esgotada';
    case 'NO_CANDIDATE':
      return 'nenhum entregador elegivel no periodo';
    case 'CANCELED':
      return 'pedido cancelado';
  }
}
