/**
 * Case Summary i18n and Close Functionality E2E Tests
 * Verifies operator panel displays case summaries correctly in both languages
 * and supports close/collapse functionality with keyboard shortcuts
 */

import { test, expect } from '@playwright/test';

const SYNTHETIC_CASE_DATA = {
  incidentId: 'test-incident-001',
  messageId: 'test-message-001',
  priority: 3,
  sosType: 'FIRE',
  deliveryState: 'OPERATOR_SEEN',
  locationStatus: 'GPS',
  latitude: 39.925533,
  longitude: 32.866287,
  accuracyMeters: 15,
  receivedAt: new Date().toISOString(),
  originalText: 'Yangın var, yardım edin',
  translatedText: 'There is a fire, please help',
  detectedLanguage: 'Turkish',
};

test.describe('Case Summary Panel i18n', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operator/login');
    await page.fill('[name="email"]', 'test@sosmesh.local');
    await page.fill('[name="password"]', 'test-password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/operator/dashboard');
    await page.goto('/operator/cases');
  });

  test('displays case drawer in Turkish with close button', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'tr', theme: 'light' })
      );
    });
    await page.reload();

    await page.waitForSelector('[data-testid="case-list"]', { timeout: 5000 });
    const firstCase = page.locator('[data-testid^="case-row"]').first();
    await firstCase.click();

    await page.waitForSelector('[data-testid="case-drawer"]', { state: 'visible' });

    expect(await page.locator('[id="case-drawer-title"]').textContent()).toBe('Vaka özeti');

    const closeButton = page.locator('[data-testid="case-drawer-close"]');
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveAttribute('aria-label', 'Vaka özetini kapat');

    await page.screenshot({
      path: 'playwright-screenshots/case-drawer-turkish.png',
      fullPage: false,
    });

    expect(await page.locator('.case-drawer__close svg').count()).toBeGreaterThan(0);
  });

  test('displays case drawer in English with close button', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'light' })
      );
    });
    await page.reload();

    await page.waitForSelector('[data-testid="case-list"]', { timeout: 5000 });
    const firstCase = page.locator('[data-testid^="case-row"]').first();
    await firstCase.click();

    await page.waitForSelector('[data-testid="case-drawer"]', { state: 'visible' });

    expect(await page.locator('[id="case-drawer-title"]').textContent()).toBe('Case summary');

    const closeButton = page.locator('[data-testid="case-drawer-close"]');
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveAttribute('aria-label', 'Close case summary');

    await page.screenshot({
      path: 'playwright-screenshots/case-drawer-english.png',
      fullPage: false,
    });
  });

  test('closes drawer with close button click', async ({ page }) => {
    await page.waitForSelector('[data-testid="case-list"]', { timeout: 5000 });
    const firstCase = page.locator('[data-testid^="case-row"]').first();
    await firstCase.click();

    await page.waitForSelector('[data-testid="case-drawer"]', { state: 'visible' });

    const closeButton = page.locator('[data-testid="case-drawer-close"]');
    await closeButton.click();

    await page.waitForSelector('[data-testid="case-drawer"]', { state: 'hidden' });
    await expect(page.locator('[data-testid="case-drawer"]')).not.toBeVisible();
  });

  test('closes drawer with Escape key', async ({ page }) => {
    await page.waitForSelector('[data-testid="case-list"]', { timeout: 5000 });
    const firstCase = page.locator('[data-testid^="case-row"]').first();
    await firstCase.click();

    await page.waitForSelector('[data-testid="case-drawer"]', { state: 'visible' });

    await page.keyboard.press('Escape');

    await page.waitForSelector('[data-testid="case-drawer"]', { state: 'hidden' });
    await expect(page.locator('[data-testid="case-drawer"]')).not.toBeVisible();
  });

  test('drawer close button has focus on open', async ({ page }) => {
    await page.waitForSelector('[data-testid="case-list"]', { timeout: 5000 });
    const firstCase = page.locator('[data-testid^="case-row"]').first();
    await firstCase.click();

    await page.waitForSelector('[data-testid="case-drawer"]', { state: 'visible' });

    const closeButton = page.locator('[data-testid="case-drawer-close"]');
    await expect(closeButton).toBeFocused();
  });

  test('displays translated message with toggle in Turkish locale', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'tr', theme: 'light' })
      );
    });
    await page.reload();

    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="translated-message"]', { timeout: 5000 });

    const translatedText = page.locator('.translated-message__text');
    await expect(translatedText).toContainText('There is a fire');

    const badge = page.locator('.translated-message__badge');
    await expect(badge).toContainText('Makine çevirisi (AI)');

    await page.screenshot({
      path: 'playwright-screenshots/translated-message-turkish-locale.png',
      fullPage: false,
    });

    const toggleButton = page.locator('[data-testid="toggle-original-text"]');
    await toggleButton.click();

    await expect(translatedText).toContainText('Yangın var');

    await page.screenshot({
      path: 'playwright-screenshots/original-message-shown-turkish-locale.png',
      fullPage: false,
    });
  });

  test('displays translated message with toggle in English locale', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'light' })
      );
    });
    await page.reload();

    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="translated-message"]', { timeout: 5000 });

    const badge = page.locator('.translated-message__badge');
    await expect(badge).toContainText('Machine translation (AI)');

    await page.screenshot({
      path: 'playwright-screenshots/translated-message-english-locale.png',
      fullPage: false,
    });
  });

  test('case detail panel can be collapsed', async ({ page }) => {
    await page.waitForSelector('[data-testid="case-list"]', { timeout: 5000 });
    const firstCase = page.locator('[data-testid^="case-row"]').first();
    await firstCase.click();

    const toggleButton = page.locator('[data-testid="case-detail-panel-toggle"]');
    await expect(toggleButton).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/case-detail-panel-expanded.png',
      fullPage: false,
    });

    await toggleButton.click();

    const panel = page.locator('.cases-detail-panel');
    await expect(panel).toHaveClass(/cases-detail-panel--collapsed/);

    await page.screenshot({
      path: 'playwright-screenshots/case-detail-panel-collapsed.png',
      fullPage: false,
    });
  });

  test('case detail panel expands with Escape when collapsed', async ({ page }) => {
    await page.waitForSelector('[data-testid="case-list"]', { timeout: 5000 });
    const firstCase = page.locator('[data-testid^="case-row"]').first();
    await firstCase.click();

    const toggleButton = page.locator('[data-testid="case-detail-panel-toggle"]');
    await toggleButton.click();

    const panel = page.locator('.cases-detail-panel');
    await expect(panel).toHaveClass(/cases-detail-panel--collapsed/);

    await page.keyboard.press('Escape');

    await expect(panel).not.toHaveClass(/cases-detail-panel--collapsed/);
  });

  test('displays enum labels in correct locale', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'tr', theme: 'light' })
      );
    });
    await page.reload();

    await page.waitForSelector('[data-testid="case-filters"]', { timeout: 5000 });

    const categoryFilter = page.locator('[aria-label="Kategori filtresi"]');
    await expect(categoryFilter).toBeVisible();

    const fireOption = page.locator('option[value="FIRE"]');
    expect(await fireOption.textContent()).toBe('Yangın');

    await page.screenshot({
      path: 'playwright-screenshots/filters-turkish-enums.png',
      fullPage: false,
    });

    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'light' })
      );
    });
    await page.reload();

    const fireOptionEn = page.locator('option[value="FIRE"]');
    expect(await fireOptionEn.textContent()).toBe('Fire');

    await page.screenshot({
      path: 'playwright-screenshots/filters-english-enums.png',
      fullPage: false,
    });
  });
});
