# Camunda Demo Hub — Claude Notes

## Project overview

React + TypeScript + Vite app. Provides a self-service demo hub for Camunda 8 processes. Each demo has a start form, submits variables to a Camunda process instance, and shows a success page.

Two processes must run together:
- `npm run proxy` — Express auth proxy on port 3001 (handles OAuth, forwards to Camunda)
- `npm run dev` — Vite dev server on port 5173

## Adding a new demo

Use the `/new-demo` skill — it will ask for the required details and scaffold `src/demos/<slug>/config.ts` for you.

### Rules that always apply

- `id` must exactly match the folder name (URL-safe, lowercase, hyphens).
- No registration needed — `demoRegistry.ts` auto-discovers via `import.meta.glob`.
- Do NOT recreate `useTaskLoop.ts`, `DemoFormPage.tsx`, or any other shared infrastructure — it is already complete.
- Always set `taskDefinitionIds` when using `taskLoop` — see below.

### taskLoop — key constraints

Use `taskLoop` when the process kicks off an async agent that eventually creates a user task. The full infrastructure is already built; you only need config.

**`taskDefinitionIds` is required.** It filters the Camunda task list to only tasks whose BPMN element ID is in the array. Without it, unrelated tasks on the same process instance can surface in the UI.

Implementation files (do not recreate):

| File | Role |
|---|---|
| `src/hooks/useTaskLoop.ts` | State-machine hook: polling → task-active → completing → done/error |
| `src/pages/DemoFormPage.tsx` | Renders start form, then swaps to `TaskLoopPanel` after process starts |
| `src/types/demo.ts` | `TaskLoopConfig` interface |
| `src/api/processApi.ts` | `listActiveUserTasks`, `getUserTaskForm`, `getProcessInstanceVariables`, `completeUserTask`, `getProcessInstanceState` |

Guards already in place: `taskDefinitionIds` filter, `hasSeenActiveRef` (no false-done on first poll), `completedTaskKeysRef` (no task re-flash), 3 s post-completion delay.

**File uploads:** `CamundaFormRenderer` auto-detects `files::` keys, uploads to `POST /api/documents`, and replaces them with Camunda document metadata. No config needed.

### customFormPage

When set, `formSchema` is ignored. Shape:

```tsx
import type { CustomFormPageProps } from '../../types/demo';

export default function MyForm({ config, onSubmit }: CustomFormPageProps) {
  return <form onSubmit={e => { e.preventDefault(); onSubmit({ key: 'value' }); }} />;
}
```

### Additional pages

```ts
pages: [{ path: 'status', label: 'Status', component: StatusPage }]
```

Accessible at `/:demoId/status`.

## Key types

`src/types/demo.ts` — `DemoConfig`, `DemoPage`, `CustomFormPageProps`

## Project structure

```
src/
  demos/                  # One sub-folder per demo
  api/
    camundaClient.ts      # Fetch wrapper (routes through /api proxy)
    processApi.ts         # Process definition + instance API calls
  components/             # Shared UI
  hooks/
    useDemos.ts           # All registered demos
    useDemoConfig.ts      # Config for current route
    useStartForm.ts       # Fetches or returns start form schema
  pages/                  # Route-level components
  types/demo.ts
  utils/demoRegistry.ts   # Auto-discovers configs
server/
  proxy.ts                # Express proxy (OAuth + Camunda forwarding)
```

## Existing demos

- `allied-henna-onboarding` — uses `customFormPage`; fictional bank customer onboarding
- `allied-henna-insurance-claim` — insurance claim flow for same fictional brand
- `allied-henna-telecom` — uses `taskLoop` with `taskDefinitionIds: ['SendSuggestionToTechie']`; field technician submits a blocking issue, AI agent creates a user task with a response (reference implementation for the task loop pattern)

## Environment variables

Defined in `.env` (copy from `.env.example`):

| Variable | Example |
|---|---|
| `CAMUNDA_BASE_URL` | `https://bru-2.zeebe.camunda.io/<cluster-id>/v2` |
| `CAMUNDA_OAUTH_URL` | `https://login.cloud.camunda.io/oauth/token` |
| `CAMUNDA_CLIENT_ID` | from Camunda Console |
| `CAMUNDA_CLIENT_SECRET` | from Camunda Console |
| `CAMUNDA_TOKEN_AUDIENCE` | `zeebe.camunda.io` |
