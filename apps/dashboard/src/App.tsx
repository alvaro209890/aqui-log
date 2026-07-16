import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import { Route as RouteIcon } from 'lucide-react';
import { api, type Session } from './api';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AlertsPage } from './pages/AlertsPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CouriersPage } from './pages/CouriersPage';
import { DeliveriesPage } from './pages/DeliveriesPage';
import { FinancePage } from './pages/FinancePage';
import { MapPage } from './pages/MapPage';
import { OverviewPage } from './pages/OverviewPage';
import { RatingsPage } from './pages/RatingsPage';
import { ReportsPage } from './pages/ReportsPage';

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(() => {
    const stored = localStorage.getItem('aqui-log-session');
    return stored ? (JSON.parse(stored) as Session) : null;
  });
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!session) return;
    api
      .notifications(session.accessToken)
      .then((items) =>
        setAlertCount(items.filter((n) => !n.readAt).length),
      )
      .catch(() => setAlertCount(0));
  }, [session]);

  if (!session) {
    return (
      <LoginPage
        onAuthenticated={(next) => {
          localStorage.setItem('aqui-log-session', JSON.stringify(next));
          setSession(next);
          toast.success('Sessao iniciada');
        }}
      />
    );
  }

  const signOut = () => {
    localStorage.removeItem('aqui-log-session');
    setSession(null);
    toast.message('Voce saiu do painel');
  };

  const token = session.accessToken;

  return (
    <div className="app-shell">
      <Sidebar
        session={session}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSignOut={signOut}
        alertCount={alertCount}
      />
      {menuOpen && (
        <button
          className="scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <main className="content">
        <TopBar
          onMenu={() => setMenuOpen(true)}
          notificationCount={alertCount}
        />
        <Routes>
          <Route
            path="/"
            element={
              <OverviewPage token={token} userName={session.user.name} />
            }
          />
          <Route path="/map" element={<MapPage token={token} />} />
          <Route
            path="/deliveries"
            element={<DeliveriesPage token={token} />}
          />
          <Route
            path="/companies"
            element={<CompaniesPage token={token} />}
          />
          <Route path="/couriers" element={<CouriersPage token={token} />} />
          <Route path="/finance" element={<FinancePage token={token} />} />
          <Route path="/ratings" element={<RatingsPage token={token} />} />
          <Route path="/reports" element={<ReportsPage token={token} />} />
          <Route path="/alerts" element={<AlertsPage token={token} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function LoginPage({
  onAuthenticated,
}: {
  onAuthenticated: (session: Session) => void;
}) {
  const [email, setEmail] = useState('admin@aquilog.com.br');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      onAuthenticated(await api.login(email, password));
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : 'Falha no login',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark">
            <RouteIcon size={22} />
          </span>
          <span>
            AQUI <strong>LOG</strong>
          </span>
        </div>
        <p className="eyebrow">PAINEL OPERACIONAL</p>
        <h1>Entre na sua conta</h1>
        <p className="login-copy">
          Gerencie empresas, entregadores e entregas em tempo real.
        </p>
        <form onSubmit={submit}>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button
            className="primary-button login-submit"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Entrando...' : 'Entrar no painel'}
          </button>
        </form>
        <small>
          Use o administrador criado por <code>pnpm db:admin</code>.
        </small>
      </section>
    </main>
  );
}
