/**
 * SOSMesh Web Skeleton A11y Test
 * Tests Next.js homepage for accessibility violations
 */

const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect } = require('@playwright/test');

test.describe('Web Skeleton Accessibility', () => {
  test('should have no axe violations on homepage (English default)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const serious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );

    console.log('Web Skeleton A11y Test:');
    console.log(`  Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`  Serious/Critical: ${serious.length}`);

    const lang = await page.locator('html').getAttribute('lang');
    console.log(`  Lang attribute: ${lang}`);
    expect(lang).toBe('en');

    const content = await page.textContent('body');
    expect(content).toContain('SOSMesh');
    console.log(`  Contains 'SOSMesh': true`);

    expect(content).toContain('112');
    console.log(`  Contains '112' warning: true`);

    expect(content).not.toContain('Implementation pending');

    await expect(page.getByTestId('marketing-home')).toBeVisible();
    await expect(page.getByTestId('marketing-not112-banner')).toBeVisible();
    await expect(page.getByTestId('sosmesh-logo').first()).toBeVisible();
    const operatorLogin = page.getByTestId('marketing-operator-login');
    await expect(operatorLogin).toBeVisible();
    await expect(operatorLogin).toHaveAttribute('href', '/operator/login');
    await expect(operatorLogin).toHaveText('Sign in to operator panel');

    expect(serious).toHaveLength(0);
  });

  test('switches homepage copy to Turkish when locale is TR', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('locale-switcher-select').selectOption('tr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    await expect(page.getByTestId('marketing-operator-login')).toHaveText(
      'Operatör paneline giriş'
    );
    await expect(page.getByTestId('marketing-not112-banner')).toContainText(
      '112 resmî acil çağrı hizmetinin yerine geçmez'
    );
  });
});
