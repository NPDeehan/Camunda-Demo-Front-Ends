# Camunda Demo Hub

A React + TypeScript + Vite application that provides a self-service demo hub for Camunda 8 processes. Each demo presents a start form, submits variables to a running Camunda process instance, and shows a success page.

---

## Getting started

### Prerequisites

- Node.js 18+
- A Camunda 8 cluster (SaaS or Self-Managed) with at least one deployed process

### Install dependencies

```bash
npm install
```

### Configure environment

Copy `.env.example` to `.env` and fill in your cluster details:

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

### Run the application

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

The demo will appear on the hub at `http://localhost:5173` and be accessible at `http://localhost:5173/my-new-process`.

---

## Optional config features

### Hardcoded form schema (skip the API fetch)

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

### Static variables

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

### Custom form page

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

### Additional pages

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

## Project structure

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
```

---

## Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run proxy` | Start the Camunda auth proxy on port 3001 |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
