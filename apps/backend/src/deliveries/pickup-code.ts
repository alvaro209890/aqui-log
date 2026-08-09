import { randomInt } from 'crypto';

/**
 * PICK-01 / `FLOW-DEC-03` — regras puras do código de recolhimento.
 *
 * Ficam separadas do service para serem testáveis sem banco: geração, formato,
 * comparação e a política de tentativa/bloqueio.
 */

/** `FLOW-DEC-03`: 4 dígitos numéricos. Não é, e não deriva do, código `AQL-*`. */
export const PICKUP_CODE_LENGTH = 4;

/** `FLOW-DEC-03`: bloqueio temporário a partir da 5ª tentativa errada. */
export const PICKUP_CODE_MAX_ATTEMPTS = 5;

/** Duração do bloqueio temporário. Temporário de propósito: o fallback de
 * `DEC-24` é humano (admin/suporte), não pode virar o caminho normal. */
export const PICKUP_CODE_BLOCK_MINUTES = 15;

const PICKUP_CODE_RE = /^\d{4}$/;

/**
 * Gera o código com `crypto.randomInt` (CSPRNG). `Math.random` seria previsível
 * o bastante para adivinhar 4 dígitos em lote, e o espaço já é pequeno.
 */
export function generatePickupCode(): string {
  return String(randomInt(0, 10 ** PICKUP_CODE_LENGTH)).padStart(
    PICKUP_CODE_LENGTH,
    '0',
  );
}

/** Normaliza o que o app mandou: espaços e traços digitados não invalidam. */
export function normalizePickupCode(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\s-]/g, '');
}

export function isValidPickupCodeFormat(raw: string | null | undefined) {
  return PICKUP_CODE_RE.test(normalizePickupCode(raw));
}

/**
 * Comparação em tempo constante no comprimento fixo do código. Com 4 dígitos o
 * ganho é pequeno, mas é barato e evita um canal lateral gratuito.
 */
export function pickupCodeMatches(
  expected: string,
  provided: string | null | undefined,
) {
  const candidate = normalizePickupCode(provided);
  if (candidate.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ candidate.charCodeAt(i);
  }
  return diff === 0;
}

export type PickupCodeState = {
  attempts: number;
  blockedUntil: Date | null;
};

export type PickupCodeFailure = {
  attempts: number;
  blockedUntil: Date | null;
  attemptsLeft: number;
  /** Virou bloqueio agora (dispara alerta/auditoria uma única vez). */
  blockedNow: boolean;
};

export function isPickupCodeBlocked(
  state: PickupCodeState,
  now: Date = new Date(),
) {
  return (
    state.blockedUntil !== null && state.blockedUntil.getTime() > now.getTime()
  );
}

/** Segundos restantes de bloqueio, arredondados para cima (nunca negativo). */
export function pickupCodeBlockSecondsLeft(
  state: PickupCodeState,
  now: Date = new Date(),
) {
  if (!isPickupCodeBlocked(state, now)) return 0;
  return Math.ceil((state.blockedUntil!.getTime() - now.getTime()) / 1000);
}

/**
 * Aplica uma tentativa errada. Ao atingir `PICKUP_CODE_MAX_ATTEMPTS`, bloqueia
 * e zera o contador — o bloqueio é a punição; recontar do zero deixa o próximo
 * ciclo com as mesmas 5 chances, e não com uma só.
 */
export function registerPickupCodeFailure(
  state: PickupCodeState,
  now: Date = new Date(),
): PickupCodeFailure {
  const attempts = state.attempts + 1;
  if (attempts >= PICKUP_CODE_MAX_ATTEMPTS) {
    return {
      attempts: 0,
      blockedUntil: new Date(
        now.getTime() + PICKUP_CODE_BLOCK_MINUTES * 60_000,
      ),
      attemptsLeft: 0,
      blockedNow: true,
    };
  }
  return {
    attempts,
    blockedUntil: null,
    attemptsLeft: PICKUP_CODE_MAX_ATTEMPTS - attempts,
    blockedNow: false,
  };
}
