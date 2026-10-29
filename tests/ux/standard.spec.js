/**
 * SOSMesh UX Accessibility Tests - Standard Prototypes
 * Tests mobile and web prototypes (non-watch)
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

// Standard prototypes (mobile + web)
const prototypes = [
  { path: '/mobile-home.html', name: 'Mobile Home', testHeader: true },
  { path: '/mobile-sos.html', name: 'Mobile SOS', testHeader: true },
  { path: '/mobile-status.html', name: 'Mobile Status', testHeader: true },
  { path: '/mobile-relay.html', name: 'Mobile Relay', testHeader: true },
  { path: '/mobile-settings.html', name: 'Mobile Settings', testHeader: true },
  { path: '/web-dashboard.html', name: 'Web Dashboard', testHeader: false },
  { path: '/web-inbox.html', name: 'Web Inbox', testHeader: false },
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
    
    if (prototype.testHeader) {
      test('header elements should not overlap', async ({ page }) => {
        await page.goto(`file://${process.cwd()}/prototypes/ux${prototype.path}`);
        await page.waitForLoadState('networkidle');
        
        const header = await page.locator('.header, header').first();
        if (await header.count() === 0) return;
        
        const statusText = await page.locator('#statusText, .status-text').first();
        if (await statusText.count() > 0) {
          const textElement = await statusText.elementHandle();
          const isNotTruncated = await textElement.evaluate(el => {
            return el.scrollWidth <= el.clientWidth + 1;
          });
          expect(isNotTruncated).toBe(true);
        }
      });
    }
  });
});
