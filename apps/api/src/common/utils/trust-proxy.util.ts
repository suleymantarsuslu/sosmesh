import { INestApplication } from '@nestjs/common';

export function applyTrustProxy(
  app: INestApplication,
  trustProxyValue: string | undefined,
): void {
  if (!trustProxyValue) {
    return;
  }

  const expressApp = app.getHttpAdapter().getInstance();
  const numericHops = Number(trustProxyValue);

  if (!isNaN(numericHops) && numericHops > 0) {
    expressApp.set('trust proxy', numericHops);
  } else if (trustProxyValue.toLowerCase() === 'true') {
    expressApp.set('trust proxy', true);
  } else if (trustProxyValue.includes('/') || trustProxyValue.includes(',')) {
    expressApp.set('trust proxy', trustProxyValue.split(',').map((s) => s.trim()));
  } else {
    try {
      const logger = app.get('Logger', { strict: false });
      if (logger && typeof logger.warn === 'function') {
        logger.warn(
          `Invalid TRUST_PROXY value: "${trustProxyValue}". Expected: number, "true", or CIDR list. Trust proxy not configured.`,
        );
      }
    } catch {
      console.warn(
        `Invalid TRUST_PROXY value: "${trustProxyValue}". Expected: number, "true", or CIDR list. Trust proxy not configured.`,
      );
    }
  }
}
