import * as http from 'http';

import { PrismaService } from './prisma/prisma.service';
import { workerLivenessBody, workerReadiness } from './worker-health.util';

export function createWorkerHealthRequestListener(prisma: PrismaService): http.RequestListener {
  return (req, res) => {
    void (async () => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(workerLivenessBody()));
        return;
      }
      if (req.url === '/health/ready') {
        const result = await workerReadiness(prisma);
        res.writeHead(result.ok ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
        return;
      }
      res.writeHead(404);
      res.end();
    })();
  };
}
