import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { api, type PlatformSettings, type WeightBand } from '../api';

const brl = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

/**
 * B2C-02 / DEC-02: todo valor de dinheiro do produto é editável aqui — preço,
 * faixas de peso, adicionais de tamanho e multas. Os valores que vieram no
 * `DEC-02` são PROVISÓRIOS e existem para destravar a implementação; a
 * calibragem real acontece nesta tela, sem deploy.
 */
export function SettingsPage({ token }: { token: string }) {
  const [form, setForm] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    api
      .settings(token)
      .then(setForm)
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const next = await api.updateSettings(token, form);
      setForm(next);
      toast.success('Configuracoes salvas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const setNum = (key: keyof PlatformSettings, value: string) => {
    if (!form) return;
    setForm({ ...form, [key]: Number(value) });
  };

  const setSize = (key: 'SMALL' | 'MEDIUM' | 'LARGE', value: string) => {
    if (!form) return;
    setForm({
      ...form,
      pricingSizeSurchargeCents: {
        ...form.pricingSizeSurchargeCents,
        [key]: Number(value),
      },
    });
  };

  const setBand = (index: number, patch: Partial<WeightBand>) => {
    if (!form) return;
    const bands = form.pricingWeightBands.map((band, i) =>
      i === index ? { ...band, ...patch } : band,
    );
    setForm({ ...form, pricingWeightBands: bands });
  };

  const addBand = () => {
    if (!form) return;
    const last = form.pricingWeightBands[form.pricingWeightBands.length - 1];
    setForm({
      ...form,
      pricingWeightBands: [
        ...form.pricingWeightBands,
        { upToKg: (last?.upToKg ?? 0) + 5, surchargeCents: 0 },
      ],
    });
  };

  const removeBand = (index: number) => {
    if (!form || form.pricingWeightBands.length <= 1) return;
    setForm({
      ...form,
      pricingWeightBands: form.pricingWeightBands.filter(
        (_, i) => i !== index,
      ),
    });
  };

  // DEC-19: o painel avisa antes de o servidor recusar.
  const kmRateInvalid =
    !!form &&
    form.pricingPerKmImmediateCents <= form.pricingPerKmScheduledCents;

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>GESTAO</p>
          <h1>Configuracoes</h1>
          <span>
            Preco, faixas de peso, adicionais de tamanho e multas. Tudo
            editavel; alteracao nao afeta pedido ja criado.
          </span>
        </div>
      </section>

      {loading || !form ? (
        <section className="panel">
          <div className="skeleton-table">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-line" />
            ))}
          </div>
        </section>
      ) : (
        <form onSubmit={submit}>
          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Operacao</h2>
                <p>Tempo de vida da oferta enviada ao motoboy</p>
              </div>
            </div>
            <div className="settings-form">
              <label>
                TTL da oferta (segundos)
                <input
                  type="number"
                  min={30}
                  max={3600}
                  value={form.offerTtlSeconds}
                  onChange={(e) => setNum('offerTtlSeconds', e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Preco base</h2>
                <p>Formula: base + km x tarifa + peso + tamanho, com piso</p>
              </div>
            </div>
            <div className="settings-form">
              <label>
                Taxa base ({brl(form.pricingBaseFeeCents)})
                <input
                  type="number"
                  min={0}
                  value={form.pricingBaseFeeCents}
                  onChange={(e) => setNum('pricingBaseFeeCents', e.target.value)}
                />
              </label>
              <label>
                Minimo cobrado ({brl(form.pricingMinFeeCents)})
                <input
                  type="number"
                  min={0}
                  value={form.pricingMinFeeCents}
                  onChange={(e) => setNum('pricingMinFeeCents', e.target.value)}
                />
              </label>
              <label>
                % da plataforma
                <input
                  type="number"
                  min={0}
                  max={90}
                  step={0.1}
                  value={form.pricingPlatformFeePercent}
                  onChange={(e) =>
                    setNum('pricingPlatformFeePercent', e.target.value)
                  }
                />
              </label>
              <label>
                Km imediato ({brl(form.pricingPerKmImmediateCents)}/km)
                <input
                  type="number"
                  min={0}
                  className={kmRateInvalid ? 'input-invalid' : undefined}
                  value={form.pricingPerKmImmediateCents}
                  onChange={(e) =>
                    setNum('pricingPerKmImmediateCents', e.target.value)
                  }
                />
              </label>
              <label>
                Km agendado ({brl(form.pricingPerKmScheduledCents)}/km)
                <input
                  type="number"
                  min={0}
                  className={kmRateInvalid ? 'input-invalid' : undefined}
                  value={form.pricingPerKmScheduledCents}
                  onChange={(e) =>
                    setNum('pricingPerKmScheduledCents', e.target.value)
                  }
                />
              </label>
            </div>
            {kmRateInvalid && (
              <p className="settings-warning">
                O km do imediato precisa ser maior que o do agendado (DEC-19).
                O servidor vai recusar como esta.
              </p>
            )}
          </section>

          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Faixas de peso</h2>
                <p>Adicional cobrado ate o limite de cada faixa (inclusive)</p>
              </div>
              <button type="button" className="text-button" onClick={addBand}>
                + Adicionar faixa
              </button>
            </div>
            <div className="settings-bands">
              {form.pricingWeightBands.map((band, index) => (
                <div className="settings-band" key={index}>
                  <label>
                    Ate (kg)
                    <input
                      type="number"
                      min={0.001}
                      // `step` fixo invalida peso inteiro (2 kg não é alcançável
                      // a partir de 0.001) e o navegador bloqueia o submit do
                      // formulário INTEIRO, sem mensagem visível.
                      step="any"
                      value={band.upToKg}
                      onChange={(e) =>
                        setBand(index, { upToKg: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Adicional ({brl(band.surchargeCents)})
                    <input
                      type="number"
                      min={0}
                      value={band.surchargeCents}
                      onChange={(e) =>
                        setBand(index, {
                          surchargeCents: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="text-button danger"
                    onClick={() => removeBand(index)}
                    disabled={form.pricingWeightBands.length <= 1}
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
            <div className="settings-form">
              <label>
                Acima da ultima faixa ({brl(form.pricingAboveTopBandCents)})
                <input
                  type="number"
                  min={0}
                  value={form.pricingAboveTopBandCents}
                  onChange={(e) =>
                    setNum('pricingAboveTopBandCents', e.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Adicional por tamanho</h2>
                <p>Somado ao preco conforme o tamanho declarado</p>
              </div>
            </div>
            <div className="settings-form">
              {(['SMALL', 'MEDIUM', 'LARGE'] as const).map((size) => (
                <label key={size}>
                  {size === 'SMALL'
                    ? 'Pequeno'
                    : size === 'MEDIUM'
                      ? 'Medio'
                      : 'Grande'}{' '}
                  ({brl(form.pricingSizeSurchargeCents[size])})
                  <input
                    type="number"
                    min={0}
                    value={form.pricingSizeSurchargeCents[size]}
                    onChange={(e) => setSize(size, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Multas e cancelamento</h2>
                <p>
                  Valores editaveis. A cobranca automatica ainda nao esta
                  implementada (depende de PAY-01 / COUR-02).
                </p>
              </div>
            </div>
            <div className="settings-form">
              <label>
                Multa do prestador ({brl(form.courierCancelFeeCents)})
                <input
                  type="number"
                  min={0}
                  value={form.courierCancelFeeCents}
                  onChange={(e) =>
                    setNum('courierCancelFeeCents', e.target.value)
                  }
                />
              </label>
              <label>
                Multa do cliente ({brl(form.customerCancelFeeCents)})
                <input
                  type="number"
                  min={0}
                  value={form.customerCancelFeeCents}
                  onChange={(e) =>
                    setNum('customerCancelFeeCents', e.target.value)
                  }
                />
              </label>
              <label>
                Cutoff imediato (minutos)
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={form.courierCancelCutoffMinutesImmediate}
                  onChange={(e) =>
                    setNum('courierCancelCutoffMinutesImmediate', e.target.value)
                  }
                />
              </label>
              <label>
                Cutoff agendado (minutos)
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={form.courierCancelCutoffMinutesScheduled}
                  onChange={(e) =>
                    setNum('courierCancelCutoffMinutesScheduled', e.target.value)
                  }
                />
              </label>
            </div>
          </section>

          <div className="settings-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar configuracoes'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
