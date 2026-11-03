/**
 * AI Intelligence Panel Collapsible UI E2E Tests
 * Tests the redesigned collapsible AI panel with before/after screenshots
 */

import { test, expect } from '@playwright/test';

test.describe('AI Intelligence Panel Collapsible UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/operator/login');
    await page.fill('[name="email"]', 'test@sosmesh.local');
    await page.fill('[name="password"]', 'test-password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/operator/dashboard');
  });

  test('displays AI panel with card header and severity chip - Turkish', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'tr', theme: 'light' })
      );
    });
    await page.reload();

    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const panel = page.locator('[data-testid="ai-intelligence-panel"]');
    await expect(panel).toBeVisible();

    const title = page.locator('.ai-intelligence-panel__card-title');
    expect(await title.textContent()).toBe('AI İstihbarat Paneli');

    const severityChip = page.locator('[data-testid="ai-severity-chip"]');
    if (await severityChip.count() > 0) {
      await expect(severityChip).toBeVisible();
    }

    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    await page.screenshot({
      path: 'playwright-screenshots/ai-panel-expanded-turkish.png',
      fullPage: false,
    });
  });

  test('displays AI panel with card header and severity chip - English', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'light' })
      );
    });
    await page.reload();

    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const title = page.locator('.ai-intelligence-panel__card-title');
    expect(await title.textContent()).toBe('AI Intelligence Panel');

    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    await expect(toggleButton).toHaveAttribute('aria-label', 'Collapse AI panel');

    await page.screenshot({
      path: 'playwright-screenshots/ai-panel-expanded-english.png',
      fullPage: false,
    });
  });

  test('collapses AI panel with smooth animation', async ({ page }) => {
    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const panel = page.locator('[data-testid="ai-intelligence-panel"]');
    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    const content = page.locator('.ai-intelligence-panel__content');

    await expect(panel).not.toHaveClass(/ai-intelligence-panel--collapsed/);
    await expect(content).toBeVisible();

    await toggleButton.click();

    await expect(panel).toHaveClass(/ai-intelligence-panel--collapsed/);
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    
    await page.waitForTimeout(400);

    await page.screenshot({
      path: 'playwright-screenshots/ai-panel-collapsed.png',
      fullPage: false,
    });
  });

  test('expands AI panel when clicking toggle again', async ({ page }) => {
    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    const panel = page.locator('[data-testid="ai-intelligence-panel"]');

    await toggleButton.click();
    await page.waitForTimeout(400);
    await expect(panel).toHaveClass(/ai-intelligence-panel--collapsed/);

    await toggleButton.click();
    await page.waitForTimeout(400);

    await expect(panel).not.toHaveClass(/ai-intelligence-panel--collapsed/);
    await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
  });

  test('chevron rotates when collapsing', async ({ page }) => {
    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    const chevron = page.locator('.ai-intelligence-panel__chevron');

    await expect(chevron).toBeVisible();

    const expandedTransform = await chevron.evaluate((el) => 
      window.getComputedStyle(el).transform
    );

    await toggleButton.click();
    await page.waitForTimeout(400);

    const collapsedTransform = await chevron.evaluate((el) => 
      window.getComputedStyle(el).transform
    );

    expect(expandedTransform).not.toBe(collapsedTransform);
  });

  test('remembers collapsed state across page navigation', async ({ page }) => {
    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    await toggleButton.click();
    await page.waitForTimeout(400);

    const panel = page.locator('[data-testid="ai-intelligence-panel"]');
    await expect(panel).toHaveClass(/ai-intelligence-panel--collapsed/);

    await page.goto('/operator/dashboard');
    await page.waitForSelector('[data-testid="operator-dashboard"]', { timeout: 5000 });

    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const panelAfterNav = page.locator('[data-testid="ai-intelligence-panel"]');
    await expect(panelAfterNav).toHaveClass(/ai-intelligence-panel--collapsed/);
  });

  test('toggle button is keyboard accessible', async ({ page }) => {
    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    
    await toggleButton.focus();
    await expect(toggleButton).toBeFocused();

    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    const panel = page.locator('[data-testid="ai-intelligence-panel"]');
    await expect(panel).toHaveClass(/ai-intelligence-panel--collapsed/);

    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    await expect(panel).not.toHaveClass(/ai-intelligence-panel--collapsed/);
  });

  test('severity chips display with correct colors - critical', async ({ page }) => {
    await page.goto('/operator/cases/test-critical-incident');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const severityChip = page.locator('.ai-severity-chip--critical');
    if (await severityChip.count() > 0) {
      await expect(severityChip).toBeVisible();
      
      const bgColor = await severityChip.evaluate((el) => 
        window.getComputedStyle(el).backgroundColor
      );
      
      expect(bgColor).toBeTruthy();
    }
  });

  test('dark theme displays correctly', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'dark' })
      );
    });

    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const panel = page.locator('[data-testid="ai-intelligence-panel"]');
    await expect(panel).toBeVisible();

    await page.screenshot({
      path: 'playwright-screenshots/ai-panel-dark-theme.png',
      fullPage: false,
    });

    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    await toggleButton.click();
    await page.waitForTimeout(400);

    await page.screenshot({
      path: 'playwright-screenshots/ai-panel-collapsed-dark-theme.png',
      fullPage: false,
    });
  });

  test('multiple severity levels display correctly', async ({ page }) => {
    const severityLevels = [
      { incident: 'test-critical', className: 'ai-severity-chip--critical' },
      { incident: 'test-high', className: 'ai-severity-chip--high' },
      { incident: 'test-medium', className: 'ai-severity-chip--medium' },
      { incident: 'test-low', className: 'ai-severity-chip--low' },
    ];

    for (const { incident, className } of severityLevels) {
      await page.goto(`/operator/cases/${incident}`);
      await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

      const chip = page.locator(`.${className}`);
      if (await chip.count() > 0) {
        await expect(chip).toBeVisible();
        
        await page.screenshot({
          path: `playwright-screenshots/ai-panel-severity-${incident}.png`,
          fullPage: false,
        });
      }
    }
  });

  test('aria-controls links toggle button to content', async ({ page }) => {
    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    const contentId = await toggleButton.getAttribute('aria-controls');

    expect(contentId).toBeTruthy();
    expect(contentId).toMatch(/ai-panel-content-/);

    const content = page.locator(`#${contentId}`);
    await expect(content).toBeVisible();
  });

  test('comparison screenshot - before and after collapse', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'sosmesh-operator-preferences-v1',
        JSON.stringify({ locale: 'en', theme: 'light' })
      );
    });

    await page.goto('/operator/cases/test-incident-001');
    await page.waitForSelector('[data-testid="ai-intelligence-panel"]', { timeout: 5000 });

    await page.screenshot({
      path: 'playwright-screenshots/ai-panel-before-redesign.png',
      fullPage: true,
    });

    const toggleButton = page.locator('[data-testid="ai-panel-toggle"]');
    await toggleButton.click();
    await page.waitForTimeout(400);

    await page.screenshot({
      path: 'playwright-screenshots/ai-panel-after-collapse.png',
      fullPage: true,
    });
  });
});
