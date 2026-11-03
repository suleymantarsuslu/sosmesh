/**
 * Marketing landing sections (EN default + TR switch).
 */

const { test, expect } = require('@playwright/test');

test.describe('Marketing landing', () => {
  test('renders all public sections in English', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('marketing-hero')).toBeVisible();
    await expect(page.getByTestId('marketing-how-it-works')).toBeVisible();
    await expect(page.getByTestId('marketing-features')).toBeVisible();
    await expect(page.getByTestId('marketing-platforms')).toBeVisible();
    await expect(page.getByTestId('marketing-security')).toBeVisible();
    await expect(page.getByTestId('marketing-limitations')).toBeVisible();
    await expect(page.getByTestId('marketing-faq')).toBeVisible();
    await expect(page.getByTestId('marketing-footer')).toContainText('112');
    await expect(page.getByTestId('marketing-nav-operator-login')).toHaveAttribute(
      'href',
      '/operator/login'
    );
  });

  test('mobile nav toggle exposes section links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.getByTestId('marketing-nav-toggle').click();
    await expect(page.locator('#marketing-nav-links a[href="#faq"]')).toBeVisible();
  });

  test('Turkish locale updates hero CTA copy', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('locale-switcher-select').selectOption('tr');
    await expect(page.getByTestId('marketing-operator-login')).toHaveText(
      'Operatör paneline giriş'
    );
  });
});
