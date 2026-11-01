import { isE2eMock } from './config';

/** Visible DEMO MODE banner when operator mock/E2E routes are active (never in production). */
export function shouldShowDemoModeBanner(): boolean {
  return isE2eMock();
}
