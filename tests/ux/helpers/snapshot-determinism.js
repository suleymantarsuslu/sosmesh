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

async function lockLoginFormForSnapshot(page) {
  await page.addStyleTag({
    content: `[data-testid="login-form"]{
      width:420px!important;max-width:420px!important;
      height:190px!important;min-height:190px!important;max-height:190px!important;
      box-sizing:border-box!important;overflow:hidden!important;
      gap:12px!important;padding:0!important;margin:0!important;border:0!important;
      flex-shrink:0!important;
    }
    [data-testid="login-form"] label,
    [data-testid="login-form"] input,
    [data-testid="login-form"] button,
    [data-testid="login-form"] .login-form__error{
      flex-shrink:0!important;margin:0!important;
    }`,
  });
}

module.exports = {
  applyCiSnapshotFontLock,
  lockDashboardVisualCoreForSnapshot,
  lockLoginFormForSnapshot,
};
