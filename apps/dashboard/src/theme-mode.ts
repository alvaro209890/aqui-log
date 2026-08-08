/**
 * Modo de tema do painel (claro/escuro).
 *
 * O tema vive num atributo `data-theme` no `<html>`, e só os tokens CSS mudam —
 * nenhuma regra de layout é duplicada. A escolha do usuário fica no
 * localStorage; sem escolha, seguimos a preferência do sistema operacional.
 *
 * `applyThemeMode` também roda antes do React montar (em `main.tsx`), para o
 * painel não piscar branco antes de virar escuro.
 */
export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'aqui-log:theme';

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function storedThemeMode(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null; // storage bloqueado (modo privado / iframe)
  }
}

/** Escolha explícita vence; sem ela, a do sistema. */
export function resolveThemeMode(): ThemeMode {
  return storedThemeMode() ?? (systemPrefersDark() ? 'dark' : 'light');
}

export function applyThemeMode(mode: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', mode);
}

export function persistThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* sem storage: o tema vale só nesta aba */
  }
}
