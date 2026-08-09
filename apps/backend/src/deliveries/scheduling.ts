import { BadRequestException } from '@nestjs/common';
import type { FulfillmentMode } from '../pricing/pricing.types';

/**
 * SCHED-01 — regras do modo agendado (`DEC-18`, `DEC-20`, `FLOW-DEC-02`).
 *
 * Tudo aqui é puro: recebe o "agora" por parâmetro e devolve datas ou lança
 * `BadRequestException`. Assim a regra de janela é testável sem banco, sem
 * relógio e sem HTTP — que é onde ela costuma quebrar.
 *
 * Persistência em UTC; a janela é escolhida pelo cliente no fuso dele e chega
 * como ISO 8601 com offset. Nada aqui interpreta fuso: `Date` já resolve.
 */

/** Janela mais curta que faz sentido operacionalmente. */
export const SCHEDULE_MIN_WINDOW_MINUTES = 15;

/**
 * Horizonte máximo do agendamento. Não é `DEC-*` nem settings: é um limite de
 * sanidade para recusar "coleta em 2049" e proteger a fila de ofertas. Se o
 * dono quiser calibrar, vira campo no admin em um pacote próprio.
 */
export const SCHEDULE_MAX_HORIZON_DAYS = 30;

const MINUTE_MS = 60_000;

export type ScheduleLimits = {
  /** `FLOW-DEC-02`: antecedência mínima entre agora e o início da janela. */
  minLeadMinutes: number;
  /** Duração máxima da janela de coleta. */
  maxWindowMinutes: number;
};

export type ScheduleWindowInput = {
  fulfillmentMode: FulfillmentMode;
  pickupWindowStart?: string | null;
  pickupWindowEnd?: string | null;
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
};

export type ResolvedSchedule = {
  pickupWindowStart: Date | null;
  pickupWindowEnd: Date | null;
  deliveryWindowStart: Date | null;
  deliveryWindowEnd: Date | null;
};

const EMPTY: ResolvedSchedule = {
  pickupWindowStart: null,
  pickupWindowEnd: null,
  deliveryWindowStart: null,
  deliveryWindowEnd: null,
};

function parseInstant(raw: string | null | undefined, label: string): Date {
  const value = new Date(String(raw));
  if (Number.isNaN(value.getTime())) {
    throw new BadRequestException(`${label} invalida. Use data e hora ISO.`);
  }
  return value;
}

function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MINUTE_MS;
}

/**
 * Valida e normaliza as janelas de um pedido.
 *
 * `IMMEDIATE` não aceita janela: se o cliente mandou uma, ou ele errou o modo
 * ou o app está desalinhado — nos dois casos aceitar em silêncio produziria um
 * pedido que ninguém sabe quando executar.
 */
export function resolveSchedule(
  input: ScheduleWindowInput,
  limits: ScheduleLimits,
  now: Date,
): ResolvedSchedule {
  const hasAnyWindow = [
    input.pickupWindowStart,
    input.pickupWindowEnd,
    input.deliveryWindowStart,
    input.deliveryWindowEnd,
  ].some((value) => value != null && value !== '');

  if (input.fulfillmentMode !== 'SCHEDULED') {
    if (hasAnyWindow) {
      throw new BadRequestException(
        'Janela de coleta só vale no modo agendado (SCHEDULED).',
      );
    }
    return { ...EMPTY };
  }

  if (!input.pickupWindowStart || !input.pickupWindowEnd) {
    throw new BadRequestException(
      'Pedido agendado exige início e fim da janela de coleta.',
    );
  }

  const pickupWindowStart = parseInstant(
    input.pickupWindowStart,
    'Janela de coleta',
  );
  const pickupWindowEnd = parseInstant(
    input.pickupWindowEnd,
    'Janela de coleta',
  );

  const leadMinutes = minutesBetween(now, pickupWindowStart);
  if (leadMinutes < limits.minLeadMinutes) {
    throw new BadRequestException(
      `A coleta agendada precisa começar ao menos ${limits.minLeadMinutes} minutos à frente (FLOW-DEC-02).`,
    );
  }
  if (leadMinutes > SCHEDULE_MAX_HORIZON_DAYS * 24 * 60) {
    throw new BadRequestException(
      `A coleta agendada não pode passar de ${SCHEDULE_MAX_HORIZON_DAYS} dias.`,
    );
  }

  const windowMinutes = minutesBetween(pickupWindowStart, pickupWindowEnd);
  if (windowMinutes <= 0) {
    throw new BadRequestException(
      'O fim da janela de coleta precisa ser depois do início.',
    );
  }
  if (windowMinutes < SCHEDULE_MIN_WINDOW_MINUTES) {
    throw new BadRequestException(
      `A janela de coleta precisa ter ao menos ${SCHEDULE_MIN_WINDOW_MINUTES} minutos.`,
    );
  }
  if (windowMinutes > limits.maxWindowMinutes) {
    throw new BadRequestException(
      `A janela de coleta não pode passar de ${limits.maxWindowMinutes} minutos.`,
    );
  }

  // Janela de entrega é opcional (plano §3.1). Se vier, vem inteira.
  const wantsDeliveryWindow =
    (input.deliveryWindowStart != null && input.deliveryWindowStart !== '') ||
    (input.deliveryWindowEnd != null && input.deliveryWindowEnd !== '');
  if (!wantsDeliveryWindow) {
    return {
      pickupWindowStart,
      pickupWindowEnd,
      deliveryWindowStart: null,
      deliveryWindowEnd: null,
    };
  }
  if (!input.deliveryWindowStart || !input.deliveryWindowEnd) {
    throw new BadRequestException(
      'Informe início e fim da janela de entrega, ou nenhum dos dois.',
    );
  }
  const deliveryWindowStart = parseInstant(
    input.deliveryWindowStart,
    'Janela de entrega',
  );
  const deliveryWindowEnd = parseInstant(
    input.deliveryWindowEnd,
    'Janela de entrega',
  );
  if (deliveryWindowEnd.getTime() <= deliveryWindowStart.getTime()) {
    throw new BadRequestException(
      'O fim da janela de entrega precisa ser depois do início.',
    );
  }
  if (deliveryWindowStart.getTime() < pickupWindowStart.getTime()) {
    throw new BadRequestException(
      'A entrega não pode ser agendada antes do início da coleta.',
    );
  }

  return {
    pickupWindowStart,
    pickupWindowEnd,
    deliveryWindowStart,
    deliveryWindowEnd,
  };
}

export type TimeWindow = { start: Date; end: Date };

/**
 * Janela que um pedido ocupa na agenda do prestador.
 *
 * `IMMEDIATE` não tem janela declarada, então usamos uma estimativa de execução
 * a partir de agora — provisória e configurável no admin
 * (`immediateExecutionEstimateMinutes`).
 */
export function executionWindow(
  delivery: {
    fulfillmentMode?: string | null;
    pickupWindowStart?: Date | null;
    pickupWindowEnd?: Date | null;
  },
  now: Date,
  immediateEstimateMinutes: number,
): TimeWindow {
  if (
    delivery.fulfillmentMode === 'SCHEDULED' &&
    delivery.pickupWindowStart &&
    delivery.pickupWindowEnd
  ) {
    return {
      start: new Date(delivery.pickupWindowStart),
      end: new Date(delivery.pickupWindowEnd),
    };
  }
  return {
    start: now,
    end: new Date(now.getTime() + immediateEstimateMinutes * MINUTE_MS),
  };
}

/** Sobreposição de janelas com folga dos dois lados (plano §5.1). */
export function windowsCollide(
  a: TimeWindow,
  b: TimeWindow,
  slackMinutes: number,
): boolean {
  const slack = Math.max(0, slackMinutes) * MINUTE_MS;
  return (
    a.start.getTime() < b.end.getTime() + slack &&
    b.start.getTime() < a.end.getTime() + slack
  );
}

/**
 * Plano §5.1 — o prestador que já reservou uma janela não recebe oferta cuja
 * execução colida com ela. Sem isso o aceite antecipado do `DEC-20` viraria
 * uma promessa que o prestador não tem como cumprir.
 */
export function hasCapacityConflict(
  candidate: TimeWindow,
  reserved: TimeWindow[],
  slackMinutes: number,
): boolean {
  return reserved.some((window) =>
    windowsCollide(candidate, window, slackMinutes),
  );
}

/**
 * `DEC-20` — depois do aceite antecipado o pedido fica na agenda; a execução só
 * "abre" quando a janela começa. Antes disso, `ACCEPTED → AT_PICKUP` é recusada.
 */
export function scheduleExecutionOpen(
  delivery: {
    fulfillmentMode?: string | null;
    pickupWindowStart?: Date | null;
  },
  now: Date,
): boolean {
  if (delivery.fulfillmentMode !== 'SCHEDULED') return true;
  if (!delivery.pickupWindowStart) return true;
  return new Date(delivery.pickupWindowStart).getTime() <= now.getTime();
}

/** Agendado aceito cuja janela ainda não começou (fica na Agenda, não em execução). */
export function isReservedAhead(
  delivery: {
    fulfillmentMode?: string | null;
    pickupWindowStart?: Date | null;
  },
  now: Date,
): boolean {
  return !scheduleExecutionOpen(delivery, now);
}
