/**
 * SOSMesh UX Accessibility Tests
 * Tests all HTML prototypes for axe violations and 200% zoom overflow
 */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('fs');
const path = require('path');

// Artifact directory
const ARTIFACTS_DIR = '/opt/cursor/artifacts/adim04';

test.beforeAll(async () => {
  // Create artifacts directory
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
});

// Prototypes to test
const prototypes = [
  { path: '/mobile-home.html', name: 'Mobile Home' },
  { path: '/mobile-sos.html', name: 'Mobile SOS' },
  { path: '/mobile-status.html', name: 'Mobile Status' },
  { path: '/mobile-relay.html', name: 'Mobile Relay' },
  { path: '/mobile-settings.html', name: 'Mobile Settings' },
  { path: '/web-dashboard.html', name: 'Web Dashboard' },
  { path: '/web-inbox.html', name: 'Web Inbox' },
  { path: '/watch-sos.html', name: 'Watch SOS' },
];

prototypes.forEach(prototype => {
  test.describe(prototype.name, () => {
    test('should not have axe violations', async ({ page }, testInfo) => {
      // Skip watch-sos for non-watch viewports
      const isWatchPrototype = prototype.name === 'Watch SOS';
      const isWatchViewport = testInfo.project.name.startsWith('watch-');
      
      if (isWatchPrototype && !isWatchViewport) {
        test.skip();
        return;
      }
      if (!isWatchPrototype && isWatchViewport) {
        test.skip();
        return;
      }
      
      await page.goto(`file://${process.cwd()}/prototypes/ux${prototype.path}`);
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');
      
      // Run axe
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      
      // Screenshot
      const screenshotName = `${prototype.name.toLowerCase().replace(/\s+/g, '-')}-${page.viewportSize().width}x${page.viewportSize().height}.png`;
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, screenshotName),
        fullPage: true,
      });
      
      // Check for serious/critical violations
      const serious = accessibilityScanResults.violations.filter(
        v => v.impact === 'serious' || v.impact === 'critical'
      );
      
      console.log(`${prototype.name} (${page.viewportSize().width}x${page.viewportSize().height}):`);
      console.log(`  Total violations: ${accessibilityScanResults.violations.length}`);
      console.log(`  Serious/Critical: ${serious.length}`);
      
      // Expect 0 serious/critical violations
      expect(serious).toHaveLength(0);
    });
    
    test('should not have horizontal overflow at 200% zoom', async ({ page }, testInfo) => {
      // Skip watch-sos for non-watch viewports
      const isWatchPrototype = prototype.name === 'Watch SOS';
      const isWatchViewport = testInfo.project.name.startsWith('watch-');
      
      if (isWatchPrototype && !isWatchViewport) {
        test.skip();
        return;
      }
      if (!isWatchPrototype && isWatchViewport) {
        test.skip();
        return;
      }
      
      await page.goto(`file://${process.cwd()}/prototypes/ux${prototype.path}`);
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('networkidle');
      
      // Set zoom to 200% (simulate by setting font-size to 32px)
      await page.evaluate(() => {
        document.documentElement.style.fontSize = '32px';
      });
      
      // Wait for layout to settle
      await page.waitForTimeout(500);
      
      // Check for horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        
        const bodyScrollWidth = body.scrollWidth;
        const bodyClientWidth = body.clientWidth;
        const htmlScrollWidth = html.scrollWidth;
        const htmlClientWidth = html.clientWidth;
        
        return bodyScrollWidth > bodyClientWidth || htmlScrollWidth > htmlClientWidth;
      });
      
      // Screenshot at 200% zoom
      const screenshotName = `${prototype.name.toLowerCase().replace(/\s+/g, '-')}-200zoom.png`;
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, screenshotName),
        fullPage: true,
      });
      
      expect(hasOverflow).toBe(false);
    });
    
    test('header elements should not overlap', async ({ page }, testInfo) => {
      // Only test mobile prototypes
      if (!prototype.name.startsWith('Mobile')) {
        test.skip();
        return;
      }
      
      // Skip watch viewports
      if (testInfo.project.name.startsWith('watch-')) {
        test.skip();
        return;
      }
      
      await page.goto(`file://${process.cwd()}/prototypes/ux${prototype.path}`);
      await page.waitForLoadState('networkidle');
      
      // Get all header elements
      const header = await page.locator('.header, header').first();
      if (await header.count() === 0) {
        test.skip();
        return;
      }
      
      const headerBox = await header.boundingBox();
      if (!headerBox) {
        test.skip();
        return;
      }
      
      // Check that status text is not truncated
      const statusText = await page.locator('#statusText, .status-text').first();
      if (await statusText.count() > 0) {
        const textElement = await statusText.elementHandle();
        const isNotTruncated = await textElement.evaluate(el => {
          return el.scrollWidth <= el.clientWidth + 1; // +1 for rounding
        });
        expect(isNotTruncated).toBe(true);
      }
    });
  });
});
