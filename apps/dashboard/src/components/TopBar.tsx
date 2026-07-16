import { Bell, Menu, Search } from 'lucide-react';

export function TopBar({
  onMenu,
  notificationCount,
}: {
  onMenu: () => void;
  notificationCount: number;
}) {
  return (
    <header className="topbar">
      <button
        className="icon-button mobile-menu"
        onClick={onMenu}
        aria-label="Abrir menu"
      >
        <Menu />
      </button>
      <label className="search">
        <Search size={18} />
        <input placeholder="Buscar entrega, empresa ou entregador" />
      </label>
      <div className="top-actions">
        <button className="icon-button notification" aria-label="Notificacoes">
          <Bell size={20} />
          {notificationCount > 0 && (
            <i className="badge-dot" data-count={notificationCount} />
          )}
          {notificationCount > 0 && (
            <span className="notification-count">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
        <span className="divider" />
        <span className="system-status">
          <i /> Sistema operacional
        </span>
      </div>
    </header>
  );
}
