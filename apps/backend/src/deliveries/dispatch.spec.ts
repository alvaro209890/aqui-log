import {
  DISPATCH_END_REASONS,
  RECOVERABLE_END_REASONS,
  describeEndReason,
  dispatchTimeboxExhausted,
  firstWarningDue,
  hasRoundsLeft,
  maxRadiusKm,
  priceBoostProposal,
  ringRadiusKm,
  roundsUsed,
  selectRingCandidate,
  shouldReopenForWindow,
  timeboxEndReason,
  type DispatchRingConfig,
} from './dispatch';

/**
 * DISP-01 — a regra dos anéis sem banco, sem HTTP e sem relógio real.
 */

const CONFIG: DispatchRingConfig = {
  initialRadiusKm: 3,
  ringIncrementKm: 3,
  maxRounds: 4,
  totalDurationMinutes: 20,
};

const at = (km: number, id = `c-${km}`) => ({ courierId: id, distanceKm: km });

describe('DISP-01 — anéis de raio', () => {
  it('o anel 1 usa o raio inicial e cada anel soma o incremento', () => {
    expect(ringRadiusKm(1, CONFIG)).toBe(3);
    expect(ringRadiusKm(2, CONFIG)).toBe(6);
    expect(ringRadiusKm(3, CONFIG)).toBe(9);
    expect(ringRadiusKm(4, CONFIG)).toBe(12);
    expect(maxRadiusKm(CONFIG)).toBe(12);
  });

  it('incremento zero mantém o mesmo raio em todas as rodadas', () => {
    const fixo = { ...CONFIG, ringIncrementKm: 0 };
    expect(ringRadiusKm(1, fixo)).toBe(3);
    expect(ringRadiusKm(4, fixo)).toBe(3);
  });

  it('escolhe o mais próximo dentro do anel da rodada', () => {
    const selection = selectRingCandidate(
      [at(2.5, 'perto'), at(0.4, 'pertinho'), at(11, 'longe')],
      CONFIG,
      1,
    );
    expect(selection).toEqual({
      round: 1,
      radiusKm: 3,
      courierId: 'pertinho',
      eligibleCount: 2,
    });
  });

  it('quem está fora do anel 1 não é sequer contado como elegível', () => {
    const selection = selectRingCandidate([at(2.9), at(4)], CONFIG, 1);
    expect(selection?.eligibleCount).toBe(1);
    expect(selection?.courierId).toBe('c-2.9');
  });

  it('amplia o anel dentro da mesma chamada quando o primeiro está vazio', () => {
    // Ninguém a 3 km; o candidato de 8 km só aparece no anel 3 (9 km).
    const selection = selectRingCandidate([at(8, 'medio')], CONFIG, 1);
    expect(selection).toEqual({
      round: 3,
      radiusKm: 9,
      courierId: 'medio',
      eligibleCount: 1,
    });
  });

  it('a rodada seguinte começa no anel seguinte, mesmo com candidato perto', () => {
    // Rodada 2: o raio já é 6 km, e quem está a 1 km continua elegível.
    const selection = selectRingCandidate([at(1, 'vizinho')], CONFIG, 2);
    expect(selection?.round).toBe(2);
    expect(selection?.radiusKm).toBe(6);
  });

  it('devolve null quando ninguém cabe nem no último anel', () => {
    expect(selectRingCandidate([at(12.5)], CONFIG, 1)).toBeNull();
  });

  it('devolve null quando as rodadas acabaram', () => {
    expect(selectRingCandidate([at(0.1)], CONFIG, 5)).toBeNull();
  });

  it('o candidato exatamente na borda do anel entra', () => {
    expect(selectRingCandidate([at(3)], CONFIG, 1)?.courierId).toBe('c-3');
  });
});

describe('DISP-01 — limite de rodadas', () => {
  it('conta rodada nula de pedido legado como zero', () => {
    expect(roundsUsed({ dispatchRound: null })).toBe(0);
    expect(roundsUsed({})).toBe(0);
    expect(roundsUsed({ dispatchRound: 2 })).toBe(2);
  });

  it('permite rodada nova até o máximo configurado, e nem uma a mais', () => {
    expect(hasRoundsLeft({ dispatchRound: 3 }, CONFIG)).toBe(true);
    expect(hasRoundsLeft({ dispatchRound: 4 }, CONFIG)).toBe(false);
    expect(hasRoundsLeft({ dispatchRound: 9 }, CONFIG)).toBe(false);
  });
});

describe('DISP-01 — duração total', () => {
  const now = new Date('2026-08-09T12:00:00.000Z');

  it('ciclo que não começou nunca está esgotado', () => {
    expect(dispatchTimeboxExhausted(null, now, CONFIG)).toBe(false);
  });

  it('dentro da duração total, continua valendo', () => {
    const startedAt = new Date(now.getTime() - 19 * 60_000);
    expect(dispatchTimeboxExhausted(startedAt, now, CONFIG)).toBe(false);
  });

  it('no minuto exato da duração total, encerra', () => {
    const startedAt = new Date(now.getTime() - 20 * 60_000);
    expect(dispatchTimeboxExhausted(startedAt, now, CONFIG)).toBe(true);
  });

  it('quem nunca ofertou termina por falta de candidato, não por tempo', () => {
    expect(timeboxEndReason({ dispatchRound: 0 })).toBe('NO_CANDIDATE');
    expect(timeboxEndReason({ dispatchRound: null })).toBe('NO_CANDIDATE');
    expect(timeboxEndReason({ dispatchRound: 1 })).toBe('TIMEBOX');
  });
});

describe('DISP-01 — reabertura na janela do agendado', () => {
  const windowStart = new Date('2026-08-09T15:00:00.000Z');

  it('reabre quando a janela chega e o ciclo tinha começado antes dela', () => {
    expect(
      shouldReopenForWindow(
        {
          pickupWindowStart: windowStart,
          dispatchStartedAt: new Date('2026-08-09T09:00:00.000Z'),
        },
        new Date('2026-08-09T15:00:01.000Z'),
      ),
    ).toBe(true);
  });

  it('não reabre antes da janela', () => {
    expect(
      shouldReopenForWindow(
        {
          pickupWindowStart: windowStart,
          dispatchStartedAt: new Date('2026-08-09T09:00:00.000Z'),
        },
        new Date('2026-08-09T14:59:00.000Z'),
      ),
    ).toBe(false);
  });

  it('é idempotente: depois de reaberto, não reabre de novo', () => {
    expect(
      shouldReopenForWindow(
        {
          pickupWindowStart: windowStart,
          dispatchStartedAt: new Date('2026-08-09T15:00:01.000Z'),
        },
        new Date('2026-08-09T15:10:00.000Z'),
      ),
    ).toBe(false);
  });

  it('pedido imediato (sem janela) nunca reabre por este caminho', () => {
    expect(
      shouldReopenForWindow(
        { pickupWindowStart: null, dispatchStartedAt: new Date() },
        new Date(),
      ),
    ).toBe(false);
  });
});

describe('DISP-01 — motivos de término', () => {
  it('todo motivo tem uma frase legível', () => {
    for (const reason of DISPATCH_END_REASONS) {
      expect(describeEndReason(reason).length).toBeGreaterThan(3);
    }
  });

  it('os motivos recuperáveis não incluem aceite nem cancelamento', () => {
    expect(RECOVERABLE_END_REASONS).not.toContain('ACCEPTED');
    expect(RECOVERABLE_END_REASONS).not.toContain('CANCELED');
    expect(RECOVERABLE_END_REASONS).toEqual([
      'MAX_ROUNDS',
      'TIMEBOX',
      'NO_CANDIDATE',
    ]);
  });
});

describe('DISP-02 — proposta de aumento de valor (DEC-03 §3.3)', () => {
  it('com 20% sobre R$ 25,00 propõe R$ 30,00, congelando o anterior', () => {
    expect(priceBoostProposal(2500, 20)).toEqual({
      boostPercent: 20,
      previousPriceCents: 2500,
      newPriceCents: 3000,
    });
  });

  it('percentual zero devolve null — sem proposta, sem card', () => {
    expect(priceBoostProposal(2500, 0)).toBeNull();
  });

  it('percentual negativo devolve null (config inválida nunca vira aumento)', () => {
    expect(priceBoostProposal(2500, -5)).toBeNull();
  });

  it('arredonda meio para cima, como o preço normal', () => {
    expect(priceBoostProposal(1000, 15)?.newPriceCents).toBe(1150);
    expect(priceBoostProposal(1000, 33)?.newPriceCents).toBe(1330);
  });

  it('nunca propõe valor menor ou igual ao atual', () => {
    const proposal = priceBoostProposal(0, 20);
    expect(proposal).toBeNull();
  });
});

describe('DISP-02 — aviso do primeiro atraso significativo (plano §6.1.4)', () => {
  const start = new Date('2026-08-10T10:00:00Z');

  it('avisado só depois de passar o limite em minutos', () => {
    expect(firstWarningDue(start, new Date('2026-08-10T10:04:59Z'), 5)).toBe(
      false,
    );
    expect(firstWarningDue(start, new Date('2026-08-10T10:05:00Z'), 5)).toBe(
      true,
    );
  });

  it('warningMinutes = 0 avisa no primeiro tick (usado por teste e smoke)', () => {
    expect(firstWarningDue(start, new Date(start.getTime() + 1), 0)).toBe(true);
  });

  it('sem início de ciclo ainda não há demora a avisar', () => {
    expect(firstWarningDue(null, new Date(), 5)).toBe(false);
    expect(firstWarningDue(undefined, new Date(), 5)).toBe(false);
  });
});
