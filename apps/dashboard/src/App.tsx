import {
  Bell, Bike, Building2, ChevronDown, CircleDollarSign, Clock3,
  FileChartColumn, Headphones, LayoutDashboard, Map, Menu, PackageCheck,
  LogOut, Route, Search, Settings, ShieldCheck, Truck, Users, X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, type DashboardSummary, type DeliveryRecord, type Session } from './api';

const nav = [
  { label: 'Visao geral', icon: LayoutDashboard, active: true },
  { label: 'Mapa ao vivo', icon: Map },
  { label: 'Entregas', icon: PackageCheck, badge: '12' },
  { label: 'Empresas', icon: Building2 },
  { label: 'Entregadores', icon: Bike },
  { label: 'Financeiro', icon: CircleDollarSign },
  { label: 'Relatorios', icon: FileChartColumn },
];

const emptySummary: DashboardSummary = { deliveriesToday: 0, activeCompanies: 0, availableCouriers: 0, inProgress: 0, revenueCents: 0 };

const statusLabel: Record<string, string> = { REQUESTED: 'Aguardando', OFFERED: 'Ofertada', ACCEPTED: 'Aceita', AT_PICKUP: 'Na coleta', PICKED_UP: 'Coletada', IN_TRANSIT: 'Em rota', DELIVERED: 'Entregue', CANCELED: 'Cancelada' };
const statusTone: Record<string, string> = { REQUESTED: 'amber', OFFERED: 'amber', ACCEPTED: 'blue', AT_PICKUP: 'blue', PICKED_UP: 'blue', IN_TRANSIT: 'green', DELIVERED: 'gray', CANCELED: 'gray' };

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem('aqui-log-session');
    return stored ? JSON.parse(stored) as Session : null;
  });
  const [summary, setSummary] = useState(emptySummary);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!session) return;
    Promise.all([api.summary(session.accessToken), api.deliveries(session.accessToken)])
      .then(([nextSummary, nextDeliveries]) => {
        setSummary(nextSummary);
        setDeliveries(nextDeliveries.slice(0, 8));
        setLoadError('');
      })
      .catch((error: Error) => setLoadError(error.message));
  }, [session]);

  if (!session) {
    return <LoginPage onAuthenticated={(next) => { localStorage.setItem('aqui-log-session', JSON.stringify(next)); setSession(next); }} />;
  }

  const signOut = () => {
    localStorage.removeItem('aqui-log-session');
    setSession(null);
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Route size={22} /></span>
          <span>AQUI <strong>LOG</strong></span>
          <button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X /></button>
        </div>
        <nav className="main-nav" aria-label="Navegacao principal">
          <p className="nav-label">OPERACAO</p>
          {nav.map(({ label, icon: Icon, active, badge }) => (
            <button className={`nav-item ${active ? 'active' : ''}`} key={label}>
              <Icon size={19} /> <span>{label}</span>{badge && <em>{badge}</em>}
            </button>
          ))}
          <p className="nav-label second">GESTAO</p>
          <button className="nav-item"><Users size={19} /><span>Usuarios</span></button>
          <button className="nav-item"><ShieldCheck size={19} /><span>Auditoria</span></button>
          <button className="nav-item"><Settings size={19} /><span>Configuracoes</span></button>
        </nav>
        <div className="support-card">
          <Headphones size={22} />
          <div><strong>Precisa de ajuda?</strong><span>Fale com o suporte</span></div>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{initials(session.user.name)}</span>
          <div><strong>{session.user.name}</strong><span>{session.user.role}</span></div>
          <button className="icon-button logout" onClick={signOut} aria-label="Sair"><LogOut size={16} /></button>
        </div>
      </aside>
      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}

      <main className="content">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu /></button>
          <label className="search"><Search size={18} /><input placeholder="Buscar entrega, empresa ou entregador" /></label>
          <div className="top-actions">
            <button className="icon-button notification" aria-label="Notificacoes"><Bell size={20} /><i /></button>
            <span className="divider" /><span className="system-status"><i /> Sistema operacional</span>
          </div>
        </header>

        <div className="page">
          <section className="page-heading">
            <div><p>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date()).toUpperCase()}</p><h1>Bom dia, {session.user.name.split(' ')[0]}.</h1><span>Acompanhe a operacao da Aqui Log em tempo real.</span></div>
            <button className="primary-button"><Truck size={18} /> Nova entrega</button>
          </section>

          <section className="metrics" aria-label="Indicadores da operacao">
            <Metric icon={<PackageCheck />} tone="mint" label="ENTREGAS HOJE" value={String(summary.deliveriesToday)} detail="solicitacoes recebidas" />
            <Metric icon={<Bike />} tone="blue" label="EM ROTA AGORA" value={String(summary.inProgress)} detail={`${summary.availableCouriers} entregadores disponiveis`} />
            <Metric icon={<Clock3 />} tone="sand" label="EMPRESAS ATIVAS" value={String(summary.activeCompanies)} detail="cadastros aprovados" />
            <Metric icon={<CircleDollarSign />} tone="purple" label="FATURAMENTO" value={formatCurrency(summary.revenueCents)} detail="entregas concluidas" />
          </section>

          <section className="dashboard-grid">
            <article className="panel operation-map">
              <PanelHeading title="Operacao ao vivo" subtitle={`${summary.inProgress} entregas em movimento`} action="Abrir mapa" />
              <div className="map-canvas">
                <div className="road road-one" /><div className="road road-two" /><div className="road road-three" />
                <span className="map-pin pin-one"><Bike size={17} /></span><span className="map-pin pin-two"><Bike size={17} /></span><span className="map-pin pin-three"><Truck size={17} /></span>
                <div className="map-legend"><span><i className="online" /> Em rota {summary.inProgress}</span><span><i className="waiting" /> Disponiveis {summary.availableCouriers}</span></div>
              </div>
            </article>

            <article className="panel health-panel">
              <PanelHeading title="Saude da operacao" subtitle="Atualizado agora" />
              <div className="health-score"><div className="score-ring"><strong>94</strong><span>/100</span></div><div><strong>Excelente</strong><p>Todos os indicadores estaveis.</p></div></div>
              <HealthRow label="Entregas no prazo" value="96%" width="96%" />
              <HealthRow label="Taxa de aceite" value="91%" width="91%" />
              <HealthRow label="Satisfacao" value="4,8" width="96%" />
            </article>
          </section>

          <section className="panel deliveries-panel">
            <PanelHeading title="Entregas recentes" subtitle="Ultimas movimentacoes da operacao" action="Ver todas" />
            <div className="table-wrap">
              <table><thead><tr><th>ENTREGA</th><th>ROTA</th><th>ENTREGADOR</th><th>ATUALIZACAO</th><th>STATUS</th><th /></tr></thead>
                <tbody>{deliveries.map((item) => <tr key={item.id}><td><strong>{item.code}</strong></td><td>{item.pickupAddress} → {item.deliveryAddress}</td><td>{item.courierId ? `#${item.courierId.slice(0, 8)}` : 'Sem entregador'}</td><td>{relativeTime(item.createdAt)}</td><td><span className={`status ${statusTone[item.status] ?? 'gray'}`}><i />{statusLabel[item.status] ?? item.status}</span></td><td><button className="more" aria-label={`Opcoes ${item.code}`}>•••</button></td></tr>)}</tbody>
              </table>
              {!deliveries.length && <p className="empty-state">{loadError || 'Nenhuma entrega cadastrada.'}</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon, tone, label, value, detail, positive = false }: { icon: ReactNode; tone: string; label: string; value: string; detail: string; positive?: boolean }) {
  return <article><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong><span className={positive ? 'positive' : ''}>{detail}</span></div></article>;
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [email, setEmail] = useState('admin@aquilog.com.br');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try { onAuthenticated(await api.login(email, password)); }
    catch (nextError) { setError(nextError instanceof Error ? nextError.message : 'Falha no login'); }
    finally { setLoading(false); }
  };

  return <main className="login-page"><section className="login-card"><div className="login-brand"><span className="brand-mark"><Route size={22} /></span><span>AQUI <strong>LOG</strong></span></div><p className="eyebrow">PAINEL OPERACIONAL</p><h1>Entre na sua conta</h1><p className="login-copy">Gerencie empresas, entregadores e entregas em tempo real.</p><form onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>{error && <p className="login-error">{error}</p>}<button className="primary-button login-submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar no painel'}</button></form><small>Use o administrador criado por <code>pnpm db:admin</code>.</small></section></main>;
}

function initials(name: string) { return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase(); }
function formatCurrency(cents: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function relativeTime(date: string) { const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000)); return minutes < 1 ? 'agora' : `${minutes} min`; }

function PanelHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button className="text-button">{action} <span>→</span></button>}</div>;
}

function HealthRow({ label, value, width }: { label: string; value: string; width: string }) {
  return <div className="health-row"><span>{label}</span><strong>{value}</strong><div><i style={{ width }} /></div></div>;
}
