@AGENTS.md

# UniTute: project conventions

UniTute turns a unit's lecture slides and readings into an interactive course (classroom, knowledge checks, AI tutor). **PLAN.md is the source of truth** for scope, phases, data model and design system. Build one phase at a time and don't start phase N+1 work until the user has tested phase N.

## Stack (from PLAN.md, don't substitute)

| Part | Choice |
| --- | --- |
| Framework | Next.js (App Router) + TypeScript (strict) |
| Styling / motion | Tailwind CSS v4 + Framer Motion (npm package `motion`, imported from `motion/react`) |
| Hosting | Vercel (deploys on push to `main`) |
| Auth / DB / storage | Supabase (phase 3+) |
| Background jobs | Inngest (phase 4+) |
| AI | Anthropic API: Claude Sonnet for generation, Claude Haiku for the tutor (phase 5+) |
| File reading | pdf.js + JSZip in the browser; Claude PDF input + officeparser on the server |
| Validation | Zod: the course JSON schema lives in one Zod file and the TS types are inferred from it |
| Lesson text | react-markdown + remark-gfm + remark-math + rehype-katex (KaTeX for equations) |
| Tests | Vitest |
| Fonts | Inter (UI/body) and Fraunces (headings) via `next/font/google` |
| Package manager | npm |

## Folder layout

```
src/
  app/                      # routes only; keep pages thin
    globals.css             # Tailwind import + CSS variables for both themes + lesson prose styles
    layout.tsx              # fonts, theme bootstrap, background blobs
    page.tsx                # landing / course list
    course/[courseId]/
      page.tsx              # redirects to first (or last-visited) lesson
      [lessonId]/page.tsx   # classroom view
    login/page.tsx          # magic link + Google sign-in
    auth/callback/route.ts  # every sign-in lands here (token_hash or OAuth code)
    actions.ts              # server actions (sign out, save theme)
  proxy.ts                  # refreshes the Supabase session cookie (Next 16 name for middleware)
  components/
    classroom/              # CurriculumSidebar, LessonView, TutorPanel, TopBar...
    blocks/                 # one component per content block type (TextBlock, CalloutBlock...)
    ui/                     # generic pieces: Panel, Button, Drawer, BottomSheet, ThemeToggle
  lib/
    course/
      schema.ts             # Zod schema + inferred types for course JSON (single source of truth)
      rows.ts               # course JSON <-> table rows (pure, tested)
      save.ts               # write a whole course with the admin client (seed now, generation later)
      load.ts               # server reads via the user's client (RLS applies)
    supabase/               # server.ts (user, cookies), browser.ts, admin.ts (secret key, scripts/jobs only)
    progress.ts             # lesson progress reads
    theme.ts
  content/
    sample-course.json      # hand-written sample course (phase 2, from ENGR2722 week 7)
tests/                      # Vitest unit tests (*.test.ts)
scripts/                    # one-off Node scripts run with tsx (e.g. seedSampleCourse.ts)
supabase/migrations/        # SQL, applied by pasting into the Supabase SQL Editor (numbered, never edited once run)
```

Next.js here is v16: `params` are Promises, use the global `PageProps<"/route">` / `LayoutProps` helpers. See AGENTS.md: check `node_modules/next/dist/docs/` before using an API you're unsure of.

Rendering split: lesson content (markdown + KaTeX) renders in **server components**; interactive pieces (checks, step reveals, sidebars) are small client components that receive pre-rendered nodes as props.

## Naming

- Components: `PascalCase.tsx`, one component per file, named exports.
- Everything else (lib, hooks, utils): `camelCase.ts`. Hooks start with `use`.
- Route folders: lowercase kebab-case; dynamic segments `[courseId]`, `[lessonId]`.
- Course JSON keys: `camelCase`. Database columns: `snake_case` (map at the boundary in `lib/`).
- IDs in course JSON are strings, unique within the course, prefixed by kind (`u-`, `l-`, `b-`, `q-`, `c-`). **Never renumber or reuse an ID**: tutor messages, progress and bug reports point at them.

## Design rules

- All colours are CSS variables in `globals.css` (`--bg`, `--panel`, `--text`, `--accent`, `--blob-*`, `--mastery-*`), with a dark set (default) and a light set under `[data-theme="light"]`. Tailwind utilities reference the variables (`bg-panel`, `text-muted`, `border-line`, `text-accent`...); no hard-coded hex values in components. Use the `light:` variant for light-only tweaks.
- Dark mode is the default. The theme is set on `<html data-theme>` by an inline script before paint (no flash) and remembered in `localStorage` (per-user in the DB from phase 3).
- Panels: translucent + `backdrop-blur`, radius 12–16px. Body text 17–18px, max ~70ch.
- Layout: desktop = curriculum (~280px) | lesson (max 720px) | tutor (~380px), both sides collapsible. Tablet = curriculum drawer + collapsible tutor. Phone = curriculum drawer from left + tutor bottom sheet.
- Every animation respects `prefers-reduced-motion` (use `useReducedMotion` from `motion/react`).
- Mobile-first: check layouts at 375px, 768px and 1280px+.

## Commands

```bash
npm install          # install deps
npm run dev          # dev server at http://localhost:3000
npm run build        # production build (run before pushing)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit tests (schema validation, mastery formula, etc.)
npm run seed         # load/refresh the sample course in Supabase (safe to re-run; keeps progress)
```

Before calling a phase done: `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass, and the phase's "done when" check is handed to the user to try in the browser.

## Secrets and git

- API keys and service secrets go in `.env.local` only. It is gitignored; never commit it and never print key values.
- Keep `.env.example` up to date with the variable **names** (no values).
- Only `NEXT_PUBLIC_*` variables may reach the browser; the Anthropic key and Supabase service-role key are server-only.
- Schema changes: add a new numbered file in `supabase/migrations/` and ask the user to run it in the SQL Editor. Security: RLS on every table; browsers only use the publishable key.
- Never print `.env.local` values, even partially masked.
- Commit at the end of each phase (and at sensible checkpoints within one).

## Working with the user

- Tell the user explicitly whenever they need to: create an account, paste a key into `.env.local`, install something, or test something in the browser. Give exact steps.
- Propose data formats and schema changes before building on them.
- Windows machine, PowerShell shell.
