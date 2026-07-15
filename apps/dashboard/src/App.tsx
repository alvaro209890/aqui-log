import {
  Bell, Bike, Building2, ChevronDown, CircleDollarSign, Clock3,
  FileChartColumn, Headphones, LayoutDashboard, Map, Menu, PackageCheck,
  Route, Search, Settings, ShieldCheck, Truck, Users, X,
} from 'lucide-react';
import { useState } from 'react';

const nav = [
  { label: 'Visao geral', icon: LayoutDashboard, active: true },
  { label: 'Mapa ao vivo', icon: Map },
  { label: 'Entregas', icon: PackageCheck, badge: '12' },
  { label: 'Empresas', icon: Building2 },
  { label: 'Entregadores', icon: Bike },
  { label: 'Financeiro', icon: CircleDollarSign },
  { label: 'Relatorios', icon: FileChartColumn },
];

const deliveries = [
  { id: '#AQL-1048', route: 'Centro → Savassi', courier: 'Rafael Souza', time: '8 min', status: 'Em rota', tone: 'green' },
  { id: '#AQL-1047', route: 'Lourdes → Buritis', courier: 'Camila Reis', time: '14 min', status: 'Coletado', tone: 'blue' },
  { id: '#AQL-1046', route: 'Funcionarios → Serra', courier: 'Sem entregador', time: '2 min', status: 'Aguardando', tone: 'amber' },
  { id: '#AQL-1045', route: 'Prado → Centro', courier: 'Diego Alves', time: '22 min', status: 'Entregue', tone: 'gray' },
];

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <span className="avatar">AM</span>
          <div><strong>Alvaro Martins</strong><span>Administrador</span></div>
          <ChevronDown size={16} />
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
            <div><p>TERCA-FEIRA, 14 DE JULHO</p><h1>Bom dia, Alvaro.</h1><span>Acompanhe a operacao da Aqui Log em tempo real.</span></div>
            <button className="primary-button"><Truck size={18} /> Nova entrega</button>
          </section>

          <section className="metrics" aria-label="Indicadores da operacao">
            <Metric icon={<PackageCheck />} tone="mint" label="ENTREGAS HOJE" value="128" detail="↑ 12% vs. ontem" positive />
            <Metric icon={<Bike />} tone="blue" label="EM ROTA AGORA" value="32" detail="de 46 ativas" />
            <Metric icon={<Clock3 />} tone="sand" label="TEMPO MEDIO" value="38 min" detail="↓ 4 min esta semana" positive />
            <Metric icon={<CircleDollarSign />} tone="purple" label="FATURAMENTO" value="R$ 4.860" detail="hoje" />
          </section>

          <section className="dashboard-grid">
            <article className="panel operation-map">
              <PanelHeading title="Operacao ao vivo" subtitle="32 entregadores em movimento" action="Abrir mapa" />
              <div className="map-canvas">
                <div className="road road-one" /><div className="road road-two" /><div className="road road-three" />
                <span className="map-pin pin-one"><Bike size={17} /></span><span className="map-pin pin-two"><Bike size={17} /></span><span className="map-pin pin-three"><Truck size={17} /></span>
                <div className="map-legend"><span><i className="online" /> Em rota 32</span><span><i className="waiting" /> Disponiveis 14</span></div>
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
                <tbody>{deliveries.map((item) => <tr key={item.id}><td><strong>{item.id}</strong></td><td>{item.route}</td><td>{item.courier}</td><td>{item.time}</td><td><span className={`status ${item.tone}`}><i />{item.status}</span></td><td><button className="more" aria-label={`Opcoes ${item.id}`}>•••</button></td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon, tone, label, value, detail, positive = false }: { icon: React.ReactNode; tone: string; label: string; value: string; detail: string; positive?: boolean }) {
  return <article><span className={`metric-icon ${tone}`}>{icon}</span><div><p>{label}</p><strong>{value}</strong><span className={positive ? 'positive' : ''}>{detail}</span></div></article>;
}

function PanelHeading({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button className="text-button">{action} <span>→</span></button>}</div>;
}

function HealthRow({ label, value, width }: { label: string; value: string; width: string }) {
  return <div className="health-row"><span>{label}</span><strong>{value}</strong><div><i style={{ width }} /></div></div>;
}
