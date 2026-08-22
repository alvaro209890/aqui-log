import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PAGES,
  adminPassword,
  attachConsole,
  assertContrastAa,
  assertNoHorizontalOverflow,
  brandHexOutsideStyles,
  login,
  requireAdminPassword,
  seedCourierEmail,
  seedCourierName,
  setTheme,
  snapshot,
} from './helpers';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

test('zero hexadecimal de marca fora de styles.css', () => {
  const hits = brandHexOutsideStyles(srcRoot);
  expect(hits, hits.join('\n')).toEqual([]);
});

async function sweep(
  page: Page,
  theme: 'light' | 'dark',
  errors: string[],
): Promise<void> {
  await page.setViewportSize({ width: 430, height: 900 });
  for (const p of PAGES) {
    errors.length = 0;
    await page.goto(p.path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const heading = page.locator('.page-heading h1, .login-card h1').first();
    await expect(heading, `${p.name} (${theme}) deve carregar`).toBeVisible({
      timeout: 15_000,
    });
    await assertNoHorizontalOverflow(page, `${p.name}/${theme}`);
    expect(
      errors,
      `console/pageerror em ${p.name} (${theme}): ${errors.join(' | ')}`,
    ).toHaveLength(0);
  }
}

async function assertHistoricalDefects(page: Page, theme: string): Promise<void> {
  await page.goto('/couriers', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const queue = page.locator('.approval-queue');
  await expect(queue, `fila de aprovação ausente (${theme})`).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    queue.locator('.approval-identity strong').first(),
    `fila sem nome (${theme})`,
  ).toContainText(seedCourierName);
  if (seedCourierEmail) {
    await expect(
      queue.locator('.approval-identity span').first(),
      `fila sem e-mail (${theme}) — regressão ADMIN-02A`,
    ).toContainText(seedCourierEmail);
  }

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const chart = page.getByTestId('chart-deliveries-by-status');
  await expect(chart, `pizza de status ausente (${theme})`).toBeVisible({
    timeout: 15_000,
  });
  const paths = chart.locator('svg path');
  await expect(
    paths.first(),
    `gráfico não desenha setor (${theme}) — regressão Recharts 3.9`,
  ).toBeVisible({ timeout: 10_000 });
  expect(
    await paths.count(),
    `pizza sem path SVG (${theme})`,
  ).toBeGreaterThan(0);

  await page.goto('/deliveries', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const delivered = page.locator('.status.green').filter({ hasText: /entregue/i }).first();
  const canceled = page.locator('.status.red').filter({ hasText: /cancelad/i }).first();
  await expect(delivered, `selo Entregue ausente (${theme})`).toBeVisible();
  await expect(canceled, `selo Cancelada ausente (${theme})`).toBeVisible();
  const deliveredColor = await delivered.evaluate((el) => getComputedStyle(el).color);
  const canceledColor = await canceled.evaluate((el) => getComputedStyle(el).color);
  expect(
    deliveredColor,
    `DELIVERED e CANCELED com a mesma cor (${theme}): ${deliveredColor}`,
  ).not.toEqual(canceledColor);

  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Modo agendado' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Reoferta por aneis' }),
  ).toBeVisible();
}

test('QA-02 painel: varredura claro', async ({ page }) => {
  requireAdminPassword();
  expect(adminPassword, 'senha nao pode ir vazia ao login').not.toBe('');
  const errors = attachConsole(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await assertContrastAa(page, 'login-claro');
  await snapshot(page, 'qa-02-login-claro');
  await login(page);
  await setTheme(page, 'light');
  await sweep(page, 'light', errors);
  await assertHistoricalDefects(page, 'claro');
  await page.goto('/deliveries', { waitUntil: 'domcontentloaded' });
  await assertContrastAa(page, 'claro');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await snapshot(page, 'qa-02-overview-claro');
  await page.goto('/couriers', { waitUntil: 'domcontentloaded' });
  await snapshot(page, 'qa-02-fila-aprovacao-claro');
  await page.goto('/deliveries', { waitUntil: 'domcontentloaded' });
  await snapshot(page, 'qa-02-entregas-claro');
  await page.goto('/settings', { waitUntil: 'domcontentloaded' });
  await snapshot(page, 'qa-02-settings-claro');
});

test('QA-02 painel: varredura escuro', async ({ page }) => {
  requireAdminPassword();
  const errors = attachConsole(page);
  await login(page);
  await setTheme(page, 'dark');
  await sweep(page, 'dark', errors);
  await assertHistoricalDefects(page, 'escuro');
  await page.goto('/deliveries', { waitUntil: 'domcontentloaded' });
  await assertContrastAa(page, 'escuro');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await snapshot(page, 'qa-02-overview-escuro');
});
