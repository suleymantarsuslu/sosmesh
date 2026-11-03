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
const sharp = require('sharp');

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET =
  process.env.JWT_SECRET || 'e2e-local-jwt-secret-32chars-min!!';
const mockOperatorPass = process.env.OPERATOR_E2E_PASSWORD;

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
  if (!mockOperatorPass || password !== mockOperatorPass) {
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

// Generate synthetic test image with shapes (800x600)
async function generateTestImage() {
  const width = 800;
  const height = 600;
  
  // Create base image with gray background
  const svg = `
    <svg width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="#808080"/>
      <circle cx="200" cy="250" r="60" fill="#4a4a4a" stroke="#000" stroke-width="2"/>
      <rect x="300" y="250" width="200" height="150" fill="#666" stroke="#000" stroke-width="2"/>
      <circle cx="180" cy="230" r="10" fill="#fff"/>
      <circle cx="220" cy="230" r="10" fill="#fff"/>
    </svg>
  `;
  
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

// Generate mask PNG for a bounding box
async function generateMaskPng(width, height) {
  // Create a simple mask shape (white on transparent)
  const svg = `
    <svg width="${width}" height="${height}">
      <ellipse cx="${width/2}" cy="${height/2}" rx="${width*0.4}" ry="${height*0.45}" fill="white"/>
    </svg>
  `;
  
  return sharp(Buffer.from(svg)).png().toBuffer();
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

  if (url.pathname.match(/^\/v1\/operator\/cases\/[^/]+\/detail$/) && req.method === 'GET') {
    const incidentId = url.pathname.split('/')[4];
    sendJson(res, 200, {
      incidentId,
      state: 'PENDING',
      reviewStatus: 'REVIEWED',
      version: 1,
      originalText: 'Help! Three people trapped under collapsed building at downtown area. Building is unstable, need immediate rescue.',
      verifiedMetadata: {
        personCount: 3,
        locationStatus: 'GPS',
        latitude: 41.0082,
        longitude: 28.9784,
        accuracyMeters: 15
      },
      ai: null,
      timeline: [
        {
          id: 'evt-1',
          deliveryState: 'SERVER_ACCEPTED',
          source: 'BLE Relay',
          createdAt: new Date(Date.now() - 600000).toISOString()
        },
        {
          id: 'evt-2',
          deliveryState: 'OPERATOR_SEEN',
          source: 'Operator Panel',
          createdAt: new Date(Date.now() - 300000).toISOString()
        }
      ],
      audit: [
        {
          id: 'audit-1',
          action: 'CASE_OPENED',
          actorId: 'e2e-operator',
          actorDisplayName: 'E2E Operator',
          createdAt: new Date(Date.now() - 300000).toISOString(),
          before: null,
          after: null
        }
      ]
    });
    return;
  }

  // AI endpoint must come BEFORE the catch-all 404
  if (url.pathname.match(/^\/v1\/operator\/cases\/[^/]+\/ai$/) && req.method === 'GET') {
    const incidentId = url.pathname.split('/')[4];
    
    // Generate mask PNGs
    const mask1 = await generateMaskPng(120, 150);
    const mask2 = await generateMaskPng(200, 180);
    
    sendJson(res, 200, {
      triage: {
        status: 'completed',
        modelVersion: 'muse-spark-1.3',
        eventType: 'Building Collapse',
        reportedPersonCount: 3,
        needs: ['Medical Assistance', 'Rescue Equipment', 'Structural Assessment'],
        hazards: ['Unstable Structure', 'Potential Gas Leak'],
        urgencySuggestion: 'critical',
        missingInfo: ['Exact building address', 'Number of floors affected'],
        summary: 'Three people reported trapped in collapsed residential building. Structure appears unstable with visible cracks and debris.',
        nextStepSuggestion: 'Immediate deployment of urban search and rescue team with structural engineer assessment.',
        sourceQuotes: [
          { text: 'Three people trapped under collapsed building', field: 'noteText' },
          { text: 'Building is unstable', field: 'transcript' }
        ],
        translation: {
          language: 'tr',
          text: 'Yıkılan binada üç kişi mahsur kaldı. Acil yardım gerekli.',
          uncertain: false
        },
        followUpQuestions: [
          'Are you in a safe location to communicate?',
          'Can you hear any sounds from the trapped individuals?'
        ],
        operatorOverride: null,
        analyzedAt: new Date().toISOString()
      },
      transcript: {
        attachmentId: 'mock-audio-1',
        model: 'muse-voice-transcribe-1.0',
        transcript: 'Help, we are three people trapped under a collapsed building. Please send help immediately. The building is unstable.',
        turns: [
          {
            turnId: 1,
            startMs: 0,
            endMs: 4200,
            transcript: 'Help, we are three people trapped under a collapsed building.',
            speaker: 'A'
          },
          {
            turnId: 2,
            startMs: 4200,
            endMs: 7500,
            transcript: 'Please send help immediately. The building is unstable.',
            speaker: 'A'
          }
        ],
        language: 'en',
        audioDurationMs: 7500,
        createdAt: new Date().toISOString()
      },
      sparkVision: {
        attachmentId: 'mock-photo-1',
        model: 'muse-spark-1.3',
        summary: {
          description: 'Collapsed multi-story residential building with visible structural damage. Debris scattered across the area. Two people visible in the image near the damaged structure.',
          visibleObjects: ['debris', 'damaged building', 'people', 'rubble'],
          estimatedPersonCount: 2,
          hazardsVisible: ['structural collapse', 'falling debris'],
          uncertainty: 'Image quality and angle limit full assessment of the collapse extent.'
        },
        analyzedAt: new Date().toISOString()
      },
      samVision: {
        attachmentId: 'mock-photo-1',
        model: 'sam-3.1',
        imageWidth: 800,
        imageHeight: 600,
        segments: [
          {
            id: 'seg-1',
            concept: 'person',
            confidence: 0.95,
            box: { x: 0.15, y: 0.25, w: 0.15, h: 0.25 },
            maskPng: 'data:image/png;base64,' + mask1.toString('base64')
          },
          {
            id: 'seg-2',
            concept: 'debris',
            confidence: 0.87,
            box: { x: 0.375, y: 0.30, w: 0.25, h: 0.30 },
            maskPng: 'data:image/png;base64,' + mask2.toString('base64')
          }
        ],
        analyzedAt: new Date().toISOString()
      },
      linkSuggestions: [
        {
          id: 'link-1',
          incidentAId: incidentId,
          incidentBId: 'incident-nearby-1',
          score: 0.85,
          deterministicSignals: {
            distanceMeters: 120,
            timeDeltaSeconds: 180,
            locationProximity: true,
            timeProximity: true,
            sosTypeMatch: true,
            tokenOverlap: 0.6
          },
          aiRationale: 'Both incidents report collapsed building in same neighborhood within 3 minutes. Likely the same event reported by different witnesses.',
          status: 'suggested',
          decidedBy: null,
          decidedAt: null,
          createdAt: new Date(Date.now() - 300000).toISOString()
        }
      ]
    });
    return;
  }

  // Catch-all for unmatched /v1/operator/cases/* paths
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

  // AI dashboard status endpoint
  if (url.pathname === '/v1/operator/ai/status' && req.method === 'GET') {
    sendJson(res, 200, {
      enabled: true,
      circuitState: 'closed',
      budgetUsedToday: 12.50,
      budgetTotalLimit: 150,
      budgetDailyLimit: 30,
      lastAnalysisAt: new Date().toISOString(),
      queueDepth: 2,
      modelsAvailable: { spark: true, asr: true, sam: true },
    });
    return;
  }

  if (url.pathname.match(/^\/v1\/operator\/attachments\/[^/]+\/image$/) && req.method === 'GET') {
    // Return generated synthetic JPEG
    const jpeg = await generateTestImage();
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': jpeg.length });
    res.end(jpeg);
    return;
  }

  if (url.pathname.match(/^\/v1\/operator\/attachments\/[^/]+\/audio$/) && req.method === 'GET') {
    // Return minimal WAV header (silence)
    const wav = Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', 'base64');
    res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': wav.length });
    res.end(wav);
    return;
  }

  sendJson(res, 404, { code: 'NOT_FOUND' });
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`mock-operator-api listening on 127.0.0.1:${PORT}\n`);
});
