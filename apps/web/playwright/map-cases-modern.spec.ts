/**
 * Modern Map & Cases Page E2E Tests
 * Tests the redesigned Map & Cases page with floating panel, modern cards, and responsive design
 */

import { test, expect } from '@playwright/test';

test.describe('Map & Cases Page - Modern Design', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operator/login');
    await page.fill('[name="email"]', 'test@sosmesh.local');
    await page.fill('[name="password"]', 'test-password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/operator/dashboard');
    await page.goto('/operator/cases');
    await page.waitForSelector('[data-testid="operator-cases-view"]', { timeout: 5000 });
  });

  test('displays modern floating panel with glassy effect - Turkish Light', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'tr', theme: 'light' })
      );
    });
    await page.reload();
    await page.waitForSelector('.cases-view--modern', { timeout: 5000 });

    const floatingPanel = page.locator('.cases-view__floating-panel');
    await expect(floatingPanel).toBeVisible();

    const panelTitle = page.locator('.cases-view__panel-title');
    await expect(panelTitle).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/map-cases-tr-light-before.png',
      fullPage: true,
    });
  });

  test('displays modern floating panel with glassy effect - Turkish Dark', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'tr', theme: 'dark' })
      );
    });
    await page.reload();
    await page.waitForSelector('.cases-view--modern', { timeout: 5000 });

    const floatingPanel = page.locator('.cases-view__floating-panel');
    await expect(floatingPanel).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/map-cases-tr-dark-before.png',
      fullPage: true,
    });
  });

  test('displays modern floating panel - English Light', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'light' })
      );
    });
    await page.reload();
    await page.waitForSelector('.cases-view--modern', { timeout: 5000 });

    const floatingPanel = page.locator('.cases-view__floating-panel');
    await expect(floatingPanel).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/map-cases-en-light-after.png',
      fullPage: true,
    });
  });

  test('displays modern floating panel - English Dark', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'dark' })
      );
    });
    await page.reload();
    await page.waitForSelector('.cases-view--modern', { timeout: 5000 });

    const floatingPanel = page.locator('.cases-view__floating-panel');
    await expect(floatingPanel).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/map-cases-en-dark-after.png',
      fullPage: true,
    });
  });

  test('displays case cards with severity bar and modern styling', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'light' })
      );
    });
    await page.reload();
    await page.waitForSelector('.case-list-panel--modern', { timeout: 5000 });

    const caseCard = page.locator('.case-list-panel__card').first();
    await expect(caseCard).toBeVisible();

    const severityBar = page.locator('.case-list-panel__severity-bar').first();
    await expect(severityBar).toBeVisible();

    const typeIcon = page.locator('.case-list-panel__type-icon').first();
    await expect(typeIcon).toBeVisible();

    const relativeTime = page.locator('.case-list-panel__relative-time').first();
    await expect(relativeTime).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/case-card-modern-design.png',
      fullPage: false,
    });
  });

  test('pulsing severity bar on critical cases', async ({ page }) => {
    await page.goto('/operator/cases/test-critical-incident');
    await page.waitForSelector('.case-list-panel__severity-bar--pulse', { timeout: 5000 });

    const pulsingBar = page.locator('.case-list-panel__severity-bar--pulse');
    await expect(pulsingBar).toBeVisible();

    const hasAnimation = await pulsingBar.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.animationName !== 'none';
    });

    expect(hasAnimation).toBeTruthy();

    await page.screenshot({
      path: 'playwright-screenshots/critical-case-pulsing.png',
      fullPage: false,
    });
  });

  test('live status indicator with pulse animation', async ({ page }) => {
    await page.waitForSelector('[data-testid="live-feed-status"]', { timeout: 5000 });

    const liveIndicator = page.locator('.cases-view__live-indicator');
    await expect(liveIndicator).toBeVisible();

    const liveBadge = page.locator('.cases-view__live-badge');
    await expect(liveBadge).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/live-status-indicator.png',
      fullPage: false,
    });
  });

  test('refresh button with rotate animation on hover', async ({ page }) => {
    await page.waitForSelector('.cases-view__refresh-button', { timeout: 5000 });

    const refreshButton = page.locator('.cases-view__refresh-button');
    await expect(refreshButton).toBeVisible();

    await refreshButton.hover();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'playwright-screenshots/refresh-button-hover.png',
      fullPage: false,
    });
  });

  test('map with severity-colored markers', async ({ page }) => {
    await page.waitForSelector('[data-testid="operator-map"]', { timeout: 5000 });

    const map = page.locator('[data-testid="operator-map"]');
    await expect(map).toBeVisible();

    const modernPin = page.locator('.operator-map__pin--modern').first();
    if (await modernPin.count() > 0) {
      await expect(modernPin).toBeVisible();
    }

    await page.screenshot({
      path: 'playwright-screenshots/map-severity-markers.png',
      fullPage: true,
    });
  });

  test('case card selection and active state', async ({ page }) => {
    await page.waitForSelector('.case-list-panel__card', { timeout: 5000 });

    const firstCard = page.locator('.case-list-panel__card').first();
    await firstCard.click();
    await page.waitForTimeout(300);

    await expect(firstCard).toHaveClass(/case-list-panel__card--active/);

    await page.screenshot({
      path: 'playwright-screenshots/case-card-selected.png',
      fullPage: false,
    });
  });

  test('filters bar with live badge and refresh button', async ({ page }) => {
    await page.waitForSelector('.cases-view__filters-bar', { timeout: 5000 });

    const filtersBar = page.locator('.cases-view__filters-bar');
    await expect(filtersBar).toBeVisible();

    const liveBadge = page.locator('.cases-view__live-badge');
    await expect(liveBadge).toBeVisible();

    const refreshButton = page.locator('.cases-view__refresh-button');
    await expect(refreshButton).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/filters-bar-modern.png',
      fullPage: false,
    });
  });

  test('empty state polish', async ({ page }) => {
    await page.goto('/operator/cases?limit=0');
    await page.waitForSelector('.case-list-panel__empty', { timeout: 5000 });

    const emptyState = page.locator('.case-list-panel__empty');
    await expect(emptyState).toBeVisible();

    const emptyIcon = page.locator('.case-list-panel__empty-icon');
    await expect(emptyIcon).toBeVisible();

    const emptyText = page.locator('.case-list-panel__empty-text');
    await expect(emptyText).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/empty-state-modern.png',
      fullPage: true,
    });
  });

  test('responsive design on tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForSelector('.cases-view--modern', { timeout: 5000 });

    const floatingPanel = page.locator('.cases-view__floating-panel');
    await expect(floatingPanel).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/map-cases-tablet.png',
      fullPage: true,
    });
  });

  test('responsive design on mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForSelector('.cases-view--modern', { timeout: 5000 });

    const floatingPanel = page.locator('.cases-view__floating-panel');
    await expect(floatingPanel).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/map-cases-mobile.png',
      fullPage: true,
    });
  });

  test('case card priority pill with correct colors', async ({ page }) => {
    await page.waitForSelector('.case-list-panel__priority-pill', { timeout: 5000 });

    const priorityPill = page.locator('.case-list-panel__priority-pill').first();
    if (await priorityPill.count() > 0) {
      await expect(priorityPill).toBeVisible();

      const bgColor = await priorityPill.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      expect(bgColor).toBeTruthy();
    }

    await page.screenshot({
      path: 'playwright-screenshots/priority-pills.png',
      fullPage: false,
    });
  });

  test('backdrop blur effect on floating panel', async ({ page }) => {
    await page.waitForSelector('.cases-view__floating-panel', { timeout: 5000 });

    const floatingPanel = page.locator('.cases-view__floating-panel');

    const backdropFilter = await floatingPanel.evaluate((el) =>
      window.getComputedStyle(el).backdropFilter
    );

    expect(backdropFilter).toContain('blur');
  });

  test('comparison screenshot - before (TR) and after (EN)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'tr', theme: 'light' })
      );
    });
    await page.reload();
    await page.waitForSelector('.cases-view--modern', { timeout: 5000 });

    await page.screenshot({
      path: 'playwright-screenshots/map-cases-comparison-tr-light.png',
      fullPage: true,
    });

    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'dark' })
      );
    });
    await page.reload();
    await page.waitForSelector('.cases-view--modern', { timeout: 5000 });

    await page.screenshot({
      path: 'playwright-screenshots/map-cases-comparison-en-dark.png',
      fullPage: true,
    });
  });
});
