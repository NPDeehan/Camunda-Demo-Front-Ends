import express from 'express';
import type { Request, Response } from 'express';
import { Readable } from 'stream';

const app = express();
app.use(express.json());

interface ClusterConfig {
  baseUrl: string;
  oauthUrl: string;
  clientId: string;
  clientSecret: string;
  audience: string;
}

const primary: ClusterConfig = {
  baseUrl: process.env.CAMUNDA_BASE_URL!,
  oauthUrl: process.env.CAMUNDA_OAUTH_URL!,
  clientId: process.env.CAMUNDA_CLIENT_ID!,
  clientSecret: process.env.CAMUNDA_CLIENT_SECRET!,
  audience: process.env.CAMUNDA_TOKEN_AUDIENCE || 'zeebe.camunda.io',
};

// Optional second cluster for read-only monitoring (e.g. the cluster-explorer dashboard).
// Falls back to the primary cluster when not configured.
const hasMonitorCluster = !!(
  process.env.MONITOR_CAMUNDA_BASE_URL &&
  process.env.MONITOR_CAMUNDA_CLIENT_ID &&
  process.env.MONITOR_CAMUNDA_CLIENT_SECRET
);

const monitor: ClusterConfig = hasMonitorCluster
  ? {
      baseUrl: process.env.MONITOR_CAMUNDA_BASE_URL!,
      oauthUrl: process.env.MONITOR_CAMUNDA_OAUTH_URL || primary.oauthUrl,
      clientId: process.env.MONITOR_CAMUNDA_CLIENT_ID!,
      clientSecret: process.env.MONITOR_CAMUNDA_CLIENT_SECRET!,
      audience: process.env.MONITOR_CAMUNDA_TOKEN_AUDIENCE || primary.audience,
    }
  : primary;

const tokenCaches = new Map<ClusterConfig, { token: string; expiresAt: number }>();

async function getToken(cluster: ClusterConfig): Promise<string> {
  const cached = tokenCaches.get(cluster);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }
  const res = await fetch(cluster.oauthUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      audience: cluster.audience,
      client_id: cluster.clientId,
      client_secret: cluster.clientSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  tokenCaches.set(cluster, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  });
  return data.access_token;
}

async function forward(req: Request, res: Response, cluster: ClusterConfig, camundaPath: string) {
  const contentType = (req.headers['content-type'] ?? '') as string;
  const isMultipart = contentType.startsWith('multipart/form-data');

  try {
    const token = await getToken(cluster);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

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

    const upstream = await fetch(`${cluster.baseUrl.replace(/\/$/, '')}${camundaPath}`, {
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
}

/** Public, non-secret description of a cluster (region + cluster ID parsed from its base URL). */
function describeCluster(cluster: ClusterConfig) {
  const match = cluster.baseUrl.match(/^https?:\/\/([^./]+)\.[^/]+\/([^/]+)/);
  return match
    ? { region: match[1], clusterId: match[2] }
    : { region: null, clusterId: null, host: new URL(cluster.baseUrl).host };
}

// Which cluster the monitoring routes point at
app.get('/api/monitor/_info', (_req, res) => {
  res.json({ ...describeCluster(monitor), dedicated: hasMonitorCluster });
});

// Read-only proxy to the monitored cluster — only GETs and search queries are allowed
app.all('/api/monitor/*path', (req, res) => {
  const camundaPath = req.originalUrl.replace('/api/monitor', '');
  const isRead = req.method === 'GET' || (req.method === 'POST' && req.path.endsWith('/search'));
  if (!isRead) {
    return res.status(405).json({ error: 'The monitoring route is read-only' });
  }
  return forward(req, res, monitor, camundaPath);
});

// Proxy all other /api/* requests to the primary Camunda cluster
app.all('/api/*path', (req, res) => {
  const camundaPath = req.originalUrl.replace('/api', '');
  return forward(req, res, primary, camundaPath);
});

const PORT = process.env.PORT || 3001;
// The proxy adds Camunda credentials to every request and has no authentication of its own,
// so it only listens on this machine unless PROXY_HOST says otherwise (the Docker image sets it).
const HOST = process.env.PROXY_HOST || '127.0.0.1';
app.listen(Number(PORT), HOST, () => {
  console.log(`Camunda proxy running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.warn('Listening on all network interfaces — anyone who can reach this port can use your Camunda credentials.');
  }
  console.log(`Proxying to: ${primary.baseUrl}`);
  console.log(
    hasMonitorCluster
      ? `Monitoring (read-only): ${monitor.baseUrl}`
      : 'Monitoring: MONITOR_CAMUNDA_* not set — using the primary cluster'
  );
});
