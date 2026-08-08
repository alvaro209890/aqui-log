import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { App } from './App';
import './styles.css';
import { applyThemeMode, resolveThemeMode } from './theme-mode';

// Aplica o tema antes de montar, para o painel não piscar branco.
applyThemeMode(resolveThemeMode());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster richColors position="top-right" closeButton />
    </BrowserRouter>
  </StrictMode>,
);
