/**
 * E2E test for operator menu panel visibility fix (PR #96 follow-up).
 * Verifies that the user menu and overflow menu panels are fully visible
 * and not clipped behind the topbar.
 */

const { test, expect } = require('@playwright/test');
const { loginAsOperator } = require('./helpers/web-e2e');

test.describe('Operator menu panel visibility', () => {
  test('user menu is visible and logout button clickable at desktop width light theme', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await loginAsOperator(page);

    await expect(page.getByTestId('operator-topbar-user')).toBeVisible();

    await page.getByTestId('operator-topbar-user').click();

    await page.waitForSelector('.operator-user-menu__panel', { state: 'visible', timeout: 2000 });

    const logoutButton = page.locator('.operator-user-menu__logout');
    await expect(logoutButton).toBeVisible();

    const logoutBox = await logoutButton.boundingBox();
    expect(logoutBox).not.toBeNull();

    const centerX = logoutBox.x + logoutBox.width / 2;
    const centerY = logoutBox.y + logoutBox.height / 2;

    const elementAtCenter = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return {
          tagName: el?.tagName,
          className: el?.className,
          matches: el?.matches('.operator-user-menu__logout, .operator-user-menu__logout *'),
        };
      },
      { x: centerX, y: centerY }
    );

    expect(elementAtCenter.matches).toBe(true);

    await page.screenshot({
      path: 'reports/operator-menu-desktop-light.png',
      fullPage: false,
    });
  });

  test('user menu is visible and logout button clickable at desktop width dark theme', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await loginAsOperator(page);

    await page.getByTestId('operator-topbar-user').click();

    await page.waitForSelector('.operator-user-menu__panel', { state: 'visible', timeout: 2000 });

    const logoutButton = page.locator('.operator-user-menu__logout');
    await expect(logoutButton).toBeVisible();

    const logoutBox = await logoutButton.boundingBox();
    expect(logoutBox).not.toBeNull();

    const centerX = logoutBox.x + logoutBox.width / 2;
    const centerY = logoutBox.y + logoutBox.height / 2;

    const elementAtCenter = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return {
          matches: el?.matches('.operator-user-menu__logout, .operator-user-menu__logout *'),
        };
      },
      { x: centerX, y: centerY }
    );

    expect(elementAtCenter.matches).toBe(true);

    await page.screenshot({
      path: 'reports/operator-menu-desktop-dark.png',
      fullPage: false,
    });
  });

  test('user menu is visible at mobile width light theme', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    await loginAsOperator(page);

    await page.getByTestId('operator-topbar-user').click();

    await page.waitForSelector('.operator-user-menu__panel', { state: 'visible', timeout: 2000 });

    const logoutButton = page.locator('.operator-user-menu__logout');
    await expect(logoutButton).toBeVisible();

    const logoutBox = await logoutButton.boundingBox();
    expect(logoutBox).not.toBeNull();

    const centerX = logoutBox.x + logoutBox.width / 2;
    const centerY = logoutBox.y + logoutBox.height / 2;

    const elementAtCenter = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return {
          matches: el?.matches('.operator-user-menu__logout, .operator-user-menu__logout *'),
        };
      },
      { x: centerX, y: centerY }
    );

    expect(elementAtCenter.matches).toBe(true);

    await page.screenshot({
      path: 'reports/operator-menu-mobile-light.png',
      fullPage: false,
    });
  });

  test('user menu is visible at mobile width dark theme', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await loginAsOperator(page);

    await page.getByTestId('operator-topbar-user').click();

    await page.waitForSelector('.operator-user-menu__panel', { state: 'visible', timeout: 2000 });

    const logoutButton = page.locator('.operator-user-menu__logout');
    await expect(logoutButton).toBeVisible();

    const logoutBox = await logoutButton.boundingBox();
    expect(logoutBox).not.toBeNull();

    const centerX = logoutBox.x + logoutBox.width / 2;
    const centerY = logoutBox.y + logoutBox.height / 2;

    const elementAtCenter = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return {
          matches: el?.matches('.operator-user-menu__logout, .operator-user-menu__logout *'),
        };
      },
      { x: centerX, y: centerY }
    );

    expect(elementAtCenter.matches).toBe(true);

    await page.screenshot({
      path: 'reports/operator-menu-mobile-dark.png',
      fullPage: false,
    });
  });

  test('overflow menu is visible at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    await loginAsOperator(page);

    await page.getByTestId('operator-topbar-overflow').click();

    await page.waitForSelector('.operator-topbar-overflow__panel', {
      state: 'visible',
      timeout: 2000,
    });

    const panel = page.locator('.operator-topbar-overflow__panel');
    await expect(panel).toBeVisible();

    const panelBox = await panel.boundingBox();
    expect(panelBox).not.toBeNull();

    const centerX = panelBox.x + panelBox.width / 2;
    const centerY = panelBox.y + 20;

    const elementAtCenter = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return {
          matches: el?.closest('.operator-topbar-overflow__panel') !== null,
        };
      },
      { x: centerX, y: centerY }
    );

    expect(elementAtCenter.matches).toBe(true);

    await page.screenshot({
      path: 'reports/operator-overflow-menu-mobile-light.png',
      fullPage: false,
    });
  });
});
