/**
 * Local mock operator API for production-build screenshot capture only.
 * Not imported by the web app; started from playwright.screenshots.config.js.
 */

const http = require('node:http');
const path = require('node:path');
const { sign } = require(path.join(
  __dirname,
  '../../../apps/web/node_modules/jsonwebtoken'
));

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-local-jwt-secret-32chars-min!!';
const E2E_PASSWORD = process.env.OPERATOR_E2E_PASSWORD;

const E2E_OPERATOR_EMAIL = 'e2e-operator@sosmesh.example';
const E2E_ADMIN_EMAIL = 'e2e-admin@sosmesh.example';

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function loginUser(email, password) {
  if (!E2E_PASSWORD || password !== E2E_PASSWORD) {
    return null;
  }
  if (email === E2E_OPERATOR_EMAIL) {
    return {
      sub: 'e2e-operator',
      role: 'OPERATOR',
      user: {
        id: 'e2e-operator',
        email,
        displayName: 'E2E Operator',
        role: 'OPERATOR',
        teamId: null,
      },
    };
  }
  if (email === E2E_ADMIN_EMAIL) {
    return {
      sub: 'e2e-admin',
      role: 'ADMIN',
      user: {
        id: 'e2e-admin',
        email,
        displayName: 'E2E Admin',
        role: 'ADMIN',
        teamId: null,
      },
    };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (url.pathname === '/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/v1/auth/login' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const email = String(body.email || '').trim();
      const password = String(body.password || '');
      const match = loginUser(email, password);
      if (!match) {
        sendJson(res, 401, { code: 'INVALID_CREDENTIALS' });
        return;
      }
      const token = sign(
        { sub: match.sub, role: match.role },
        JWT_SECRET,
        { expiresIn: '1h', algorithm: 'HS256' }
      );
      sendJson(res, 200, { token, user: match.user });
    } catch {
      sendJson(res, 400, { code: 'BAD_REQUEST' });
    }
    return;
  }

  if (url.pathname === '/v1/operator/dashboard/stats' && req.method === 'GET') {
    sendJson(res, 200, {
      newSos: null,
      openOnPanel: null,
      pending: null,
      avgReachSeconds: null,
      hasData: false,
    });
    return;
  }

  if (url.pathname === '/v1/operator/incidents' && req.method === 'GET') {
    sendJson(res, 200, { items: [], nextCursor: null });
    return;
  }

  if (url.pathname === '/v1/operator/organization/context' && req.method === 'GET') {
    sendJson(res, 200, {
      organization: { id: 'e2e-org', name: 'E2E Organization', slug: 'e2e-org' },
      team: null,
      role: 'OPERATOR',
      incidents: [],
    });
    return;
  }

  if (url.pathname === '/v1/operator/cases' && req.method === 'GET') {
    sendJson(res, 200, { items: [], nextCursor: null, limit: 100 });
    return;
  }

  if (url.pathname.startsWith('/v1/operator/cases/') && req.method === 'GET') {
    sendJson(res, 404, { code: 'NOT_FOUND' });
    return;
  }

  if (url.pathname === '/v1/operator/events' && req.method === 'GET') {
    sendJson(res, 200, { events: [] });
    return;
  }

  if (url.pathname === '/v1/auth/me' && req.method === 'GET') {
    sendJson(res, 401, { code: 'UNAUTHORIZED' });
    return;
  }

  sendJson(res, 404, { code: 'NOT_FOUND' });
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`mock-operator-api listening on 127.0.0.1:${PORT}\n`);
});
