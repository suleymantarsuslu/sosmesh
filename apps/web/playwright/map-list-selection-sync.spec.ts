/**
 * Map & List Selection Sync E2E Tests
 * Tests synchronized selection between map markers and case list
 */

import { test, expect } from '@playwright/test';

test.describe('Map & List Selection Sync', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operator/login');
    await page.fill('[name="email"]', 'test@sosmesh.local');
    await page.fill('[name="password"]', 'test-password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/operator/dashboard');
    await page.goto('/operator/cases');
    await page.waitForSelector('[data-testid="operator-cases-view"]', { timeout: 5000 });
  });

  test('clicking case list item opens case drawer', async ({ page }) => {
    await page.waitForSelector('.case-list-panel__card', { timeout: 5000 });

    const firstCard = page.locator('.case-list-panel__card').first();
    await firstCard.click();

    await page.waitForTimeout(300);

    const drawer = page.locator('[data-testid="case-drawer"]');
    await expect(drawer).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/list-click-opens-drawer.png',
      fullPage: false,
    });
  });

  test('clicking case list item highlights the row', async ({ page }) => {
    await page.waitForSelector('.case-list-panel__card', { timeout: 5000 });

    const firstCard = page.locator('.case-list-panel__card').first();
    await firstCard.click();

    await page.waitForTimeout(300);

    await expect(firstCard).toHaveClass(/case-list-panel__card--active/);

    await page.screenshot({
      path: 'playwright-screenshots/list-item-highlighted.png',
      fullPage: false,
    });
  });

  test('clicking case list item centers map on case location', async ({ page }) => {
    await page.waitForSelector('.case-list-panel__card', { timeout: 5000 });

    const firstCard = page.locator('.case-list-panel__card').first();
    await firstCard.click();

    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'playwright-screenshots/map-centered-after-list-click.png',
      fullPage: true,
    });
  });

  test('pressing Enter on focused case list item opens drawer', async ({ page }) => {
    await page.waitForSelector('.case-list-panel__card', { timeout: 5000 });

    const firstCard = page.locator('.case-list-panel__card').first();
    await firstCard.focus();
    await page.keyboard.press('Enter');

    await page.waitForTimeout(300);

    const drawer = page.locator('[data-testid="case-drawer"]');
    await expect(drawer).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/keyboard-enter-opens-drawer.png',
      fullPage: false,
    });
  });

  test('pressing Space on focused case list item opens drawer', async ({ page }) => {
    await page.waitForSelector('.case-list-panel__card', { timeout: 5000 });

    const firstCard = page.locator('.case-list-panel__card').first();
    await firstCard.focus();
    await page.keyboard.press('Space');

    await page.waitForTimeout(300);

    const drawer = page.locator('[data-testid="case-drawer"]');
    await expect(drawer).toBeVisible();
  });

  test('selecting case on map highlights corresponding list item', async ({ page }) => {
    await page.waitForSelector('.operator-map__pin--modern', { timeout: 5000 });

    const firstPin = page.locator('.operator-map__pin--modern').first();
    await firstPin.click();

    await page.waitForTimeout(500);

    const activeCard = page.locator('.case-list-panel__card--active');
    await expect(activeCard).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/map-click-highlights-list.png',
      fullPage: true,
    });
  });

  test('selecting case on map scrolls list to selected item', async ({ page }) => {
    await page.waitForSelector('.operator-map__pin--modern', { timeout: 5000 });

    const pins = page.locator('.operator-map__pin--modern');
    const pinCount = await pins.count();
    
    if (pinCount > 3) {
      const lastPin = pins.nth(pinCount - 1);
      await lastPin.click();

      await page.waitForTimeout(500);

      const activeCard = page.locator('.case-list-panel__card--active');
      await expect(activeCard).toBeVisible();
    }
  });

  test('list and map selection stays in sync', async ({ page }) => {
    await page.waitForSelector('.case-list-panel__card', { timeout: 5000 });

    const firstCard = page.locator('.case-list-panel__card').first();
    await firstCard.click();
    await page.waitForTimeout(300);

    await expect(firstCard).toHaveClass(/case-list-panel__card--active/);

    const selectedPin = page.locator('.operator-map__pin--selected');
    await expect(selectedPin).toBeVisible();

    const secondCard = page.locator('.case-list-panel__card').nth(1);
    await secondCard.click();
    await page.waitForTimeout(300);

    await expect(secondCard).toHaveClass(/case-list-panel__card--active/);
    await expect(firstCard).not.toHaveClass(/case-list-panel__card--active/);

    await page.screenshot({
      path: 'playwright-screenshots/selection-sync.png',
      fullPage: true,
    });
  });

  test('approximate location case centers map on circle center', async ({ page }) => {
    const approximateCard = page.locator('.case-list-panel__card').filter({ has: page.locator('.case-list-panel__location-badge') }).first();
    
    if (await approximateCard.count() > 0) {
      await approximateCard.click();
      await page.waitForTimeout(2000);

      const approximateCircle = page.locator('.operator-map__approximate-circle');
      await expect(approximateCircle).toBeVisible();

      await page.screenshot({
        path: 'playwright-screenshots/approximate-location-centered.png',
        fullPage: true,
      });
    }
  });

  test('case without location does not crash when selected', async ({ page }) => {
    await page.goto('/operator/cases?seedCount=1');
    await page.waitForSelector('[data-testid="operator-cases-view"]', { timeout: 5000 });

    const unknownLocationCard = page.locator('.case-list-panel__card').filter({ hasText: 'UNKNOWN' }).first();
    
    if (await unknownLocationCard.count() > 0) {
      await unknownLocationCard.click();
      await page.waitForTimeout(500);

      const drawer = page.locator('[data-testid="case-drawer"]');
      await expect(drawer).toBeVisible();
    }
  });

  test('aria-pressed attribute reflects selection state', async ({ page }) => {
    await page.waitForSelector('.case-list-panel__card', { timeout: 5000 });

    const firstCard = page.locator('.case-list-panel__card').first();
    
    await expect(firstCard).toHaveAttribute('aria-pressed', 'false');

    await firstCard.click();
    await page.waitForTimeout(300);

    await expect(firstCard).toHaveAttribute('aria-pressed', 'true');
  });
});
