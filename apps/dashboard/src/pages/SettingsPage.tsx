import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { api, type PlatformSettings } from '../api';

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

  return (
    <div className="page">
      <section className="page-heading">
        <div>
          <p>GESTAO</p>
          <h1>Configuracoes</h1>
          <span>
            TTL de oferta e taxas de precificacao (persistidas em Redis).
          </span>
        </div>
      </section>
      <section className="panel settings-panel">
        {loading || !form ? (
          <div className="skeleton-table">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-line" />
            ))}
          </div>
        ) : (
          <form className="settings-form" onSubmit={submit}>
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
            <label>
              Taxa base (centavos)
              <input
                type="number"
                min={0}
                value={form.pricingBaseFeeCents}
                onChange={(e) => setNum('pricingBaseFeeCents', e.target.value)}
              />
            </label>
            <label>
              Preco por km (centavos)
              <input
                type="number"
                min={0}
                value={form.pricingPerKmCents}
                onChange={(e) => setNum('pricingPerKmCents', e.target.value)}
              />
            </label>
            <label>
              % plataforma
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
              Minimo (centavos)
              <input
                type="number"
                min={0}
                value={form.pricingMinFeeCents}
                onChange={(e) => setNum('pricingMinFeeCents', e.target.value)}
              />
            </label>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar configuracoes'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
