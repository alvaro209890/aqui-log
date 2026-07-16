import {
  AlertTriangle,
  Bike,
  Building2,
  CircleDollarSign,
  FileChartColumn,
  Headphones,
  LayoutDashboard,
  LogOut,
  Map,
  PackageCheck,
  Route,
  Settings,
  ShieldCheck,
  Star,
  Users,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { Session } from '../api';

const ops = [
  { to: '/', label: 'Visao geral', icon: LayoutDashboard, end: true },
  { to: '/map', label: 'Mapa ao vivo', icon: Map },
  { to: '/deliveries', label: 'Entregas', icon: PackageCheck },
  { to: '/companies', label: 'Empresas', icon: Building2 },
  { to: '/couriers', label: 'Entregadores', icon: Bike },
  { to: '/finance', label: 'Financeiro', icon: CircleDollarSign },
  { to: '/ratings', label: 'Avaliacoes', icon: Star },
  { to: '/reports', label: 'Relatorios', icon: FileChartColumn },
  { to: '/alerts', label: 'Alertas', icon: AlertTriangle },
];

const management = [
  { to: '/users', label: 'Usuarios', icon: Users },
  { to: '/audit', label: 'Auditoria', icon: ShieldCheck },
  { to: '/settings', label: 'Configuracoes', icon: Settings },
];

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function Sidebar({
  session,
  open,
  onClose,
  onSignOut,
  alertCount,
}: {
  session: Session;
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
  alertCount: number;
}) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <span className="brand-mark">
          <Route size={22} />
        </span>
        <span>
          AQUI <strong>LOG</strong>
        </span>
        <button
          className="icon-button mobile-close"
          onClick={onClose}
          aria-label="Fechar menu"
        >
          <X />
        </button>
      </div>
      <nav className="main-nav" aria-label="Navegacao principal">
        <p className="nav-label">OPERACAO</p>
        {ops.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <Icon size={19} />
            <span>{label}</span>
            {label === 'Alertas' && alertCount > 0 && (
              <em>{alertCount > 99 ? '99+' : alertCount}</em>
            )}
          </NavLink>
        ))}
        <p className="nav-label second">GESTAO</p>
        {management.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
          >
            <Icon size={19} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="support-card">
        <Headphones size={22} />
        <div>
          <strong>Precisa de ajuda?</strong>
          <span>Fale com o suporte</span>
        </div>
      </div>
      <div className="sidebar-user">
        <span className="avatar">{initials(session.user.name)}</span>
        <div>
          <strong>{session.user.name}</strong>
          <span>{session.user.role}</span>
        </div>
        <button
          className="icon-button logout"
          onClick={onSignOut}
          aria-label="Sair"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
