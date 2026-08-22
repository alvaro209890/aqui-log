import { test, expect, type Page } from '@playwright/test';

const PAGES = [
  { path: '/', name: 'Overview' },
  { path: '/deliveries', name: 'Deliveries' },
  { path: '/map', name: 'Map' },
  { path: '/couriers', name: 'Couriers' },
  { path: '/users', name: 'Users' },
  { path: '/finance', name: 'Finance' },
  { path: '/reports', name: 'Reports' },
  { path: '/ratings', name: 'Ratings' },
  { path: '/audit', name: 'Audit' },
  { path: '/settings', name: 'Settings' },
  { path: '/alerts', name: 'Alerts' },
] as const;

const adminEmail = process.env.QA_ADMIN_EMAIL || 'admin@aquilog.com.br';
const adminPassword = process.env.QA_ADMIN_PASSWORD || '';
const seedCourierEmail = process.env.QA_SEED_COURIER_EMAIL || '';
const seedDeliveredId = process.env.QA_SEED_DELIVERED_ID || '';
const seedCanceledId = process.env.QA_SEED_CANCELED_ID || '';

async function login(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => {});
  const email = page.getByLabel(/e-?mail/i);
  const password = page.getByLabel(/senha/i);
  await email.fill(adminEmail);
  await password.fill(adminPassword);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL('**/', { timeout: 15_000 }).catch(() => {});
  await page.waitForSelector('body', { timeout: 15_000 });
}

async function toggleTheme(page: Page) {
  const btn = page.locator(
    'button[title="Usar tema escuro"], button[title="Usar tema claro"]',
  );
  await btn.first().click();
  await page.waitForTimeout(400);
}

async function sweep(page: Page, theme: string) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await login(page);

  // viewport estreito p/ checar overflow horizontal
  await page.setViewportSize({ width: 430, height: 900 });

  for (const p of PAGES) {
    consoleErrors.length = 0;
    pageErrors.length = 0;
    await page.goto(p.path, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(600);
    const title = await page.title().catch(() => '');
    expect(title, `${p.name} (${theme}) deve carregar`).toBeTruthy();

    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      return de.scrollWidth - de.clientWidth;
    });
    expect(
      overflow,
      `overflow horizontal em ${p.name} (${theme}): ${overflow}px`,
    ).toBeLessThanOrEqual(2);

    expect(
      pageErrors,
      `pageerror em ${p.name} (${theme}): ${pageErrors.join(' | ')}`,
    ).toHaveLength(0);
    expect(
      consoleErrors,
      `console.error em ${p.name} (${theme}): ${consoleErrors.join(' | ')}`,
    ).toHaveLength(0);
  }

  // Defeitos históricos (só quando há dado semeado)
  if (seedCourierEmail) {
    await page.goto('/couriers', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(500);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(
      body.includes(seedCourierEmail.toLowerCase()),
      `fila de aprovação não mostra o e-mail do candidato (${seedCourierEmail})`,
    ).toBeTruthy();
  }
  if (seedDeliveredId && seedCanceledId) {
    await page.goto('/deliveries', { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText();
    expect(
      body,
      'entregas não listam entregue e cancelado com rótulos distintos',
    ).toMatch(/entregue/i);
    expect(
      body,
      'entregas não listam entregue e cancelado com rótulos distintos',
    ).toMatch(/cancelad[oa]/i);
  }

  // Gráfico de pizza desenha setores (svg com paths) em Reports
  await page.goto('/reports', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(800);
  const svgPaths = await page.locator('svg path').count();
  expect(svgPaths, 'gráfico não desenha nenhum setor (svg path)').toBeGreaterThan(0);
}

test('QA-02 painel: varredura claro', async ({ page }) => {
  await sweep(page, 'claro');
});

test('QA-02 painel: varredura escuro', async ({ page }) => {
  await login(page);
  await toggleTheme(page);
  await sweep(page, 'escuro');
});
