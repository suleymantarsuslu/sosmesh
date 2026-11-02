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
      width:420px!important;max-width:420px!important;box-sizing:border-box;
    }`,
  });
}

module.exports = {
  applyCiSnapshotFontLock,
  lockDashboardVisualCoreForSnapshot,
  lockLoginFormForSnapshot,
};
