/**
 * Playwright snapshot rendering aligned with GitHub-hosted ubuntu-latest + --with-deps.
 * System UI fonts (-apple-system vs DejaVu) otherwise cause >2% pixel drift.
 */

async function applyCiSnapshotFontLock(page) {
  await page.addStyleTag({
    content: `html, body, * , *::before, *::after {
      font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif !important;
      font-variant-ligatures: none !important;
      -webkit-font-smoothing: antialiased !important;
      text-rendering: geometricPrecision !important;
    }`,
  });
}

async function lockDashboardVisualCoreForSnapshot(page) {
  await page.addStyleTag({
    content: `[data-testid="dashboard-visual-core"]{
      height:420px!important;min-height:420px!important;max-height:420px!important;
      overflow:hidden!important;box-sizing:border-box;
    }
    [data-testid="dashboard-visual-core"] .dashboard__header{flex-wrap:nowrap!important}`,
  });
}

const LOGIN_FORM_SNAPSHOT_FRAME_TEST_ID = 'login-form-snapshot-frame';

async function lockLoginFormForSnapshot(page) {
  await page.addStyleTag({
    content: `[data-testid="login-form"]{
      width:420px!important;max-width:420px!important;
      box-sizing:border-box!important;margin:0!important;border:0!important;
      gap:12px!important;padding:0!important;
      flex-shrink:0!important;
    }
    [data-testid="login-form"] label,
    [data-testid="login-form"] input,
    [data-testid="login-form"] button,
    [data-testid="login-form"] .login-form__error{
      flex-shrink:0!important;margin:0!important;
    }`,
  });
  await page.evaluate((frameTestId) => {
    const form = document.querySelector('[data-testid="login-form"]');
    if (!form) {
      return;
    }
    if (document.querySelector(`[data-testid="${frameTestId}"]`)) {
      return;
    }
    const frame = document.createElement('div');
    frame.setAttribute('data-testid', frameTestId);
    frame.style.width = '420px';
    frame.style.height = '191px';
    frame.style.overflow = 'hidden';
    frame.style.boxSizing = 'border-box';
    const parent = form.parentNode;
    if (!parent) {
      return;
    }
    parent.insertBefore(frame, form);
    frame.appendChild(form);
  }, LOGIN_FORM_SNAPSHOT_FRAME_TEST_ID);
}

module.exports = {
  LOGIN_FORM_SNAPSHOT_FRAME_TEST_ID,
  applyCiSnapshotFontLock,
  lockDashboardVisualCoreForSnapshot,
  lockLoginFormForSnapshot,
};
