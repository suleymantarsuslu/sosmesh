import type { NextFunction, Request, Response } from 'express';

import { isDisasterReadOnlyModeEnabled } from './disaster.config';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function disasterReadOnlyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isDisasterReadOnlyModeEnabled()) {
    next();
    return;
  }
  if (READ_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }
  res.status(503).json({
    code: 'DISASTER_READ_ONLY',
    message: 'Write operations are disabled while disaster read-only mode is active.',
  });
}
