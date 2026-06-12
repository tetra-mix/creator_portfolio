# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A 3D interactive portfolio: a Three.js book sitting on a desk that the visitor opens
and flips through. Each spread of pages renders Markdown content (sourced from
microCMS) onto canvas textures. It ships as a static site to GitHub Pages under the
`/creator_portfolio/` base path.

Despite `react`, `react-dom`, and `@vitejs/plugin-react-swc` being installed, **there
are no React components** — the app is plain Three.js + TypeScript bootstrapped from
`src/app/main.ts`. Don't reach for React/JSX unless you're deliberately introducing it.

## Commands

- `pnpm dev` — Vite dev server with HMR.
- `pnpm build` — `tsc -b` type-check, then Vite production build.
- `pnpm preview` — serve the production build locally.
- `pnpm lint` / `pnpm lint:fix` — ESLint.
- `pnpm format` / `pnpm format:check` — Prettier.
- `pnpm fetch:content` — pull content from microCMS into `public/content.json` (uses `.env`).

There is **no test runner configured**. AGENTS.md suggests Vitest with colocated
`src/**/__tests__/*.test.ts` if you add logic-heavy code, but none exists yet.

`.husky/pre-push` runs `format:check`, `lint`, and `build` — all three must pass to push.

Use **pnpm** (not npm/yarn). Vite is pinned to `rolldown-vite` via a pnpm override.

## Architecture

Entry flow in `src/app/main.ts`:

1. `loadBookContent()` fetches `public/content.json` (falling back to the bundled
   `bookContent.ts` array). The result is `string[]` — one Markdown string per content page.
2. `CONFIG.pageCount` is set at runtime to `ceil(content.length / 2)` — **two content
   pages (front + back) per physical sheet/spread**. This 2:1 mapping is the single most
   important invariant; tab navigation and flip math all depend on it.
3. The scene, desk, book mesh, props, and sticky tabs are built; `setupInteractions` wires
   up pointer/raycaster handling.

Module layout (feature-first under `src/`):

- `shared/three/` — `config.ts` (the central tunable `CONFIG` object: geometry, colors,
  lighting, tabs, animation), `scene.ts` (camera/renderer/lights; **OrbitControls is
  disabled** — the camera is locked and only auto-fits to viewport), `types.ts` (the
  `userData` contracts attached to meshes).
- `features/book/` — `book.ts` builds desk + book geometry (back cover, pivoting front
  cover, and `pageCount` page groups, each with front/back meshes). `tabs.ts` attaches
  sticky-note tabs parented to specific page meshes. `props.ts` adds pencil/mug.
- `features/content/` — `loader.ts` (fetch + fallback), `state.ts` (module-level singleton
  holding current content; read via `getBookContent()`), `bookContent.ts` (offline fallback).
- `features/interaction/` — `interactions.ts` is the largest/most subtle file: raycasting,
  cover open/close, page flipping, the "tap to open" teaser animation, viewport-based camera
  scaling, tab navigation (`navigateToFlipCount`), and link click handling. `linkRegistry.ts`
  maps UV hit coordinates on a page back to clicked link URLs.
- `shared/render/textures.ts` — generates canvas textures (procedural wood for the desk,
  per-page Markdown textures, cached by `index:side`).
- `shared/markdown/markdownRenderer.ts` — a **hand-rolled Markdown→canvas renderer** (no
  markdown library). Handles headings, images, tables, and links, and records `LinkRect`s so
  clicks can be hit-tested. URL resolution respects the Vite `BASE_URL` for site-root paths.

### Key conventions / gotchas

- **`userData` is the type system for meshes.** Interactions discover what an object is by
  reading typed `userData` (`isCover`, `isPageMesh`, `pageIndex`, `isTab`, etc. — defined in
  `shared/three/types.ts`). When adding interactive geometry, attach the matching `userData`.
- **Physical page index is reversed vs. logical reading order** — page group index
  `total - 1 - spreadIndex`. Flip counts (`computeDesiredFlipsFromObject`,
  `navigateToFlipCount`) encode this; mirror that logic rather than reinventing it.
- **Back-side textures/UVs are mirrored.** `makeSetPageTexture` and the link hit-test flip
  UV/rotation for `side === 'back'`. Account for this when touching page rendering or links.
- Tabs are configured in `CONFIG.tabs` with **1-based** `pageIndex` for UX, converted to
  0-based + spread index internally.
- Animations go through GSAP with `CONFIG.animDuration` / `CONFIG.animEase`; a `busy` flag in
  interactions guards against overlapping flip sequences.
- `window.setPageTexture(pageIndex, texture, side)` is exposed globally (typed in
  `src/global.d.ts`) for runtime texture swaps.

## Content pipeline

microCMS list JSON → `scripts/transform-microcms.mjs` → array of Markdown strings →
`public/content.json`. The transform accepts several microCMS shapes; when items carry a
`num` field it maps them to explicit 1-based page slots (filling gaps with empty strings),
otherwise it falls back to order/sort. The deploy workflow
(`.github/workflows/deploy.yml`) fetches content at build time using `MICROCMS_*` repo
secrets, then builds and uploads `dist/` to GitHub Pages (with a `404.html` SPA fallback).

`.env` holds microCMS credentials for local `fetch:content`. Note the committed `.env`
contains a live-looking API key — treat it as a secret and do not propagate it.

## Style

TypeScript, ES modules, 2-space indent, single quotes, semicolons, trailing commas,
`printWidth` 100 (Prettier-enforced). `tsconfig.app.json` is strict with `noUnusedLocals`
and `noUnusedParameters` — unused symbols fail the build. Filenames `camelCase`, types
`PascalCase`. Prefer named exports for utilities. Colocate helpers near usage.
