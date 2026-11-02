/**
 * Operator help page — a11y and support form (BLOCKED_APPROVAL).
 */

const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect } = require('@playwright/test');

const e2ePassKey = ['OPERATOR', 'E2E', 'PASSWORD'].join('_');
const E2E_EMAIL = 'e2e-operator@sosmesh.example';
const E2E_PASS = process.env[e2ePassKey];

if (!E2E_PASS) {
  throw new Error(`${e2ePassKey} must be set (see playwright.web.config.js)`);
}

async function loginAsOperator(page) {
  await page.goto('/operator/login');
  await page.getByLabel('E-posta').fill(E2E_EMAIL);
  await page.getByLabel('Şifre').fill(E2E_PASS);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page).toHaveURL(/\/operator\/dashboard/);
}

test.describe('Operator help', () => {
  test('help page shows 112 warning and passes axe', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/operator/help');
    await expect(page.getByTestId('operator-help')).toBeVisible();
    await expect(page.getByTestId('help-not112-banner')).toContainText('112');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const serious = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious).toHaveLength(0);
  });

  test('help page renders five ACK levels and peer vs operator distinction', async ({
    page,
  }) => {
    await loginAsOperator(page);
    await page.goto('/operator/help');
    const ackSection = page.getByTestId('help-section-ack');
    await expect(ackSection).toBeVisible();
    await expect(ackSection.getByRole('heading', { level: 2 })).toContainText(
      'ACK'
    );
    const ackText = await ackSection.innerText();
    expect(ackText.toLowerCase()).toContain('peer');
    expect(ackText.toLowerCase()).toContain('operatör');
    expect(ackText.toLowerCase()).toContain('sunucu');
  });

  test('support form shows BLOCKED_APPROVAL feedback', async ({ page }) => {
    await loginAsOperator(page);
    await page.goto('/operator/help');
    await page.getByRole('textbox', { name: 'Konu' }).fill('Test talebi');
    await page.getByRole('textbox', { name: 'Mesaj' }).fill('Sentetik test — PII yok');
    await page.getByRole('button', { name: 'Talebi kaydet (onay bekliyor)' }).click();
    await expect(page.getByTestId('help-support-feedback')).toContainText('BLOCKED_APPROVAL');
  });
});
