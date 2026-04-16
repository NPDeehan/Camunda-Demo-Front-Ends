# Demo Page Template Guide

> **Audience:** This document is written for an LLM. It describes the exact pattern, file structure, design conventions, and functional requirements needed to produce a new demo page for the Camunda Demo Hub. Follow every section precisely. Do not deviate from the established patterns without a specific user instruction to do so.

---

## What a "demo page" is

A demo page is a fully designed, self-contained marketing landing page that lives inside the Camunda Demo Hub. It promotes a fictional brand, presents a Camunda start form to the user, submits it to a live Camunda 8 process instance when the user clicks submit, and reveals a confirmation state **in place** (no redirect). The Allied Henna Bank onboarding page (`src/demos/allied-henna-onboarding/`) is the canonical reference implementation.

---

## File structure for a new demo

Every demo lives in its own folder under `src/demos/`. The folder name is the URL slug.

```
src/demos/<demo-slug>/
  config.ts            ← required — registers the demo with the hub
  <BrandName>Page.tsx  ← required — the full custom page component
  <BrandName>Page.css  ← required — all styles scoped to this demo
  form.json            ← optional — embed a form schema instead of fetching from Camunda
  *.svg / *.png        ← optional — any additional local assets
public/logos/
  <brand>.svg          ← required — the brand logo served statically
```

---

## Step 1 — Create the logo

Create an SVG logo at `public/logos/<brand>.svg`. It must:

- Work well at small sizes (36–40px height in the nav) and at larger sizes (200–300px width in the apply section header)
- Work on **dark backgrounds** (the nav and form card header are dark navy) — include a version or use `filter: brightness(0) invert(1)` in CSS where needed
- Work on **light backgrounds** (the hub card, footer)
- Contain the brand name as text and a simple mark/monogram — avoid complex raster-style shapes
- Use the brand's primary and accent colours

---

## Step 2 — Write `config.ts`

```ts
import type { DemoConfig } from '../../types/demo';
import <BrandName>Page from './<BrandName>Page';

const config: DemoConfig = {
  // Must exactly match the folder name
  id: '<demo-slug>',

  // Shown on the hub card
  title: '<Human readable title>',
  description: '<One or two sentence description for the hub card>',

  // The bpmnProcessId of the deployed Camunda 8 process
  processId: '<CamundaProcessId>',

  branding: {
    primaryColor:    '<hex>',   // main brand colour — used on hub card border
    accentColor:     '<hex>',   // secondary highlight colour
    backgroundColor: '<hex>',   // hub card / shell background
    logo: '/logos/<brand>.svg', // path relative to /public
  },

  // Points at the custom page — this triggers the full custom layout
  customFormPage: <BrandName>Page,
};

export default config;
```

**Important:** Setting `customFormPage` bypasses the default `DemoShell` header and `DemoFormPage` layout entirely. The custom page owns its full layout. It also bypasses the post-submit navigation to `/success` — the page must handle its own confirmation state.

---

## Step 3 — Write `<BrandName>Page.tsx`

### Required imports

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CustomFormPageProps } from '../../types/demo';
import { useStartForm } from '../../hooks/useStartForm';
import CamundaFormRenderer from '../../components/CamundaFormRenderer';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorBanner from '../../components/ErrorBanner';
import './<BrandName>Page.css';
```

### Required state

```tsx
const [submitting, setSubmitting] = useState(false);
const [submitted, setSubmitted] = useState(false);
const [submitError, setSubmitError] = useState<string | null>(null);
const { schema, loading, error } = useStartForm(config.processId, config.formSchema);
```

### Required submit handler

```tsx
const handleSubmit = async (data: Record<string, unknown>) => {
  setSubmitting(true);
  setSubmitError(null);
  try {
    await onSubmit(data);  // calls Camunda API — do NOT navigate after this
    setSubmitted(true);    // triggers the flip to the confirmation face
  } catch (e) {
    setSubmitError((e as Error).message);
    setSubmitting(false);
  }
};
```

`onSubmit` is passed in from `DemoFormPage` and handles the Camunda API call. It resolves on success and throws on failure. **Never call `navigate()` inside a custom page** — the `DemoFormPage` no longer navigates after `onSubmit` resolves for custom pages.

### Required page sections (in order)

Every custom page must include all of the following sections. Adjust the copy, colours, and content to match the brand — do not remove sections.

#### 1. Nav
- Sticky, dark background using the brand's dark primary shade
- Brand logo (img from `/public/logos/`)  
- Anchor links to `#features`, `#testimonials`, `#open-account`
- A gold/accent CTA anchor button linking to `#open-account`
- A `<Link to="/">← Demo Hub</Link>` back link (muted, far right)

#### 2. Hero
- Full-bleed dark gradient section using brand colours
- Eyebrow text (small caps, accent colour)
- Large headline with one line in a gradient highlight using accent colour
- Subtitle paragraph
- CTA button anchoring to `#open-account`
- A decorative visual on the right (e.g. a card mockup, product screenshot, or abstract illustration)
- Floating badge pills over the visual (e.g. "✓ Instant Approval", "€0 Monthly Fees")
- A stats bar at the bottom of the hero with 4 key metrics relevant to the brand

#### 3. Features section
- Light background (`--bg` colour or `#F4F6FA`)
- Section eyebrow + h2 + subtitle paragraph
- A 4-card grid. Each card has: an emoji/icon, a title, a body paragraph
- Cards lift slightly on hover (`transform: translateY(-3px)`)

#### 4. Application form section (`id="open-account"`)
This is the section the user arrives at when they click any CTA. It is a 2-column layout:

**Left column — sales copy:**
- Eyebrow, h2, short pitch paragraph
- A checklist (`<ul>`) of 4 bullet points (✓ prefix, no list-style)
- A blockquote-style pull quote from a named customer with an avatar

**Right column — the form card:**
The form card uses a **3D flip animation**. It has two faces:

- **Front face** — the form
- **Back face** — the confirmation

```tsx
<div className={`<prefix>-card-flip-scene${submitted ? ' <prefix>-card-flip-scene--flipped' : ''}`}>
  <div className="<prefix>-card-flip-inner">

    {/* Front */}
    <div className="<prefix>-card-flip-face <prefix>-card-flip-face--front">
      <div className="<prefix>-form-card">
        <div className="<prefix>-form-card-header">
          <img src="/logos/<brand>.svg" alt="<Brand>" className="<prefix>-form-logo" />
          <p>Free account · No obligations</p>
        </div>
        {submitError && <ErrorBanner message={submitError} />}
        {loading && <LoadingSpinner />}
        {error && <ErrorBanner message={error} />}
        {!loading && !error && schema && (
          <CamundaFormRenderer
            schema={schema}
            submitLabel="Submit Application"
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>

    {/* Back — confirmation */}
    <div className="<prefix>-card-flip-face <prefix>-card-flip-face--back">
      <div className="<prefix>-form-card <prefix>-form-card--success">
        <div className="<prefix>-form-card-header">
          <img src="/logos/<brand>.svg" alt="<Brand>" className="<prefix>-form-logo" />
        </div>
        <div className="<prefix>-success-body">
          <div className="<prefix>-success-icon">✓</div>
          <h3>Thanks for your application!</h3>
          <p>We've received your details. You should expect an email shortly with an update about your application.</p>
          <p className="<prefix>-success-sub">In the meantime, feel free to explore what's coming your way.</p>
          <div className="<prefix>-success-steps">
            <div className="<prefix>-success-step <prefix>-success-step--done">
              <span className="<prefix>-step-dot">✓</span>
              <span>Application submitted</span>
            </div>
            <div className="<prefix>-success-step">
              <span className="<prefix>-step-dot">2</span>
              <span><Step 2 label relevant to brand></span>
            </div>
            <div className="<prefix>-success-step">
              <span className="<prefix>-step-dot">3</span>
              <span><Step 3 label relevant to brand></span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>
```

#### 5. Testimonials section
- Dark background (the brand's deep dark primary shade)
- Section eyebrow + h2
- 3-card grid. Each card has: star rating (★★★★★), italic quote in quotation marks, avatar + name + location
- Avatars are initials-based circles using the accent/gold gradient

#### 6. Trust bar
- Light separated bar between testimonials and footer
- 5 trust/compliance items with icons, e.g.: Regulated, Deposit Protection, Licensed, GDPR, PSD2
- Items are inline, separated by subtle borders
- Tailor the items to the industry of the brand

#### 7. Footer
- Dark navy background
- Brand logo (light/inverted)
- Regulatory/legal disclaimer paragraph (small text, muted, industry-appropriate)
- Copyright line

---

## Step 4 — Write `<BrandName>Page.css`

### CSS conventions

- All class names must use a short 2–4 character **prefix** unique to the brand (e.g. `ah-` for Allied Henna, `cb-` for CityBike, `nv-` for NovaVita). This prevents collisions with global styles.
- Define design tokens as CSS custom properties on the root page wrapper class, not on `:root`. This keeps them scoped:

```css
.<prefix>-page {
  --<prefix>-primary:    <hex>;
  --<prefix>-primary-dk: <hex>;   /* darker shade for navs/footers */
  --<prefix>-accent:     <hex>;
  --<prefix>-accent-lt:  <hex>;   /* lighter accent for gradients */
  --<prefix>-bg:         <hex>;   /* light section backgrounds */
  --<prefix>-white:      #FFFFFF;
  --<prefix>-text:       <hex>;
  --<prefix>-muted:      <hex>;   /* secondary text */
  --<prefix>-border:     <hex>;
  --<prefix>-radius:     12px;
  --<prefix>-shadow:     0 4px 24px rgba(..., 0.10);
  --<prefix>-shadow-lg:  0 12px 48px rgba(..., 0.16);
}
```

### Required CSS blocks (in order)

1. **Design tokens** — on the page wrapper class (see above)
2. **Nav** — sticky, `backdrop-filter: blur(12px)`, dark bg, logo + links + CTA + back-link
3. **Hero** — full-bleed gradient, grid layout (text left, visual right), eyebrow, headline, sub, CTA button, card/visual mockup, badge pills, stats bar
4. **Section shared** — `..<prefix>-section-inner` (max-width, auto margin, padding), `..<prefix>-section-header` (centered, max-width 600px), `..<prefix>-eyebrow`
5. **Features section** — light bg, 4-col auto-fit grid, hover lift cards
6. **Apply section** — 2-col grid, left copy, right form card
7. **Flip animation** (copy this block exactly, replacing the prefix):

```css
.<prefix>-card-flip-scene {
  perspective: 1400px;
}

.<prefix>-card-flip-inner {
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.75s cubic-bezier(0.45, 0.05, 0.55, 0.95);
}

.<prefix>-card-flip-scene--flipped .<prefix>-card-flip-inner {
  transform: rotateY(180deg);
}

.<prefix>-card-flip-face {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.<prefix>-card-flip-face--front {
  position: relative;
}

.<prefix>-card-flip-face--back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
}

.<prefix>-card-flip-scene--flipped .<prefix>-card-flip-face--back {
  position: relative;
}

.<prefix>-card-flip-scene--flipped .<prefix>-card-flip-face--front {
  position: absolute;
  inset: 0;
  visibility: hidden;
}
```

8. **Form card** — white card, large border-radius (16px), heavy shadow, dark gradient header containing logo
9. **Success body** — centered flex column, gold checkmark circle, heading, paragraph, 3-step progress tracker with gold-filled first step
10. **Testimonials** — dark bg, 3-col auto-fit grid, star colour, quote, avatar circle
11. **Avatars** — 40px circle, accent gradient bg, initials text
12. **Trust bar** — light bg, flex row, icon + label pairs, dividers
13. **Footer** — dark bg, centered column, logo (inverted), legal text, copyright
14. **Responsive (@media max-width: 900px)** — collapse hero to single column, hide hero visual, collapse stats to 2-col, collapse apply to single column, hide nav links

---

## Design quality checklist

Before finalising a page, verify:

- [ ] All sections are present (nav, hero, features, apply, testimonials, trust bar, footer)
- [ ] The brand has a consistent colour palette — primary, dark primary, accent, light accent, muted text
- [ ] The hero has a gradient that uses at least 2 brand colour stops
- [ ] The hero headline has a gradient text highlight on one phrase
- [ ] The card mockup/visual in the hero is brand-relevant (bank card, phone, document, etc.)
- [ ] Badge pills float over the visual
- [ ] Stats bar has 4 real-feeling metrics
- [ ] Features use emoji icons (not SVG) for simplicity
- [ ] Testimonials use realistic European names and cities appropriate to the brand's region
- [ ] Trust bar items are industry-specific (not generic)
- [ ] The flip animation class is wired to the `submitted` state
- [ ] `CamundaFormRenderer` receives `submitLabel`, `submitting`, and `onSubmit={handleSubmit}`
- [ ] The page wrapper div has the prefix's page class (e.g. `className="ah-page"`) so CSS tokens are scoped
- [ ] The back face of the flip card shows the 3-step progress tracker with step 1 marked done
- [ ] The footer contains a credible regulatory disclaimer relevant to the industry
- [ ] A `<Link to="/">← Demo Hub</Link>` is present in the nav

---

## What NOT to do

- Do not use `:root` for design tokens — scope them to the page wrapper
- Do not use `navigate()` inside the custom page after `onSubmit` resolves
- Do not call `setSubmitting(false)` on success — leave it `true` to prevent re-submission
- Do not import global brand colours from another file — define them inline as CSS vars
- Do not skip the flip animation CSS blocks — copy them exactly and substitute the prefix
- Do not re-use the `ah-` prefix — choose a new unique prefix per brand
- Do not add `customFormPage` to `config.ts` without also creating the component — the build will fail if the import doesn't resolve
- Do not render `<CamundaFormRenderer>` when `loading` is `true` or `error` is set — always guard with `{!loading && !error && schema && (...)}`

---

## Reference implementation

The canonical example for every pattern described in this document is:

| File | Purpose |
|---|---|
| [src/demos/allied-henna-onboarding/config.ts](src/demos/allied-henna-onboarding/config.ts) | Config registration with `customFormPage` |
| [src/demos/allied-henna-onboarding/OnboardingPage.tsx](src/demos/allied-henna-onboarding/OnboardingPage.tsx) | Full custom page component |
| [src/demos/allied-henna-onboarding/OnboardingPage.css](src/demos/allied-henna-onboarding/OnboardingPage.css) | Scoped styles with `ah-` prefix |
| [public/logos/allied-henna.svg](public/logos/allied-henna.svg) | Brand logo (dark + light compatible) |

When in doubt, replicate the Allied Henna implementation and swap out the brand content.
