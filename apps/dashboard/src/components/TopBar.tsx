import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  applyThemeMode,
  persistThemeMode,
  resolveThemeMode,
  type ThemeMode,
} from '../theme-mode';

export function TopBar({
  onMenu,
  notificationCount,
}: {
  onMenu: () => void;
  notificationCount: number;
}) {
  const [mode, setMode] = useState<ThemeMode>(() => resolveThemeMode());

  useEffect(() => {
    applyThemeMode(mode);
  }, [mode]);

  const toggleTheme = () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    persistThemeMode(next);
    setMode(next);
  };

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
        <input placeholder="Buscar entrega, cliente ou entregador" />
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
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={
            mode === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'
          }
          title={mode === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {mode === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <span className="divider" />
        <span className="system-status">
          <i /> Sistema operacional
        </span>
      </div>
    </header>
  );
}
