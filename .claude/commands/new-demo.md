You are scaffolding a new demo for the Camunda Demo Hub. Gather the following information from the user (ask for all of them in a single message if not already provided via $ARGUMENTS):

1. **slug** — URL-safe folder name (lowercase, hyphens). Must be unique under `src/demos/`.
2. **title** — Human-readable title shown on the hub card.
3. **description** — One sentence shown on the hub card.
4. **processId** — The `bpmnProcessId` as deployed in Camunda 8.
5. **primaryColor** — Hex brand colour (required).
6. **logo** — Path like `/logos/my-logo.svg` (optional — remind the user to drop the file in `/public/logos/`).
7. **taskLoop?** — Does this demo poll for user tasks after process start? (yes/no)
   - If yes: which BPMN element IDs should be surfaced? (e.g. `SendSuggestionToTechie`) — get all of them.
   - If yes: waitingTitle, waitingSteps (optional comma-separated list), successTitle, successMessage.
8. **staticVariables?** — Any hardcoded variables to merge into the submission payload? (optional)

Once you have all required answers, do the following — no further confirmation needed:

1. Create the folder `src/demos/<slug>/`.
2. Write `src/demos/<slug>/config.ts` using the template below.
3. If a logo path was given, remind the user to place the SVG/PNG at that path under `/public/`.
4. Run `npx tsc --noEmit` to verify no type errors were introduced.

---

## config.ts template

```ts
import type { DemoConfig } from '../../types/demo';

const config: DemoConfig = {
  id: '<slug>',
  title: '<title>',
  description: '<description>',
  processId: '<processId>',

  branding: {
    primaryColor: '<primaryColor>',
    // accentColor: '',       // optional
    // backgroundColor: '',   // optional
    // logo: '',              // optional
    // backgroundImage: '',   // optional
  },

  // staticVariables: {},    // optional — merged into every submission

  // taskLoop: {
  //   taskDefinitionIds: [], // BPMN element IDs to surface — always set this
  //   waitingTitle: '',
  //   waitingSteps: [],
  //   successTitle: '',
  //   successMessage: '',
  // },
};

export default config;
```

Fill in the values and uncomment only the sections the user requested. Do not include commented-out fields for sections the user explicitly said they don't need.

---

## Constraints (do not deviate from these)

- `id` must exactly match the folder name.
- Always include `taskDefinitionIds` when `taskLoop` is set — never omit it, even for a single element ID. This prevents unrelated Camunda tasks leaking into the UI.
- Do NOT create any additional files (hooks, components, pages) unless the user explicitly asked for a `customFormPage` or extra `pages`. Everything needed for a standard taskLoop demo already exists.
- Do NOT register the demo anywhere — `demoRegistry.ts` auto-discovers via `import.meta.glob`.
- After writing the file, always run the type-check and report the result.
