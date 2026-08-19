import { DeliveryStatus } from '../database/enums';
import {
  DEFAULT_COURIER_CANCEL_CUTOFFS,
  courierCancelDeadline,
  evaluateCourierCancel,
} from './courier-cancel';

const NOW = new Date('2026-08-19T15:00:00.000Z');

describe('COUR-02 — janela de cancelamento do prestador', () => {
  it('imediato: permitido até acceptedAt + cutoff (5 min)', () => {
    const acceptedAt = new Date('2026-08-19T14:56:00.000Z');
    const deadline = courierCancelDeadline(
      {
        status: DeliveryStatus.ACCEPTED,
        fulfillmentMode: 'IMMEDIATE',
        acceptedAt,
      },
      DEFAULT_COURIER_CANCEL_CUTOFFS,
    );
    expect(deadline?.toISOString()).toBe('2026-08-19T15:01:00.000Z');
    expect(
      evaluateCourierCancel(
        {
          status: DeliveryStatus.ACCEPTED,
          fulfillmentMode: 'IMMEDIATE',
          acceptedAt,
        },
        DEFAULT_COURIER_CANCEL_CUTOFFS,
        NOW,
      ).allowed,
    ).toBe(true);
  });

  it('imediato: recusa depois do cutoff', () => {
    const verdict = evaluateCourierCancel(
      {
        status: DeliveryStatus.ACCEPTED,
        fulfillmentMode: 'IMMEDIATE',
        acceptedAt: new Date('2026-08-19T14:50:00.000Z'),
      },
      DEFAULT_COURIER_CANCEL_CUTOFFS,
      NOW,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/Fora do prazo/);
  });

  it('agendado: permitido até pickupWindowStart − 60 min', () => {
    const start = new Date('2026-08-19T17:00:00.000Z');
    const deadline = courierCancelDeadline({
      status: DeliveryStatus.ACCEPTED,
      fulfillmentMode: 'SCHEDULED',
      pickupWindowStart: start,
      acceptedAt: new Date('2026-08-19T12:00:00.000Z'),
    });
    expect(deadline?.toISOString()).toBe('2026-08-19T16:00:00.000Z');
    expect(
      evaluateCourierCancel(
        {
          status: DeliveryStatus.ACCEPTED,
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: start,
          acceptedAt: new Date('2026-08-19T12:00:00.000Z'),
        },
        DEFAULT_COURIER_CANCEL_CUTOFFS,
        NOW,
      ).allowed,
    ).toBe(true);
  });

  it('agendado aceito perto demais da janela: recusa (cutoff já passou)', () => {
    const verdict = evaluateCourierCancel(
      {
        status: DeliveryStatus.ACCEPTED,
        fulfillmentMode: 'SCHEDULED',
        pickupWindowStart: new Date('2026-08-19T15:45:00.000Z'),
        acceptedAt: NOW,
      },
      DEFAULT_COURIER_CANCEL_CUTOFFS,
      NOW,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/Fora do prazo/);
  });

  it('depois da coleta (AT_PICKUP e além) recusa, mesmo no relógio', () => {
    const acceptedAt = new Date('2026-08-19T14:59:00.000Z');
    for (const status of [
      DeliveryStatus.AT_PICKUP,
      DeliveryStatus.PICKED_UP,
      DeliveryStatus.IN_TRANSIT,
      DeliveryStatus.DELIVERED,
      DeliveryStatus.CANCELED,
      DeliveryStatus.REQUESTED,
    ]) {
      const verdict = evaluateCourierCancel(
        { status, fulfillmentMode: 'IMMEDIATE', acceptedAt },
        DEFAULT_COURIER_CANCEL_CUTOFFS,
        NOW,
      );
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toMatch(/antes da coleta/);
    }
  });

  it('imediato sem acceptedAt nao tem prazo calculavel', () => {
    const verdict = evaluateCourierCancel(
      { status: DeliveryStatus.ACCEPTED, fulfillmentMode: 'IMMEDIATE' },
      DEFAULT_COURIER_CANCEL_CUTOFFS,
      NOW,
    );
    expect(verdict.allowed).toBe(false);
    expect(verdict.deadline).toBeNull();
  });
});
