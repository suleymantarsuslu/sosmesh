/**
 * SOSMesh Web Skeleton A11y Test
 * Tests Next.js homepage for accessibility violations
 */

const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect } = require('@playwright/test');

test.describe('Web Skeleton Accessibility', () => {
  test('should have no axe violations on homepage', async ({ page }) => {
    // Navigate to Next.js homepage (uses baseURL from config)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    // Filter serious/critical violations
    const serious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );

    // Log results
    console.log('Web Skeleton A11y Test:');
    console.log(`  Total violations: ${accessibilityScanResults.violations.length}`);
    console.log(`  Serious/Critical: ${serious.length}`);

    // Check lang attribute
    const lang = await page.locator('html').getAttribute('lang');
    console.log(`  Lang attribute: ${lang}`);
    expect(lang).toBe('tr');

    // Check for SOSMesh text
    const content = await page.textContent('body');
    expect(content).toContain('SOSMesh');
    console.log(`  Contains 'SOSMesh': true`);

    // Check for 112 warning
    expect(content).toContain('112');
    console.log(`  Contains '112' warning: true`);

    // Expect 0 serious/critical violations
    expect(serious).toHaveLength(0);
  });
});
