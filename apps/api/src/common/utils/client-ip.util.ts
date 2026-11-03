import { Request } from 'express';

export function getClientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}
