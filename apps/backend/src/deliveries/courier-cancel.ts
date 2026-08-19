/**
 * COUR-02 / DEC-22 — janela em que o prestador pode desistir da corrida.
 *
 * A taxa é outra coisa (congelada no aceite, debitada no ledger). Aqui só o
 * relógio: status `ACCEPTED` e agora ainda dentro do cutoff.
 *
 * Leitura do plano §6.1 + FLOW-DEC-01:
 * - imediato: do aceite até `acceptedAt + courier_cancel_cutoff_minutes_immediate`
 *   (provisório 5 min). A fórmula "âncora − cutoff" do plano só fecha no
 *   agendado; no imediato a âncora É o aceite, então o cutoff é uma janela
 *   DEPOIS dele — senão o cancelamento imediato seria impossível.
 * - agendado: até `pickupWindowStart - courier_cancel_cutoff_minutes_scheduled`
 *   (provisório 60 min antes da janela).
 */

export interface CourierCancelCutoffs {
  immediateMinutes: number;
  scheduledMinutes: number;
}

/** Provisórios de `FLOW-DEC-01` / `DEC-02`, iguais ao default das settings. */
export const DEFAULT_COURIER_CANCEL_CUTOFFS: CourierCancelCutoffs = {
  immediateMinutes: 5,
  scheduledMinutes: 60,
};

export interface CourierCancelInput {
  status: string;
  fulfillmentMode?: string | null;
  acceptedAt?: Date | string | null;
  pickupWindowStart?: Date | string | null;
}

export interface CourierCancelVerdict {
  allowed: boolean;
  deadline: Date | null;
  reason: string | null;
}

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function isScheduledMode(mode: string | null | undefined): boolean {
  return (mode ?? 'IMMEDIATE').toUpperCase() === 'SCHEDULED';
}

/**
 * Instante-limite (exclusivo): `now >= deadline` já está fora.
 * Nulo quando falta âncora (aceite ou janela) — o serviço recusa.
 */
export function courierCancelDeadline(
  delivery: CourierCancelInput,
  cutoffs: CourierCancelCutoffs = DEFAULT_COURIER_CANCEL_CUTOFFS,
): Date | null {
  if (isScheduledMode(delivery.fulfillmentMode)) {
    const start = asDate(delivery.pickupWindowStart ?? null);
    if (!start) return null;
    return addMinutes(start, -cutoffs.scheduledMinutes);
  }
  const acceptedAt = asDate(delivery.acceptedAt ?? null);
  if (!acceptedAt) return null;
  return addMinutes(acceptedAt, cutoffs.immediateMinutes);
}

export function evaluateCourierCancel(
  delivery: CourierCancelInput,
  cutoffs: CourierCancelCutoffs = DEFAULT_COURIER_CANCEL_CUTOFFS,
  now: Date = new Date(),
): CourierCancelVerdict {
  if (delivery.status !== 'ACCEPTED') {
    return {
      allowed: false,
      deadline: courierCancelDeadline(delivery, cutoffs),
      reason:
        'Cancelamento do prestador so vale antes da coleta (status ACCEPTED)',
    };
  }
  const deadline = courierCancelDeadline(delivery, cutoffs);
  if (!deadline) {
    return {
      allowed: false,
      deadline: null,
      reason: 'Nao foi possivel calcular o prazo de cancelamento desta corrida',
    };
  }
  if (now.getTime() >= deadline.getTime()) {
    return {
      allowed: false,
      deadline,
      reason: 'Fora do prazo de cancelamento; so suporte pode redespachar',
    };
  }
  return { allowed: true, deadline, reason: null };
}
