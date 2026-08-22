import { expect, type ConsoleMessage, type Page } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

export const PAGES = [
  { path: '/', name: 'Overview' },
  { path: '/deliveries', name: 'Deliveries' },
  { path: '/map', name: 'Map' },
  { path: '/couriers', name: 'Couriers' },
  { path: '/users', name: 'Users' },
  { path: '/finance', name: 'Finance' },
  { path: '/reports', name: 'Reports' },
  { path: '/ratings', name: 'Ratings' },
  { path: '/alerts', name: 'Alerts' },
  { path: '/audit', name: 'Audit' },
  { path: '/settings', name: 'Settings' },
] as const;

export const adminEmail =
  process.env.QA_ADMIN_EMAIL || 'admin@aquilog.com.br';
export const adminPassword = process.env.QA_ADMIN_PASSWORD || '';
export const seedCourierEmail = process.env.QA_SEED_COURIER_EMAIL || '';
export const seedCourierName =
  process.env.QA_SEED_COURIER_NAME || 'Candidato QA';
export const evidDir = process.env.QA_EVID_DIR || '';

const CONSOLE_IGNORE = [
  /favicon/i,
  /openstreetmap/i,
  /tile\./i,
  /fonts\.googleapis/i,
  /fonts\.gstatic/i,
  /websocket/i,
  /socket\.io/i,
  /ERR_CONNECTION_REFUSED/i,
  /Download the React DevTools/i,
];

export function requireAdminPassword(): void {
  if (!adminPassword) {
    throw new Error(
      'QA_ADMIN_PASSWORD obrigatorio (env ou ~/.config/aqui-log/env). Nunca commitar.',
    );
  }
}

export function attachConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m: ConsoleMessage) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (CONSOLE_IGNORE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on('pageerror', (e) => {
    const text = e.message;
    if (CONSOLE_IGNORE.some((re) => re.test(text))) return;
    errors.push(text);
  });
  return errors;
}

export async function login(page: Page): Promise<void> {
  requireAdminPassword();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const nav = page.getByRole('navigation', { name: /navega[cç][aã]o principal/i });
  if (await nav.isVisible().catch(() => false)) return;

  await page.getByLabel(/e-?mail/i).fill(adminEmail);
  await page.getByLabel(/senha/i).fill(adminPassword);
  await page.getByRole('button', { name: /entrar no painel/i }).click();
  await expect(nav).toBeVisible({ timeout: 20_000 });
}

export async function setTheme(
  page: Page,
  mode: 'light' | 'dark',
): Promise<void> {
  const html = page.locator('html');
  const current = await html.getAttribute('data-theme');
  if (current === mode) return;
  const label = mode === 'dark' ? /usar tema escuro/i : /usar tema claro/i;
  await page.getByRole('button', { name: label }).click();
  await expect(html).toHaveAttribute('data-theme', mode, { timeout: 5_000 });
}

export async function assertNoHorizontalOverflow(
  page: Page,
  where: string,
): Promise<void> {
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
  expect(overflow, `overflow horizontal em ${where}: ${overflow}px`).toBeLessThanOrEqual(
    2,
  );
}

export async function snapshot(
  page: Page,
  name: string,
): Promise<void> {
  if (!evidDir) return;
  await page.screenshot({
    path: join(evidDir, `${name}.png`),
    fullPage: true,
  });
}

function parseRgb(input: string): { r: number; g: number; b: number } | null {
  const m = input.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

export function contrastRatio(fg: string, bg: string): number {
  const a = parseRgb(fg);
  const b = parseRgb(bg);
  if (!a || !b) return 0;
  const l1 = relativeLuminance(a.r, a.g, a.b);
  const l2 = relativeLuminance(b.r, b.g, b.b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

type PairSample = { label: string; color: string; background: string };

export async function sampleContrastPairs(page: Page): Promise<PairSample[]> {
  return page.evaluate(() => {
    const walkBg = (el: Element): string => {
      let cur: Element | null = el;
      while (cur) {
        const bg = getComputedStyle(cur).backgroundColor;
        const parsed = bg.match(
          /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?/,
        );
        if (parsed) {
          const a = parsed[4] === undefined ? 1 : Number(parsed[4]);
          if (a > 0.05) return bg;
        }
        cur = cur.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    const pick = (sel: string): PairSample | null => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') return null;
      return {
        label: sel,
        color: cs.color,
        background: walkBg(el),
      };
    };
    return [
      pick('.login-submit'),
      pick('.login-copy'),
      pick('.login-card h1'),
      pick('.primary-button'),
      pick('.page-heading h1'),
      pick('.page-heading span'),
      pick('.status.green'),
      pick('.status.red'),
    ].filter((x): x is PairSample => x != null);
  });
}

export async function assertContrastAa(
  page: Page,
  theme: string,
): Promise<void> {
  const pairs = await sampleContrastPairs(page);
  expect(pairs.length, `nenhum par de contraste amostrado (${theme})`).toBeGreaterThan(
    0,
  );
  const fails: string[] = [];
  for (const p of pairs) {
    const ratio = contrastRatio(p.color, p.background);
    if (ratio < 4.5) {
      fails.push(
        `${p.label} ${ratio.toFixed(2)}:1 (${p.color} sobre ${p.background})`,
      );
    }
  }
  expect(fails, `contraste AA < 4,5:1 no tema ${theme}: ${fails.join(' | ')}`).toEqual(
    [],
  );
}

const BRAND_HEX = ['f97316', 'c54b07', 'ea580c', 'a53f06'];

function walkFiles(dir: string, acc: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'e2e') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
}

export function brandHexOutsideStyles(srcRoot: string): string[] {
  const hits: string[] = [];
  const files: string[] = [];
  walkFiles(srcRoot, files);
  for (const file of files) {
    if (file.endsWith(`${join('src', 'styles.css')}`) || file.endsWith('/styles.css')) {
      continue;
    }
    const ext = extname(file);
    if (!['.ts', '.tsx', '.js', '.jsx', '.css', '.html'].includes(ext)) continue;
    const text = readFileSync(file, 'utf8');
    const lower = text.toLowerCase();
    for (const hex of BRAND_HEX) {
      if (lower.includes(`#${hex}`)) hits.push(`${file} contém #${hex}`);
    }
    if (['.ts', '.tsx'].includes(ext) && /#[0-9a-fA-F]{3,8}\b/.test(text)) {
      hits.push(`${file} contém hexadecimal solto`);
    }
  }
  return hits;
}
