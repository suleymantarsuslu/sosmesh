/**
 * Capture walkthrough screenshots (run explicitly; not part of default CI match).
 */

const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');

const { loginAsOperator } = require('./helpers/web-e2e');

const ARTIFACTS = path.join(__dirname, '../../artifacts/web-modern');
const PREF_KEY = 'sosmesh-operator-preferences-v1';

async function freshEnglishContext(browser) {
  const context = await browser.newContext();
  await context.addInitScript((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }, PREF_KEY);
  await context.clearCookies();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByTestId('locale-switcher-select').selectOption('en');
  await page.reload({ waitUntil: 'networkidle' });
  return { context, page };
}

test.describe('Web modern screenshots', () => {
  test.beforeAll(() => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
  });

  test('capture marketing and operator views', async ({ browser }) => {
    const { context: enCtx, page: enPage } = await freshEnglishContext(browser);
    await enPage.setViewportSize({ width: 1440, height: 900 });
    await enPage.goto('/');
    await enPage.screenshot({
      path: path.join(ARTIFACTS, 'marketing-home-en-1440.png'),
      fullPage: true,
    });

    await enPage.setViewportSize({ width: 375, height: 812 });
    await enPage.goto('/');
    await enPage.screenshot({
      path: path.join(ARTIFACTS, 'marketing-home-en-375.png'),
      fullPage: true,
    });
    await enCtx.close();

    const trCtx = await browser.newContext();
    await trCtx.clearCookies();
    const trPage = await trCtx.newPage();
    await trPage.setViewportSize({ width: 1440, height: 900 });
    await trPage.goto('/');
    await trPage.getByTestId('locale-switcher-select').selectOption('tr');
    await trPage.reload({ waitUntil: 'networkidle' });
    await trPage.screenshot({
      path: path.join(ARTIFACTS, 'marketing-home-tr-1440.png'),
      fullPage: true,
    });
    await trCtx.close();

    const { context: opCtx, page: opPage } = await freshEnglishContext(browser);
    await opPage.setViewportSize({ width: 1440, height: 900 });
    await opPage.goto('/operator/login');
    await expect(opPage.getByTestId('operator-login-page')).toBeVisible();
    await opPage.screenshot({
      path: path.join(ARTIFACTS, 'operator-login-en-1440.png'),
      fullPage: true,
    });

    await loginAsOperator(opPage);
    await opPage.goto('/operator/dashboard');
    await expect(opPage.getByTestId('operator-dashboard')).toBeVisible();
    await expect(opPage.getByTestId('locale-switcher-select')).toHaveValue('en');
    await opPage.screenshot({
      path: path.join(ARTIFACTS, 'operator-dashboard-en-1440.png'),
      fullPage: true,
    });

    await opPage.goto('/operator/cases');
    await expect(opPage.getByTestId('operator-cases-view')).toBeVisible();
    await opPage.screenshot({
      path: path.join(ARTIFACTS, 'operator-cases-en-1440.png'),
      fullPage: true,
    });
    await opCtx.close();
  });

  test('capture operator panel screenshots production', async ({ browser }) => {
    const { context: opCtx, page: opPage } = await freshEnglishContext(browser);
    await opPage.setViewportSize({ width: 1440, height: 900 });
    await loginAsOperator(opPage);
    await opPage.goto('/operator/dashboard');
    await expect(opPage.getByTestId('operator-dashboard')).toBeVisible();
    await expect(opPage.getByTestId('locale-switcher-select')).toHaveValue('en');
    await opPage.screenshot({
      path: path.join(ARTIFACTS, 'operator-dashboard-en-1440.png'),
      fullPage: true,
    });

    await opPage.goto('/operator/cases');
    await expect(opPage.getByTestId('operator-cases-view')).toBeVisible();
    await opPage.screenshot({
      path: path.join(ARTIFACTS, 'operator-cases-en-1440.png'),
      fullPage: true,
    });
    await opCtx.close();
  });

  test('capture responsive operator panel screenshots', async ({ browser }) => {
    const assertNoHorizontalOverflow = async (page) => {
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth > root.clientWidth + 1;
      });
      expect(overflow).toBe(false);
    };

    const assertTopbarInViewport = async (page) => {
      const offenders = await page.evaluate(() => {
        const bar = document.querySelector('[data-testid="operator-topbar"]');
        if (!bar) {
          return [];
        }
        const viewportWidth = document.documentElement.clientWidth;
        const items = bar.querySelectorAll('[data-topbar-item]');
        const problems = [];
        items.forEach((el) => {
          const rect = el.getBoundingClientRect();
          if (rect.right > viewportWidth + 0.5 || rect.left < -0.5) {
            problems.push({
              item: el.getAttribute('data-topbar-item'),
              left: rect.left,
              right: rect.right,
              viewportWidth,
            });
          }
        });
        return problems;
      });
      expect(offenders).toEqual([]);
    };

    const { context: opCtx, page: opPage } = await freshEnglishContext(browser);

    await opPage.setViewportSize({ width: 375, height: 812 });
    await opPage.goto('/operator/login');
    await expect(opPage.getByTestId('operator-login-page')).toBeVisible();
    await assertNoHorizontalOverflow(opPage);
    await opPage.screenshot({
      path: path.join(ARTIFACTS, 'operator-login-en-375.png'),
      fullPage: true,
    });

    await loginAsOperator(opPage);
    await opPage.goto('/operator/dashboard');
    await expect(opPage.getByTestId('operator-dashboard')).toBeVisible();
    await assertNoHorizontalOverflow(opPage);
    await assertTopbarInViewport(opPage);
    await opPage.screenshot({
      path: path.join(ARTIFACTS, 'operator-dashboard-en-375.png'),
      fullPage: true,
    });

    await opPage.getByTestId('operator-hamburger').click();
    await expect(opPage.getByTestId('operator-mobile-nav-drawer')).toBeVisible();
    await assertNoHorizontalOverflow(opPage);
    await opPage.screenshot({
      path: path.join(ARTIFACTS, 'operator-dashboard-en-375-drawer-open.png'),
      fullPage: true,
    });
    await opPage.getByTestId('mobile-nav-close').click();

    await opPage.goto('/operator/cases');
    await expect(opPage.getByTestId('operator-cases-view')).toBeVisible();
    await assertNoHorizontalOverflow(opPage);
    await assertTopbarInViewport(opPage);
    await opPage.screenshot({
      path: path.join(ARTIFACTS, 'operator-cases-en-375.png'),
      fullPage: true,
    });

    await opCtx.close();
  });
});
