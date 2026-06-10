You are scaffolding a new **chatbot demo** for the Camunda Demo Hub. This pattern is for demos where:
1. The user types an initial question on the start screen; it is sent as a named variable when starting the process instance
2. The UI polls for a specific user task (the agent's reply) to become active
3. The agent's reply is read from a named process variable (markdown-formatted)
4. The user submits a follow-up by completing that user task with a named variable
5. Step 2–4 repeats until the process ends, at which point the UI shows "conversation ended"

Reference implementation:
- `src/demos/allied-henna-agent/` — full working chatbot demo
- `src/hooks/useChatLoop.ts` — reusable multi-turn polling hook (DO NOT recreate)

Gather the following from the user (ask for all in a single message if not already provided via $ARGUMENTS):

1. **slug** — URL-safe folder name (lowercase, hyphens). Must be unique under `src/demos/`.
2. **title** — Human-readable title shown in the chat header.
3. **description** — One sentence shown on the hub card and the start screen.
4. **processId** — The `bpmnProcessId` as deployed in Camunda 8.
5. **taskDefinitionId** — BPMN element ID of the user task the agent creates to deliver each reply (e.g. `DisplayAnswerToUser`).
6. **answerVariable** — Process variable key that holds the agent's markdown-formatted reply (e.g. `answertoUser`).
7. **replyVariable** — Variable key sent when completing the task with the user's follow-up (e.g. `followupQuestion`).
8. **primaryColor** — Hex brand colour for the header and buttons (required).
9. **accentColor** — Hex accent colour used for button text and user bubbles (required).
10. **logo** — Path like `/logos/my-logo.svg` (optional — offer to generate one if the user doesn't have one; remind them to drop the file in `/public/logos/`).
11. **initialQuestionVariable** — Variable key sent with the process-start payload containing the user's first message (e.g. `questionFromUser`).
12. **staticVariables?** — Any hardcoded variables merged into the process-start payload (optional).

Once you have all required answers, do the following — no further confirmation needed:

1. Create the folder `src/demos/<slug>/`.
2. Write the CSS file `src/demos/<slug>/ChatPage.css` using the template below.
3. Write the component `src/demos/<slug>/ChatPage.tsx` using the template below.
4. Write `src/demos/<slug>/config.ts` using the template below.
5. Run `npx tsc --noEmit` and report the result.
6. Remind the user to verify in Camunda Modeler:
   - The process is deployed with the correct `bpmnProcessId`.
   - The agent's reply user task has BPMN element ID matching `taskDefinitionId`.
   - The process variable set before creating that task matches `answerVariable`.

---

## CSS template — `ChatPage.css`

Copy `src/demos/allied-henna-agent/ChatPage.css` verbatim, then replace the two brand colours:
- `#003399` → `<primaryColor>`
- `#FFCC00` → `<accentColor>`
- `#00205b` (user bubble text) → a dark shade of `<primaryColor>`

Also rename all `.ahc-` class prefixes to `.<prefix>-` where `<prefix>` is a short slug-derived identifier (e.g. `abc` for `allied-henna-bank-chat`). Keep all structural rules identical.

---

## Component template — `ChatPage.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { CustomFormPageProps } from '../../types/demo';
import { getProcessDefinitionKey, startProcessInstance } from '../../api/processApi';
import { useChatLoop } from '../../hooks/useChatLoop';
import './<slug>ChatPage.css';  // use the CSS file created above

const CHAT_CONFIG = {
  taskDefinitionId: '<taskDefinitionId>',
  answerVariable: '<answerVariable>',
  replyVariable: '<replyVariable>',
};

// Copy Header, ChatInterface, and ChatPage components verbatim from
// src/demos/allied-henna-agent/ChatPage.tsx, updating only:
// - CSS class prefix (ahc- → <prefix>-)
// - Logo src path
// - "Allied Henna Agent" display label → appropriate brand label
// - initialQuestionVariable name in the startChat payload ({ <initialQuestionVariable>: question })
```

Rather than duplicating the full component here, read `src/demos/allied-henna-agent/ChatPage.tsx` and adapt it for the new demo. The structure must not change — only the CSS class prefix, brand label, logo path, and CHAT_CONFIG values.

---

## config.ts template

```ts
import type { DemoConfig } from '../../types/demo';
import ChatPage from './ChatPage';

const config: DemoConfig = {
  id: '<slug>',
  title: '<title>',
  description: '<description>',
  processId: '<processId>',

  branding: {
    primaryColor: '<primaryColor>',
    accentColor: '<accentColor>',
    // logo: '<logo>',
  },

  // staticVariables: {},

  customFormPage: ChatPage,
};

export default config;
```

---

## Constraints (do not deviate)

- `id` must exactly match the folder name.
- `customFormPage` is always set — this demo type never uses `taskLoop` or `formSchema`.
- **DO NOT recreate `useChatLoop.ts`** — it already exists at `src/hooks/useChatLoop.ts` and is reusable. Import it directly.
- **DO NOT recreate `DemoFormPage.tsx`, `useTaskLoop.ts`, or any other shared infrastructure.**
- Do NOT register the demo anywhere — `demoRegistry.ts` auto-discovers via `import.meta.glob`.
- Because `customFormPage` is set, `DemoShell` renders `<Outlet />` directly — the chat page has full layout control and must render its own header and back link.
- After writing the files, always run the type-check and report the result.

---

## How `useChatLoop` works (for reference)

```ts
import { useChatLoop } from '../../hooks/useChatLoop';

const { messages, status, sendReply, error } = useChatLoop(processInstanceKey, {
  taskDefinitionId: 'DisplayAnswerToUser',  // BPMN element ID
  answerVariable:   'answertoUser',          // process variable with agent reply (markdown)
  replyVariable:    'followupQuestion',      // variable key sent on task completion
  pollIntervalMs:   2000,                    // optional, default 2000
});
// messages: Array<{ role: 'agent' | 'user', content: string }>
// status:   'polling' | 'agent-replied' | 'sending' | 'ended' | 'error'
// sendReply(text): completes the active user task, adds user message, resumes polling
// error: string | null
```

Guards already in place: `hasSeenActiveRef` (no false-done on first poll), `seenTaskKeysRef` (no task re-flash), 3 s post-completion delay before next poll, process-end detection.
