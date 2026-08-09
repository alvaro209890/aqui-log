import { BadRequestException } from '@nestjs/common';
import {
  SCHEDULE_MAX_HORIZON_DAYS,
  SCHEDULE_MIN_WINDOW_MINUTES,
  executionWindow,
  hasCapacityConflict,
  isReservedAhead,
  resolveSchedule,
  scheduleExecutionOpen,
  windowsCollide,
  type ScheduleLimits,
} from './scheduling';

/**
 * SCHED-01 — a regra de janela é o coração do modo agendado, e é onde um erro
 * silencioso custa caro (pedido para daqui a 3 minutos, janela invertida,
 * agendamento em 2049). Tudo aqui roda com relógio fixo.
 */
const NOW = new Date('2026-08-09T12:00:00.000Z');
const LIMITS: ScheduleLimits = { minLeadMinutes: 30, maxWindowMinutes: 480 };

const iso = (minutesFromNow: number) =>
  new Date(NOW.getTime() + minutesFromNow * 60_000).toISOString();

describe('resolveSchedule — IMMEDIATE', () => {
  it('não devolve janela nenhuma', () => {
    expect(
      resolveSchedule({ fulfillmentMode: 'IMMEDIATE' }, LIMITS, NOW),
    ).toEqual({
      pickupWindowStart: null,
      pickupWindowEnd: null,
      deliveryWindowStart: null,
      deliveryWindowEnd: null,
    });
  });

  it('recusa janela enviada junto do modo imediato', () => {
    expect(() =>
      resolveSchedule(
        {
          fulfillmentMode: 'IMMEDIATE',
          pickupWindowStart: iso(120),
          pickupWindowEnd: iso(180),
        },
        LIMITS,
        NOW,
      ),
    ).toThrow(/só vale no modo agendado/i);
  });
});

describe('resolveSchedule — SCHEDULED (FLOW-DEC-02)', () => {
  it('aceita janela válida à frente da antecedência mínima', () => {
    const resolved = resolveSchedule(
      {
        fulfillmentMode: 'SCHEDULED',
        pickupWindowStart: iso(120),
        pickupWindowEnd: iso(180),
      },
      LIMITS,
      NOW,
    );

    expect(resolved.pickupWindowStart?.toISOString()).toBe(iso(120));
    expect(resolved.pickupWindowEnd?.toISOString()).toBe(iso(180));
    expect(resolved.deliveryWindowStart).toBeNull();
  });

  it('aceita exatamente 30 minutos de antecedência', () => {
    expect(() =>
      resolveSchedule(
        {
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: iso(30),
          pickupWindowEnd: iso(90),
        },
        LIMITS,
        NOW,
      ),
    ).not.toThrow();
  });

  it('recusa 29 minutos de antecedência', () => {
    expect(() =>
      resolveSchedule(
        {
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: iso(29),
          pickupWindowEnd: iso(90),
        },
        LIMITS,
        NOW,
      ),
    ).toThrow(/30 minutos à frente/);
  });

  it('recusa janela no passado', () => {
    expect(() =>
      resolveSchedule(
        {
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: iso(-120),
          pickupWindowEnd: iso(-60),
        },
        LIMITS,
        NOW,
      ),
    ).toThrow(BadRequestException);
  });

  it('exige as duas pontas da janela de coleta', () => {
    expect(() =>
      resolveSchedule(
        { fulfillmentMode: 'SCHEDULED', pickupWindowStart: iso(120) },
        LIMITS,
        NOW,
      ),
    ).toThrow(/início e fim da janela de coleta/i);
  });

  it('recusa fim antes ou igual ao início', () => {
    for (const end of [iso(60), iso(90)]) {
      expect(() =>
        resolveSchedule(
          {
            fulfillmentMode: 'SCHEDULED',
            pickupWindowStart: iso(120),
            pickupWindowEnd: end,
          },
          LIMITS,
          NOW,
        ),
      ).toThrow(/depois do início/i);
    }
  });

  it(`recusa janela mais curta que ${SCHEDULE_MIN_WINDOW_MINUTES} minutos`, () => {
    expect(() =>
      resolveSchedule(
        {
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: iso(120),
          pickupWindowEnd: iso(125),
        },
        LIMITS,
        NOW,
      ),
    ).toThrow(/ao menos 15 minutos/i);
  });

  it('recusa janela mais longa que o máximo configurado', () => {
    expect(() =>
      resolveSchedule(
        {
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: iso(120),
          pickupWindowEnd: iso(120 + LIMITS.maxWindowMinutes + 1),
        },
        LIMITS,
        NOW,
      ),
    ).toThrow(/não pode passar de 480 minutos/i);
  });

  it(`recusa agendamento além de ${SCHEDULE_MAX_HORIZON_DAYS} dias`, () => {
    const beyond = (SCHEDULE_MAX_HORIZON_DAYS + 1) * 24 * 60;
    expect(() =>
      resolveSchedule(
        {
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: iso(beyond),
          pickupWindowEnd: iso(beyond + 60),
        },
        LIMITS,
        NOW,
      ),
    ).toThrow(/30 dias/);
  });

  it('recusa data que não é data', () => {
    expect(() =>
      resolveSchedule(
        {
          fulfillmentMode: 'SCHEDULED',
          pickupWindowStart: 'depois do almoço',
          pickupWindowEnd: iso(180),
        },
        LIMITS,
        NOW,
      ),
    ).toThrow(/invalida/i);
  });
});

describe('resolveSchedule — janela de entrega (opcional)', () => {
  const pickup = {
    fulfillmentMode: 'SCHEDULED' as const,
    pickupWindowStart: iso(120),
    pickupWindowEnd: iso(180),
  };

  it('aceita pedido agendado sem janela de entrega', () => {
    const resolved = resolveSchedule(pickup, LIMITS, NOW);
    expect(resolved.deliveryWindowStart).toBeNull();
    expect(resolved.deliveryWindowEnd).toBeNull();
  });

  it('aceita janela de entrega completa depois da coleta', () => {
    const resolved = resolveSchedule(
      {
        ...pickup,
        deliveryWindowStart: iso(180),
        deliveryWindowEnd: iso(300),
      },
      LIMITS,
      NOW,
    );
    expect(resolved.deliveryWindowStart?.toISOString()).toBe(iso(180));
  });

  it('recusa metade da janela de entrega', () => {
    expect(() =>
      resolveSchedule(
        { ...pickup, deliveryWindowStart: iso(180) },
        LIMITS,
        NOW,
      ),
    ).toThrow(/início e fim da janela de entrega/i);
  });

  it('recusa entrega marcada antes do início da coleta', () => {
    expect(() =>
      resolveSchedule(
        {
          ...pickup,
          deliveryWindowStart: iso(60),
          deliveryWindowEnd: iso(200),
        },
        LIMITS,
        NOW,
      ),
    ).toThrow(/antes do início da coleta/i);
  });
});

describe('capacidade do prestador (plano §5.1)', () => {
  const reserved = {
    start: new Date(NOW.getTime() + 60 * 60_000),
    end: new Date(NOW.getTime() + 120 * 60_000),
  };

  it('estima a janela do imediato a partir de agora', () => {
    const window = executionWindow({ fulfillmentMode: 'IMMEDIATE' }, NOW, 45);
    expect(window.start).toEqual(NOW);
    expect(window.end.getTime() - NOW.getTime()).toBe(45 * 60_000);
  });

  it('usa a janela declarada quando o pedido é agendado', () => {
    const window = executionWindow(
      {
        fulfillmentMode: 'SCHEDULED',
        pickupWindowStart: reserved.start,
        pickupWindowEnd: reserved.end,
      },
      NOW,
      45,
    );
    expect(window).toEqual(reserved);
  });

  it('bloqueia oferta imediata que invade a janela reservada', () => {
    // Execução estimada de 90 min a partir de agora entra na reserva de +60.
    const immediate = executionWindow(
      { fulfillmentMode: 'IMMEDIATE' },
      NOW,
      90,
    );
    expect(hasCapacityConflict(immediate, [reserved], 15)).toBe(true);
  });

  it('libera oferta imediata que termina antes da reserva, com folga', () => {
    const immediate = executionWindow(
      { fulfillmentMode: 'IMMEDIATE' },
      NOW,
      30,
    );
    expect(hasCapacityConflict(immediate, [reserved], 15)).toBe(false);
  });

  it('a folga é o que separa os dois casos', () => {
    const immediate = executionWindow(
      { fulfillmentMode: 'IMMEDIATE' },
      NOW,
      50,
    );
    expect(windowsCollide(immediate, reserved, 0)).toBe(false);
    expect(windowsCollide(immediate, reserved, 15)).toBe(true);
  });

  it('prestador sem reserva nunca conflita', () => {
    const immediate = executionWindow(
      { fulfillmentMode: 'IMMEDIATE' },
      NOW,
      90,
    );
    expect(hasCapacityConflict(immediate, [], 15)).toBe(false);
  });
});

describe('abertura da execução (DEC-20)', () => {
  it('imediato está sempre aberto', () => {
    expect(scheduleExecutionOpen({ fulfillmentMode: 'IMMEDIATE' }, NOW)).toBe(
      true,
    );
  });

  it('pedido legado sem janela está aberto', () => {
    expect(
      scheduleExecutionOpen(
        { fulfillmentMode: 'SCHEDULED', pickupWindowStart: null },
        NOW,
      ),
    ).toBe(true);
  });

  it('agendado antes da janela fica na agenda', () => {
    const delivery = {
      fulfillmentMode: 'SCHEDULED',
      pickupWindowStart: new Date(NOW.getTime() + 60_000),
    };
    expect(scheduleExecutionOpen(delivery, NOW)).toBe(false);
    expect(isReservedAhead(delivery, NOW)).toBe(true);
  });

  it('agendado a partir do início da janela abre', () => {
    const delivery = {
      fulfillmentMode: 'SCHEDULED',
      pickupWindowStart: NOW,
    };
    expect(scheduleExecutionOpen(delivery, NOW)).toBe(true);
    expect(isReservedAhead(delivery, NOW)).toBe(false);
  });
});
