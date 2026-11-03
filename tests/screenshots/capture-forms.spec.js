/**
 * Capture screenshots of team and resource forms
 */

const { test } = require('@playwright/test');
const path = require('path');

test.describe('Form Screenshots', () => {
  test('Team Form - EN', async ({ page }) => {
    const filePath = path.join(__dirname, '../../screenshots/team-form-demo-en.html');
    await page.goto(`file://${filePath}`);
    await page.screenshot({
      path: path.join(__dirname, '../../screenshots/team-form-en.png'),
      fullPage: false,
    });
  });

  test('Team Form - TR', async ({ page }) => {
    const filePath = path.join(__dirname, '../../screenshots/team-form-demo-tr.html');
    await page.goto(`file://${filePath}`);
    await page.screenshot({
      path: path.join(__dirname, '../../screenshots/team-form-tr.png'),
      fullPage: false,
    });
  });

  test('Resource Form - EN', async ({ page }) => {
    const filePath = path.join(__dirname, '../../screenshots/resource-form-demo-en.html');
    await page.goto(`file://${filePath}`);
    await page.screenshot({
      path: path.join(__dirname, '../../screenshots/resource-form-en.png'),
      fullPage: false,
    });
  });

  test('Resource Form - TR', async ({ page }) => {
    const filePath = path.join(__dirname, '../../screenshots/resource-form-demo-tr.html');
    await page.goto(`file://${filePath}`);
    await page.screenshot({
      path: path.join(__dirname, '../../screenshots/resource-form-tr.png'),
      fullPage: false,
    });
  });
});
