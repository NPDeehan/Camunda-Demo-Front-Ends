/// <reference types="bun-types" />
import express from 'express';
import { Readable } from 'stream';
import path from 'path';
import type { Request, Response } from 'express';
import { ASSETS } from './src/dist-manifest';

// Load .env from the directory the binary is run from
const envFile = Bun.file(path.join(process.cwd(), '.env'));
if (await envFile.exists()) {
  const text = await envFile.text();
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const CAMUNDA_BASE_URL = process.env.CAMUNDA_BASE_URL;
const OAUTH_URL = process.env.CAMUNDA_OAUTH_URL;
const CLIENT_ID = process.env.CAMUNDA_CLIENT_ID;
const CLIENT_SECRET = process.env.CAMUNDA_CLIENT_SECRET;
const AUDIENCE = process.env.CAMUNDA_TOKEN_AUDIENCE || 'zeebe.camunda.io';
const PORT = Number(process.env.PORT) || 3001;

if (!CAMUNDA_BASE_URL || !OAUTH_URL || !CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    '\nError: Missing required Camunda credentials.\n' +
    'Create a .env file in the same directory as this binary with:\n\n' +
    '  CAMUNDA_BASE_URL=https://bru-2.zeebe.camunda.io/<cluster-id>/v2\n' +
    '  CAMUNDA_OAUTH_URL=https://login.cloud.camunda.io/oauth/token\n' +
    '  CAMUNDA_CLIENT_ID=...\n' +
    '  CAMUNDA_CLIENT_SECRET=...\n' +
    '  CAMUNDA_TOKEN_AUDIENCE=zeebe.camunda.io\n'
  );
  process.exit(1);
}

const app = express();
app.use(express.json());

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const res = await fetch(OAUTH_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      audience: AUDIENCE,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token request failed: ${res.status} ${res.statusText}`);
  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

// Proxy /api/* to Camunda
app.all('/api/*path', async (req: Request, res: Response) => {
  const camundaPath = req.originalUrl.replace('/api', '');
  const contentType = (req.headers['content-type'] ?? '') as string;
  const isMultipart = contentType.startsWith('multipart/form-data');

  try {
    const token = await getToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let body: BodyInit | undefined;

    if (['GET', 'HEAD'].includes(req.method)) {
      body = undefined;
    } else if (isMultipart) {
      headers['Content-Type'] = contentType;
      body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body);
    }

    const upstream = await fetch(`${CAMUNDA_BASE_URL!.replace(/\/$/, '')}${camundaPath}`, {
      method: req.method,
      headers,
      body,
      // @ts-expect-error not in RequestInit types yet
      duplex: 'half',
    });

    res.status(upstream.status);
    if (upstream.status === 204) return res.end();
    const text = await upstream.text();
    if (!text) return res.end();
    try {
      res.json(JSON.parse(text));
    } catch {
      res.type('text/plain').send(text);
    }
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: (err as Error).message });
  }
});

// Serve embedded frontend (compiled into the binary via --embed ./dist)
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

app.get('/{*splat}', async (req: Request, res: Response) => {
  const urlPath = req.path === '/' ? '/index.html' : req.path;
  const assetPath = ASSETS[urlPath];
  const file = assetPath ? Bun.file(assetPath) : Bun.file(ASSETS['/index.html']);
  const ext = assetPath ? path.extname(urlPath).toLowerCase() : '.html';

  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  res.send(Buffer.from(await file.arrayBuffer()));
});

app.listen(PORT, () => {
  console.log(`\nCamunda Demo Hub running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop.\n');
});
