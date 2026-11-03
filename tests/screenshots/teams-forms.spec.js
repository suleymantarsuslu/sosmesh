/**
 * Playwright screenshot test for team and resource forms
 * Run with: npx playwright test tests/screenshots/teams-forms.spec.js
 */

const { test, expect } = require('@playwright/test');

test.describe('Team and Resource Forms Screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/operator/login');
    
    await page.fill('input[type="email"]', 'demo@sosmesh.local');
    await page.fill('input[type="password"]', 'demo');
    await page.click('button[type="submit"]');
    
    await page.waitForURL('**/operator/dashboard');
  });

  test('EN - New Team Form', async ({ page, browserName }) => {
    await page.goto('http://localhost:3000/operator/teams');
    
    const newTeamButton = page.locator('button:has-text("New team")');
    await expect(newTeamButton).toBeVisible();
    await newTeamButton.click();
    
    await page.fill('#team-name', 'Medical Response Team Alpha');
    await page.selectOption('#team-type', 'MEDICAL');
    await page.fill('#team-capacity', '15');
    await page.fill('#team-contact', 'Radio-MED-001');
    await page.selectOption('#team-status', 'ACTIVE');
    await page.fill('#team-zone', 'District-A');
    
    await page.screenshot({
      path: `screenshots/team-form-en-${browserName}.png`,
      fullPage: true,
    });
  });

  test('TR - New Team Form', async ({ page, browserName, context }) => {
    await context.addCookies([
      { name: 'locale', value: 'tr', domain: 'localhost', path: '/' },
    ]);
    
    await page.reload();
    await page.goto('http://localhost:3000/operator/teams');
    
    const newTeamButton = page.locator('button:has-text("Yeni ekip")');
    await expect(newTeamButton).toBeVisible();
    await newTeamButton.click();
    
    await page.fill('#team-name', 'Tıbbi Müdahale Ekibi Alfa');
    await page.selectOption('#team-type', 'MEDICAL');
    await page.fill('#team-capacity', '15');
    await page.fill('#team-contact', 'Telsiz-TIB-001');
    await page.selectOption('#team-status', 'ACTIVE');
    await page.fill('#team-zone', 'Bölge-A');
    
    await page.screenshot({
      path: `screenshots/team-form-tr-${browserName}.png`,
      fullPage: true,
    });
  });

  test('EN - New Resource Form', async ({ page, browserName }) => {
    await page.goto('http://localhost:3000/operator/teams');
    
    const newResourceButton = page.locator('button:has-text("New resource")');
    await expect(newResourceButton).toBeVisible();
    await newResourceButton.click();
    
    await page.fill('#resource-name', 'Ambulance Unit 5');
    await page.selectOption('#resource-kind', 'VEHICLE');
    await page.fill('#resource-capacity', '4');
    await page.fill('#resource-zone', 'District-A');
    
    await page.screenshot({
      path: `screenshots/resource-form-en-${browserName}.png`,
      fullPage: true,
    });
  });

  test('TR - New Resource Form', async ({ page, browserName, context }) => {
    await context.addCookies([
      { name: 'locale', value: 'tr', domain: 'localhost', path: '/' },
    ]);
    
    await page.reload();
    await page.goto('http://localhost:3000/operator/teams');
    
    const newResourceButton = page.locator('button:has-text("Yeni kaynak")');
    await expect(newResourceButton).toBeVisible();
    await newResourceButton.click();
    
    await page.fill('#resource-name', 'Ambulans Ünitesi 5');
    await page.selectOption('#resource-kind', 'VEHICLE');
    await page.fill('#resource-capacity', '4');
    await page.fill('#resource-zone', 'Bölge-A');
    
    await page.screenshot({
      path: `screenshots/resource-form-tr-${browserName}.png`,
      fullPage: true,
    });
  });
});
