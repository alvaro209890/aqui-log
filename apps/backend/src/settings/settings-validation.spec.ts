import { BadRequestException } from '@nestjs/common';
import { SettingsService, type PlatformSettings } from './settings.module';

/**
 * A validação de settings é pura (não toca Redis nem auditoria), então dá para
 * exercitá-la sem subir o módulo inteiro.
 */
const service = Object.create(SettingsService.prototype) as SettingsService;

const base: PlatformSettings = {
  offerTtlSeconds: 120,
  pricingBaseFeeCents: 700,
  pricingPerKmCents: 250,
  pricingPlatformFeePercent: 20,
  pricingMinFeeCents: 900,
  pricingPerKmImmediateCents: 250,
  pricingPerKmScheduledCents: 180,
  pricingWeightBands: [
    { upToKg: 2, surchargeCents: 0 },
    { upToKg: 5, surchargeCents: 200 },
  ],
  pricingAboveTopBandCents: 1500,
  pricingSizeSurchargeCents: { SMALL: 0, MEDIUM: 150, LARGE: 400 },
  courierCancelFeeCents: 300,
  courierCancelCutoffMinutesImmediate: 5,
  courierCancelCutoffMinutesScheduled: 60,
  customerCancelFeeCents: 0,
  minScheduleLeadMinutes: 30,
  scheduleMaxWindowMinutes: 480,
  scheduleCapacitySlackMinutes: 15,
  immediateExecutionEstimateMinutes: 45,
};

/**
 * Regressão: o DTO chega como instância de classe com TODAS as propriedades
 * declaradas — as ausentes valem `undefined`. Sem limpar antes do merge, elas
 * apagavam valores já personalizados (perda silenciosa, porque
 * `JSON.stringify` descarta `undefined`) e deixavam a validação cega.
 */
describe('SettingsService.update — patch parcial (regressão)', () => {
  function makeService(current: PlatformSettings) {
    const stored: { value: string | null } = { value: null };
    const svc = Object.create(SettingsService.prototype) as SettingsService;
    const deps = {
      redis: {
        raw: {
          get: (): Promise<string | null> => Promise.resolve(stored.value),
          set: (_key: string, value: string): Promise<string> => {
            stored.value = value;
            return Promise.resolve('OK');
          },
        },
      },
      audit: { record: (): Promise<void> => Promise.resolve() },
      get: (): Promise<PlatformSettings> => Promise.resolve(current),
    };
    Object.assign(svc, deps);
    return { svc, stored };
  }

  /** DTO como o Nest entrega: chaves não enviadas presentes com `undefined`. */
  function dtoLike(sent: Partial<PlatformSettings>): Partial<PlatformSettings> {
    const full: Record<string, unknown> = {};
    for (const key of Object.keys(base)) full[key] = undefined;
    return { ...full, ...sent };
  }

  it('preserva valores personalizados ao editar um único campo', async () => {
    const custom: PlatformSettings = { ...base, pricingBaseFeeCents: 1234 };
    const { svc, stored } = makeService(custom);

    const next = await svc.update(dtoLike({ offerTtlSeconds: 150 }));

    expect(next.offerTtlSeconds).toBe(150);
    expect(next.pricingBaseFeeCents).toBe(1234);
    const persisted = JSON.parse(stored.value ?? '{}') as PlatformSettings;
    expect(persisted.pricingBaseFeeCents).toBe(1234);
  });

  it('ainda aplica o DEC-19 sobre o estado final, não sobre o patch', async () => {
    const { svc } = makeService(base);

    await expect(
      svc.update(dtoLike({ pricingPerKmScheduledCents: 400 })),
    ).rejects.toThrow(/imediato deve ser maior/i);
  });
});

describe('SettingsService.assertValid (DEC-19)', () => {
  it('aceita a configuração padrão', () => {
    expect(() => service.assertValid(base)).not.toThrow();
  });

  it('recusa imediato igual ao agendado', () => {
    expect(() =>
      service.assertValid({ ...base, pricingPerKmScheduledCents: 250 }),
    ).toThrow(BadRequestException);
  });

  it('recusa imediato mais barato que o agendado', () => {
    expect(() =>
      service.assertValid({ ...base, pricingPerKmScheduledCents: 400 }),
    ).toThrow(/imediato deve ser maior/i);
  });

  it('recusa faixas de peso com o mesmo limite', () => {
    expect(() =>
      service.assertValid({
        ...base,
        pricingWeightBands: [
          { upToKg: 5, surchargeCents: 0 },
          { upToKg: 5, surchargeCents: 200 },
        ],
      }),
    ).toThrow(/mesmo limite/i);
  });

  // SCHED-01: janela máxima menor que a mínima operacional recusaria todo
  // pedido agendado, e o operador não teria como perceber pela tela.
  it('recusa janela máxima abaixo do mínimo operacional', () => {
    expect(() =>
      service.assertValid({ ...base, scheduleMaxWindowMinutes: 5 }),
    ).toThrow(/janela máxima/i);
  });

  it('aceita a antecedência mínima do FLOW-DEC-02 e uma folga maior', () => {
    expect(() =>
      service.assertValid({
        ...base,
        minScheduleLeadMinutes: 30,
        scheduleCapacitySlackMinutes: 30,
      }),
    ).not.toThrow();
  });

  it('aceita faixas fora de ordem, desde que sem repetição', () => {
    expect(() =>
      service.assertValid({
        ...base,
        pricingWeightBands: [
          { upToKg: 10, surchargeCents: 450 },
          { upToKg: 2, surchargeCents: 0 },
        ],
      }),
    ).not.toThrow();
  });
});
