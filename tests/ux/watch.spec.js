/**
 * SOSMesh UX Accessibility Tests - Watch Prototypes
 * Tests watch-specific prototypes
 */

const fs = require('fs');
const path = require('path');

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

// Artifact directory
const ARTIFACTS_DIR = '/opt/cursor/artifacts/adim04';

test.beforeAll(async () => {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
});

// Watch prototypes
const prototypes = [
  { path: '/watch-sos.html', name: 'Watch SOS' },
];

prototypes.forEach(prototype => {
  test.describe(prototype.name, () => {
    test('should not have axe violations', async ({ page }) => {
      await page.goto(`file://${process.cwd()}/prototypes/ux${prototype.path}`);
      await page.waitForLoadState('networkidle');
      
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      
      const screenshotName = `${prototype.name.toLowerCase().replace(/\s+/g, '-')}-${page.viewportSize().width}x${page.viewportSize().height}.png`;
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, screenshotName),
        fullPage: true,
      });
      
      const serious = accessibilityScanResults.violations.filter(
        v => v.impact === 'serious' || v.impact === 'critical'
      );
      
      console.log(`${prototype.name} (${page.viewportSize().width}x${page.viewportSize().height}):`);
      console.log(`  Total violations: ${accessibilityScanResults.violations.length}`);
      console.log(`  Serious/Critical: ${serious.length}`);
      
      expect(serious).toHaveLength(0);
    });
    
    test('should not have horizontal overflow at 200% zoom', async ({ page }) => {
      await page.goto(`file://${process.cwd()}/prototypes/ux${prototype.path}`);
      await page.waitForLoadState('networkidle');
      
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
      });
      await page.waitForTimeout(500);
      
      const hasOverflow = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        return body.scrollWidth > body.clientWidth || html.scrollWidth > html.clientWidth;
      });
      
      const screenshotName = `${prototype.name.toLowerCase().replace(/\s+/g, '-')}-200zoom.png`;
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, screenshotName),
        fullPage: true,
      });
      
      expect(hasOverflow).toBe(false);
    });
    
    test('cancel dialog should be visible and clickable', async ({ page }) => {
      await page.goto(`file://${process.cwd()}/prototypes/ux${prototype.path}`);
      await page.waitForLoadState('networkidle');
      
      const sosButton = await page.locator('#sosButtonWatch');
      await sosButton.dispatchEvent('pointerdown');
      await page.waitForTimeout(3200);
      
      const cancelDialog = await page.locator('#cancelDialog');
      await expect(cancelDialog).toBeVisible();
      
      const cancelButton = await page.locator('#cancelButton');
      await expect(cancelButton).toBeVisible();
      
      const buttonBox = await cancelButton.boundingBox();
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
      
      const screenshotName = `watch-cancel-${page.viewportSize().width}x${page.viewportSize().height}.png`;
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, screenshotName),
        fullPage: true,
      });
      
      await cancelButton.click();
      await page.waitForTimeout(500);
      
      const cancelledScreen = await page.locator('#cancelledScreen');
      await expect(cancelledScreen).toBeVisible();
      
      const cancelledMessage = await page.locator('.cancelled-message');
      expect(await cancelledMessage.textContent()).toContain('gönderilmedi');
      
      const statusScreenshotName = `watch-status-${page.viewportSize().width}x${page.viewportSize().height}.png`;
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, statusScreenshotName),
        fullPage: true,
      });
    });
  });
});
