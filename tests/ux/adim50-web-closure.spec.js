/**
 * ADIM 50 — Web güvenlik, erişilebilirlik ve responsive kapanış (operator panel).
 */

const { test, expect } = require('@playwright/test');

const {
  E2E_CASE_GPS_ID,
  attachHydrationListeners,
  expectNoBlockerAxeViolations,
  expectNoHorizontalOverflow,
  loginAsAdmin,
  loginAsOperator,
  requireE2ePassword,
} = require('./helpers/web-e2e');

const VIEWPORT_WIDTHS = [320, 390, 768, 1024, 1440, 1920];

const CRITICAL_FLOWS = [
  {
    name: 'giriş',
    prepare: async (page) => {
      await page.goto('/operator/login');
      await page.waitForLoadState('domcontentloaded');
    },
    ready: (page) => page.getByTestId('login-form'),
  },
  {
    name: 'dashboard',
    prepare: async (page) => {
      await loginAsOperator(page);
      await page.goto('/operator/dashboard');
    },
    ready: (page) => page.getByTestId('operator-dashboard'),
  },
  {
    name: 'vaka listesi',
    prepare: async (page) => {
      await loginAsOperator(page);
      await page.goto('/operator/cases');
    },
    ready: (page) => page.getByTestId('operator-cases-view'),
  },
  {
    name: 'harita',
    prepare: async (page) => {
      await loginAsOperator(page);
      await page.goto('/operator/cases');
    },
    ready: (page) => page.getByTestId('operator-map'),
  },
  {
    name: 'vaka detayı',
    prepare: async (page) => {
      await loginAsOperator(page);
      await page.goto(`/operator/cases/${E2E_CASE_GPS_ID}`);
    },
    ready: (page) => page.getByTestId('operator-case-detail'),
  },
  {
    name: 'atama görevleri',
    prepare: async (page) => {
      await loginAsOperator(page);
      await page.goto('/operator/tasks');
    },
    ready: (page) => page.getByTestId('operator-tasks'),
  },
  {
    name: 'ayarlar (dil/tema)',
    prepare: async (page) => {
      await loginAsOperator(page);
      await page.goto('/operator/dashboard');
    },
    ready: (page) => page.getByTestId('theme-locale-controls'),
  },
];

test.describe('ADIM 50 axe WCAG 2.2 AA (kritik akışlar)', () => {
  for (const flow of CRITICAL_FLOWS) {
    test(`axe blocker = 0 — ${flow.name}`, async ({ page }) => {
      await flow.prepare(page);
      await expect(flow.ready(page)).toBeVisible();
      await expectNoBlockerAxeViolations(page);
    });
  }
});

test.describe('ADIM 50 klavye tam akış', () => {
  test('login → skip link → vaka listesi yalnız klavye', async ({ page }) => {
    const password = requireE2ePassword();
    await page.goto('/operator/login');
    await page.getByLabel('E-posta').focus();
    await page.keyboard.type('e2e-operator@sosmesh.example');
    await page.keyboard.press('Tab');
    await page.keyboard.type(password);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/operator\/dashboard/);

    await page.locator('a.skip-link').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#operator-main')).toBeFocused();

    await page.getByRole('link', { name: 'Harita / Vakalar' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/operator\/cases/);
    await expect(page.getByTestId('operator-cases-view')).toBeVisible();
  });
});

test.describe('ADIM 50 responsive genişlikler', () => {
  for (const width of VIEWPORT_WIDTHS) {
    test(`yatay taşma yok — ${width}px vaka listesi`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await loginAsOperator(page);
      await page.goto('/operator/cases');
      await expect(page.getByTestId('operator-cases-view')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe('ADIM 50 %200 zoom reflow', () => {
  test('giriş formu yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto('/operator/login');
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('dashboard yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await loginAsOperator(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await expect(page.getByTestId('operator-dashboard')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('ADIM 50 prefers-reduced-motion görsel regresyon', () => {
  test('giriş ekranı reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/operator/login');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page).toHaveScreenshot('adim50-login-reduced-motion.png', {
      fullPage: true,
    });
  });

  test('dashboard reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loginAsOperator(page);
    await expect(page.getByTestId('operator-dashboard')).toBeVisible();
    await expect(page).toHaveScreenshot('adim50-dashboard-reduced-motion.png', {
      fullPage: true,
    });
  });
});

test.describe('ADIM 50 SSR / hydration', () => {
  test('dashboard ve vaka listesinde hydration hatası yok', async ({ page }) => {
    const hydrationErrors = [];
    attachHydrationListeners(page, hydrationErrors);
    await loginAsOperator(page);
    await page.goto('/operator/cases');
    await page.waitForLoadState('networkidle');
    expect(hydrationErrors).toEqual([]);
  });
});

test.describe('ADIM 50 yavaş ağ ve offline yeniden bağlanma', () => {
  test('yavaş 3G ile giriş formu görünür kalır', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (500 * 1024) / 8,
      uploadThroughput: (500 * 1024) / 8,
      latency: 400,
    });
    await page.goto('/operator/login', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 45000 });
  });

  test('offline olay poll banner sonra temizlenir', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/operator/dashboard');
    await page.route('**/api/operator/events**', (route) => route.abort('failed'));
    await expect(page.getByTestId('connection-disconnected')).toBeVisible({
      timeout: 15000,
    });
    await page.unroute('**/api/operator/events**');
    await expect(page.getByTestId('connection-disconnected')).toHaveCount(0, {
      timeout: 20000,
    });
  });
});

test.describe('ADIM 50 rol-yetki rota assertion', () => {
  test('oturumsuz dashboard login yönlendirmesi', async ({ page }) => {
    await page.goto('/operator/dashboard');
    await expect(page).toHaveURL(/\/operator\/login/);
  });

  test('operatör admin rotasında denied', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/operator/admin');
    await expect(page.getByTestId('role-denied')).toBeVisible();
  });

  test('admin admin rotasına erişir', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/operator/admin');
    await expect(page.getByRole('heading', { name: 'Yönetim' })).toBeVisible();
  });

  test('Nest API operatör JWT ile admin users uç noktasında 403', () => {
    const path = require('node:path');
    const { spawnSync } = require('node:child_process');
    const repoRoot = path.join(__dirname, '../..');
    const result = spawnSync(
      'pnpm',
      [
        '--filter',
        '@sosmesh/api',
        'exec',
        'jest',
        '--config',
        'jest.config.ts',
        'test/security-adim43.spec.ts',
        '-t',
        'returns 403 when OPERATOR calls admin-only route',
        '--runInBand',
      ],
      { cwd: repoRoot, encoding: 'utf8', env: process.env, timeout: 180000 }
    );
    if (result.status !== 0) {
      throw new Error(
        `API RBAC guard test failed (exit ${result.status}): ${result.stderr || result.stdout}`
      );
    }
    expect(result.status).toBe(0);
  });
});

test.describe('ADIM 50 mobil navigasyon erişilebilirliği', () => {
  test('390px menü çekmecesi klavye ile vaka listesine gider', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsOperator(page);
    await page.goto('/operator/dashboard');
    await page.getByRole('button', { name: 'Menüyü aç' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('link', { name: 'Harita / Vakalar' }).click();
    await expect(page).toHaveURL(/\/operator\/cases/);
    await expect(page.getByTestId('operator-cases-view')).toBeVisible();
  });
});
