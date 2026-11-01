import { RequestHandler } from 'express';

/** Baseline response headers for operator/API surfaces (ADIM 43). */
export const securityHeadersMiddleware: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
};
