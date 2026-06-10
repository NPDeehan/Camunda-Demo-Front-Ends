You are scaffolding a new **taskLoop chatbot demo** for the Camunda Demo Hub. This pattern is for demos where the user submits a form, an AI agent processes it asynchronously, then creates a user task to deliver the response back to the user in the UI.

Reference implementation: `src/demos/allied-henna-telecom/config.ts`

Gather the following from the user (ask for all in a single message if not already provided via $ARGUMENTS):

1. **slug** — URL-safe folder name (lowercase, hyphens). Must be unique under `src/demos/`.
2. **title** — Human-readable title (e.g. `Allied Henna Telecom — Field Techie Helper`).
3. **description** — One sentence shown on the hub card describing what the user submits and what the AI returns.
4. **processId** — The `bpmnProcessId` as deployed in Camunda 8.
5. **taskDefinitionId** — The BPMN element ID of the user task the AI agent creates to deliver its response (e.g. `SendSuggestionToTechie`). There is usually just one.
6. **primaryColor** — Hex brand colour (required).
7. **accentColor** — Hex accent colour (optional).
8. **backgroundColor** — Hex background colour (optional).
9. **logo** — Path like `/logos/my-logo.svg` (optional — remind the user to drop the file in `/public/logos/`).
10. **waitingTitle** — Heading shown while the agent is processing (e.g. `Expert advice on the way`).
11. **waitingSteps** — Comma-separated progress steps shown in sequence while waiting (e.g. `Issue received, Diagnosing the fault, Preparing specialist advice, Response ready…`).
12. **successTitle** — Heading on the completion screen (e.g. `Issue Resolved`).
13. **successMessage** — Body text on the completion screen.
14. **staticVariables?** — Any hardcoded variables to merge into the submission payload (optional).

Once you have all required answers, do the following — no further confirmation needed:

1. Create the folder `src/demos/<slug>/`.
2. Write `src/demos/<slug>/config.ts` using the template below.
3. If a logo path was given, remind the user to place the SVG/PNG at that path under `/public/`.
4. Run `npx tsc --noEmit` to verify no type errors.
5. Remind the user of the two things they must verify in Camunda Modeler:
   - The process is deployed with the correct `bpmnProcessId`.
   - The user task that delivers the AI response has its BPMN element ID set to the `taskDefinitionId` they provided.

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
    // accentColor: '<accentColor>',
    // backgroundColor: '<backgroundColor>',
    // logo: '<logo>',
  },

  // staticVariables: {},

  taskLoop: {
    taskDefinitionIds: ['<taskDefinitionId>'],
    waitingTitle: '<waitingTitle>',
    waitingSteps: [
      // '<step1>',
      // '<step2>',
      // '<step3>',
      // '<step4>',
    ],
    successTitle: '<successTitle>',
    successMessage: '<successMessage>',
  },
};

export default config;
```

Fill in values and uncomment optional branding fields the user requested. Replace the `waitingSteps` placeholder comments with the actual steps as individual strings.

---

## Constraints (do not deviate)

- `id` must exactly match the folder name.
- `taskLoop` is **always** present in this demo type — never omit it.
- `taskDefinitionIds` is **always** set — never omit it even for a single ID. Without it, unrelated Camunda tasks on the same process instance leak into the UI.
- Do NOT create any additional files (hooks, components, pages). The full taskLoop infrastructure already exists:
  - `src/hooks/useTaskLoop.ts` — polling state machine
  - `src/pages/DemoFormPage.tsx` — renders form then swaps to TaskLoopPanel
  - `src/api/processApi.ts` — all Camunda API calls
- Do NOT register the demo anywhere — `demoRegistry.ts` auto-discovers via `import.meta.glob`.
- After writing the file, always run the type-check and report the result.
