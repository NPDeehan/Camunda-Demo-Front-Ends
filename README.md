# Camunda Demo Hub

A React + TypeScript + Vite application that provides a self-service demo hub for Camunda 8 processes. Each demo presents a start form, submits variables to a running Camunda process instance, and shows a success page.

---

## Getting started

### Prerequisites

- A Camunda 8 cluster (SaaS or Self-Managed) with at least one deployed process
- For local development: Node.js 18+
- For containerized deployment: Docker (with Compose)

### Configure environment

Copy `.env.example` to `.env` and fill in your cluster details. The same `.env` is used by both run modes.

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `CAMUNDA_BASE_URL` | Base URL of the Camunda REST API, e.g. `https://bru-2.zeebe.camunda.io/<cluster-id>/v2` |
| `CAMUNDA_OAUTH_URL` | OAuth token endpoint, e.g. `https://login.cloud.camunda.io/oauth/token` |
| `CAMUNDA_CLIENT_ID` | Client ID from Camunda Console |
| `CAMUNDA_CLIENT_SECRET` | Client secret from Camunda Console |
| `CAMUNDA_TOKEN_AUDIENCE` | Token audience (default: `zeebe.camunda.io`) |
| `MONITOR_CAMUNDA_BASE_URL` | *Optional.* Cluster shown by the read-only monitoring dashboard (`allied-henna-cluster-explorer`). Falls back to `CAMUNDA_BASE_URL` when unset |
| `MONITOR_CAMUNDA_CLIENT_ID` / `MONITOR_CAMUNDA_CLIENT_SECRET` | *Optional.* Client credentials for the monitored cluster |
| `MONITOR_CAMUNDA_OAUTH_URL` / `MONITOR_CAMUNDA_TOKEN_AUDIENCE` | *Optional.* Default to the primary values above |

### Security notes

This hub is a **local demo tool**, not something to put on a public network.

- **The proxy has no authentication.** It attaches your Camunda credentials to every request it receives, so anyone who can reach it can start, cancel or delete things on your cluster. By default it only listens on your own machine: `npm run proxy` and the standalone binary bind to `127.0.0.1`, and Docker Compose publishes its ports on `127.0.0.1` only. Set `BIND_ADDRESS=0.0.0.0` in `.env` (Docker) or `PROXY_HOST=0.0.0.0` (npm / binary) only on a network you trust.
- **Use the least access you can.** Create the Camunda API client with only the permissions the demos need. For the optional monitoring cluster, create a separate client with **read-only** permissions — the dashboard only ever reads, and the proxy's `/api/monitor` route rejects anything but `GET` and `…/search` requests.
- **Never commit `.env`.** It is git-ignored; only `.env.example` (placeholders) belongs in the repo.

You can run the hub two ways: as containers via Docker Compose (one command, recommended), or locally with npm for active development. Both pick up the same `.env`.

---

## Running the app

### Option A — Docker Compose

With your `.env` in place, build and start both services:

```bash
docker compose up --build
```

This brings up:

- `proxy` on port 3001 — Node + tsx, reads `.env` for Camunda credentials
- `frontend` on port 8091 — production Vite build served by nginx, forwards `/api` to the proxy

Open [http://localhost:8091](http://localhost:8091) in your browser.

### Option B — Local dev (npm)

Install dependencies:

```bash
npm install
```

The app needs two processes running side-by-side: the Vite dev server and the authentication proxy.

**Terminal 1 — proxy (handles OAuth and forwards API calls):**

```bash
npm run proxy
```

**Terminal 2 — dev server:**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Cluster Health Explorer

`allied-henna-cluster-explorer` is an operator's view of a Camunda cluster: live health metrics on one side, and an AI agent you can ask about anything going on in the cluster on the other. Open it at [http://localhost:5173/allied-henna-cluster-explorer](http://localhost:5173/allied-henna-cluster-explorer) (or port 8091 with Docker).

### What it shows

**Cluster health** (left, refreshes every 30 seconds and pauses while the tab is hidden)

- **Status banner** — "No problems detected" or a list of issues that need attention. It is based only on partition health, incidents and failed jobs, and never reports all-clear while any of those is still loading or unavailable.
- **Cluster topology** — brokers, partitions and replication, plus a broker × partition grid showing which broker leads each partition and its health.
- **Health checks** — active incidents, instances with incidents and failed jobs, with the most recent incidents listed when there are any.
- **Workload** — active process instances, open user tasks and deployed processes.
- **Throughput** — process instances started and completed in the last 24 hours.

Each issue and tile has an **Ask agent** button that drops a relevant question into the chat. The header shows which cluster is being monitored.

**Cluster Agent** (right) — a chat with a Camunda process. Suggested questions adapt to what is currently wrong (for example, incidents come first when there are any). The chat widens automatically once a conversation starts, and on narrow screens the page switches between Health and Agent tabs. Transient gateway errors (502/503/504) are retried automatically; if one persists, the chat offers a **Retry** button instead of losing the conversation.

### Setup

**1. Deploy the agent process** to the cluster configured by `CAMUNDA_*` in `.env`. The process itself is not part of this repo; the page expects it to follow this contract:

| What | Value |
|---|---|
| Process ID | `Camunda-Cluster-Explorer` |
| Start variable | `question` — the user's first message |
| Reply user task | element ID `DisplayAnswerToUser` |
| Agent's answer | variable `answertoUser` (Markdown), available on that task |
| User's follow-up | variable `followupQuestion`, set when the task is completed |

The agent decides what to answer, so any tools it uses to query a cluster need credentials for the cluster you want to explore. If a reply task times out or the process ends, the chat says so and offers **New conversation**.

**2. Choose the cluster to monitor.** The dashboard reads from the cluster set in `MONITOR_CAMUNDA_*` (see [Configure environment](#configure-environment)), which can be a different cluster from the one running the agent. If those variables are not set it falls back to the main cluster, and the header shows a "Same cluster as agent" badge. For the chat and the dashboard to describe the same cluster, point the agent's own query credentials at the monitored cluster too.

The monitoring client needs **read access** to topology, incidents, jobs, process instances, user tasks and process definitions. Create it as a read-only client — the dashboard only reads, and the proxy rejects any `/api/monitor` request that is not a `GET` or a `…/search`.

### API calls

The dashboard calls the monitored cluster through the proxy's read-only `/api/monitor` route. It needs Camunda 8.8 or later (the v2 REST API).

| Call | Used for |
|---|---|
| `GET /topology` | Brokers, partitions, roles and partition health |
| `POST /incidents/search` | Active incidents and the most recent ones |
| `POST /process-instances/search` | Active instances, instances with incidents, started/completed in 24 h |
| `POST /jobs/search` | Failed jobs |
| `POST /user-tasks/search` | Open user tasks |
| `POST /process-definitions/search` | Deployed processes (latest versions) |

The chat itself uses the normal `/api` route (start the process, poll for the reply task, complete it with the follow-up).

### Where the code lives

Everything is in `src/demos/allied-henna-cluster-explorer/`: `config.ts`, `ClusterExplorerPage.tsx` / `.css`, `clusterMetricsApi.ts` (API calls), `useClusterMetrics.ts` (polling), and `clusterStatus.ts` (the status banner and suggestion logic). The chat reuses the shared `useChatLoop` hook.

---

## Adding a new demo process

### 1. Create a config folder

Create a new folder under `src/demos/` whose name matches the URL slug you want. The slug must be URL-safe (lowercase letters, numbers, hyphens).

```
src/demos/my-new-process/
```

### 2. Add a `config.ts` file

Create `src/demos/my-new-process/config.ts` with the following shape:

```ts
import type { DemoConfig } from '../../types/demo';

const config: DemoConfig = {
  // Must match the folder name exactly
  id: 'my-new-process',

  // Displayed on the hub card and demo pages
  title: 'My New Process',
  description: 'A short description shown on the hub card.',

  // The bpmnProcessId of the deployed process in Camunda
  processId: 'MyNewProcess',

  branding: {
    primaryColor: '#0d7bff',      // required — buttons and headings
    accentColor:  '#00c49f',      // optional
    backgroundColor: '#f0f8ff',  // optional — page background
    logo: '/logos/my-logo.svg',  // optional — absolute path from /public
    backgroundImage: '/bg.jpg',  // optional — absolute path from /public
  },
};

export default config;
```

The demo is automatically discovered at startup — no import or registration step is required. The `demoRegistry` uses `import.meta.glob` to pick up every `src/demos/*/config.ts` file.

### 3. Deploy the process to Camunda

Ensure the process whose `bpmnProcessId` matches `processId` above is deployed and has a start event with a linked **Camunda Form**. The proxy fetches that form schema at runtime and renders it automatically.

The demo will appear on the hub at the frontend URL (`http://localhost:8091` in Docker mode, `http://localhost:5173` in npm mode) and be accessible at `/my-new-process`.

### Optional config features

#### Hardcoded form schema (skip the API fetch)

If you want to embed the form schema in the front end instead of fetching it from Camunda, provide it directly:

```ts
import type { DemoConfig } from '../../types/demo';
import formSchema from './form.json';

const config: DemoConfig = {
  id: 'my-new-process',
  // ...
  formSchema: formSchema,
};
```

Place your exported Camunda form JSON as `src/demos/my-new-process/form.json`.

#### Static variables

Variables that should always be merged into the submission payload (e.g. a `source` tag or a fixed account ID) can be declared without appearing in the form:

```ts
const config: DemoConfig = {
  // ...
  staticVariables: {
    source: 'demo-hub',
    environment: 'staging',
  },
};
```

These are merged with the form data before the process instance is started (form data takes precedence on key conflicts).

#### Custom form page

If the standard form renderer is not sufficient you can provide your own React component:

```ts
import type { DemoConfig, CustomFormPageProps } from '../../types/demo';
import MyCustomForm from './MyCustomForm';

const config: DemoConfig = {
  id: 'my-new-process',
  // ...
  customFormPage: MyCustomForm,
};
```

The component receives `config` (the `DemoConfig` object) and `onSubmit` (an async function that accepts a `Record<string, unknown>` of variables):

```tsx
// src/demos/my-new-process/MyCustomForm.tsx
import type { CustomFormPageProps } from '../../types/demo';

export default function MyCustomForm({ config, onSubmit }: CustomFormPageProps) {
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      await onSubmit({ myVariable: 'value' });
    }}>
      {/* your fields */}
      <button type="submit">Submit</button>
    </form>
  );
}
```

When `customFormPage` is set, `formSchema` is ignored.

#### Additional pages

Extra pages rendered under the demo route (e.g. a status tracker) can be added via the `pages` array:

```ts
import StatusPage from './StatusPage';

const config: DemoConfig = {
  id: 'my-new-process',
  // ...
  pages: [
    {
      path: 'status',
      label: 'Status',
      component: StatusPage,
    },
  ],
};
```

Each page is accessible at `/:demoId/:path`, e.g. `/my-new-process/status`.

---

## Reference

### Project structure

```
src/
  demos/                  # One sub-folder per demo
    insurance-claim/
      config.ts
    loan-application/
      config.ts
  api/
    camundaClient.ts      # Thin fetch wrapper (routes through /api)
    processApi.ts         # Process definition + instance API calls
  components/             # Shared UI components
  hooks/
    useDemos.ts           # Returns all registered demos
    useDemoConfig.ts      # Returns the config for the current route
    useStartForm.ts       # Fetches (or returns) the start form schema
  pages/                  # Route-level page components
  types/
    demo.ts               # DemoConfig and related types
  utils/
    demoRegistry.ts       # Auto-discovers configs via import.meta.glob
server/
  proxy.ts                # Express proxy — handles OAuth and forwards to Camunda
                          # (/api = main cluster, /api/monitor = optional read-only second cluster)
```

### Available npm scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run proxy` | Start the Camunda auth proxy on port 3001 |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
