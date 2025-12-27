# Repository Guidelines

## Project Structure & Module Organization

- `src/`: App code. Key files: `main.ts` (entry), `scene.ts` (Three.js scene), `book.ts` (book mesh assembly), `textures.ts` (canvas textures), `markdownRenderer.ts` (canvas markdown), `bookContent.ts` (page data). Assets in `src/assets/`.
- `public/`: Static files served as-is.
- Root config: `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `index.html`.
- Prefer colocating helpers near usage. React components in `*.tsx`; Three/utility modules in `*.ts`.

## Build, Test, and Development Commands

- `pnpm dev`: Start Vite dev server with HMR.
- `pnpm build`: Type-check (`tsc -b`) and build production bundle.
- `pnpm preview`: Preview the production build locally.
- `pnpm lint`: Run ESLint on the project.

## Coding Style & Naming Conventions

- TypeScript, ES modules, 2-space indentation, semicolons, single quotes.
- Filenames: modules `camelCase` (e.g., `pageUtils.ts`), types `PascalCase` (e.g., `BookTypes.ts`).
- Exports: prefer named exports for utilities; default export acceptable for single-purpose modules.
- Linting: ensure `pnpm lint` passes. Config in `eslint.config.js` (flat config with TypeScript rules).

## Testing Guidelines

- No test runner is configured yet. If adding logic-heavy code, include lightweight tests using Vitest and colocate under `src/**/__tests__` with `*.test.ts` naming. Example: `src/markdown/__tests__/wrapText.test.ts`.
- For visual/interaction changes, attach a short screen recording or GIF in the PR and list manual steps to verify.

## Commit & Pull Request Guidelines

- Commit style: use concise, imperative messages. Conventional Commits are encouraged for clarity. Examples:
  - `feat(scene): add page flip animation`
  - `fix(renderer): avoid z-fighting on pages`
  - `chore: update eslint config`
- PRs should include: clear description, linked issue (if any), before/after screenshots or GIFs for UI changes, steps to run (`pnpm dev`), and a checklist that `pnpm lint` passes and build succeeds.

## Security & Configuration Tips

- Do not commit secrets. If environment variables are introduced, access via `import.meta.env` and document them in the README.
- Place large assets in `public/` or `src/assets/`; prefer optimized textures to keep bundle size reasonable.
