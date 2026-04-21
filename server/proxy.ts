import express from 'express';
import { Readable } from 'stream';

const app = express();
app.use(express.json());

const CAMUNDA_BASE_URL = process.env.CAMUNDA_BASE_URL!;
const OAUTH_URL = process.env.CAMUNDA_OAUTH_URL!;
const CLIENT_ID = process.env.CAMUNDA_CLIENT_ID!;
const CLIENT_SECRET = process.env.CAMUNDA_CLIENT_SECRET!;
const AUDIENCE = process.env.CAMUNDA_TOKEN_AUDIENCE || 'zeebe.camunda.io';

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const res = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      audience: AUDIENCE,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

// Proxy all /api/* requests to Camunda
app.all('/api/*path', async (req, res) => {
  const camundaPath = req.originalUrl.replace('/api', '');
  const contentType = (req.headers['content-type'] ?? '') as string;
  const isMultipart = contentType.startsWith('multipart/form-data');

  try {
    const token = await getToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let body: BodyInit | undefined;

    if (['GET', 'HEAD'].includes(req.method)) {
      body = undefined;
    } else if (isMultipart) {
      // Preserve Content-Type including the multipart boundary
      headers['Content-Type'] = contentType;
      // Stream the raw request body — express.json() does not consume multipart
      body = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(req.body);
    }

    const upstream = await fetch(`${CAMUNDA_BASE_URL}${camundaPath}`, {
      method: req.method,
      headers,
      body,
      // Required by Node.js fetch when body is a ReadableStream
      // @ts-expect-error not in RequestInit types yet
      duplex: 'half',
    });

    res.status(upstream.status);
    if (upstream.status === 204) return res.end();
    const responseBody = await upstream.json();
    res.json(responseBody);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(502).json({ error: (err as Error).message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Camunda proxy running on http://localhost:${PORT}`);
  console.log(`Proxying to: ${CAMUNDA_BASE_URL}`);
});
