# Repository Guidelines

## Project Purpose

- Testlytic is a local-first desktop app for practicing and analyzing multiple-choice tests.
- Product direction: import JSON question banks, validate them, persist locally, generate practice/exam sessions, review results, and surface learning analytics.
- Current implementation is still a Tauri/Vite/React starter with the sample `greet` command; do not describe planned product features as already implemented.

## Stack And Commands

- Stack direction from docs: Tauri + React + TypeScript + Tailwind CSS + SQLite.
- Implemented today: Tauri 2, Vite 7, React 19, TypeScript; Tailwind and SQLite are product/design direction but are not wired in `package.json` yet.
- Use `pnpm` only; `package.json` pins `pnpm@11.1.2` and `pnpm-lock.yaml` is committed.
- Install deps with `pnpm install`; Node.js 22+ and a Rust toolchain are expected for desktop work.
- Frontend dev: `pnpm dev` (Vite fixed to port `1420`, strict port).
- Desktop dev: `pnpm tauri dev`; `src-tauri/tauri.conf.json` runs `pnpm dev` before launching Tauri.
- Frontend verification: `pnpm build` runs `tsc && vite build`.
- Rust/Tauri check: `cargo check --manifest-path src-tauri/Cargo.toml`.
- Full desktop package build: `pnpm tauri build`.
- There are currently no `lint`, `test`, `typecheck`, or `format:*` scripts in `package.json`; do not cite or run them until scripts are added.

## Branch And Commit Conventions

- Branch model from `CONTRIBUTING.md`: `main` for releases, `develop` for integration, and `feature/*`, `fix/*`, `refactor/*`, `chore/*` for work branches.
- Use Conventional Commits such as `feat: add question import validation`, `fix: correct score calculation`, `refactor: simplify analytics service`, `docs: update README`, `chore: update dependencies`, `test: add analytics unit tests`.
- Keep commits and PRs small and focused; update docs when behavior or product guidance changes.

## Architecture Rules

- Keep business rules out of React components; scoring, validation, import processing, test generation, and analytics should be pure/testable logic.
- Keep persistence and SQL access inside repository/persistence modules, never in UI components.
- Maintain a clear boundary between domain logic, persistence, and presentation.
- Questions are primarily imported from JSON, not manually authored in-app; validate before persistence and never let invalid imports corrupt storage.
- Tauri Rust entrypoints: `src-tauri/src/main.rs` starts the app, and `src-tauri/src/lib.rs` registers commands/plugins. Frontend calls Rust through Tauri `invoke`.

## UI/UX Rules

- Testlytic should visually feel like a sibling product to Chronolytic: modern, clean, desktop-first, card-based, analytics-first, and information-dense without clutter.
- Preserve light/dark parity with shared theme tokens when styling is introduced; avoid one-off colors that break theme consistency.
- Prioritize compact KPI cards, readable charts, clear dashboards, strong data hierarchy, and minimal but meaningful motion.
- Keep starting a test fast, question navigation predictable, and active test screens distraction-free.
- Require confirmation before destructive actions: deleting questions/history, resetting analytics, or importing data that overwrites existing content.
- Ensure keyboard navigation, visible focus states, sufficient contrast, and readable typography.

## Analytics Rules

- Analytics are a first-class feature and must derive from completed test sessions only.
- Historical results must remain immutable; preserve answer data needed for later review and analysis.
- Prefer clear metrics over clever ones: average score, tests completed, questions answered, accuracy, completion time, improvement trend, topic accuracy, weakest/strongest topics, and frequently missed/skipped questions.
- Keep calculations deterministic, transparent, reusable, and unit-testable; avoid misleading metrics.

## Persistence Rules

- SQLite is the intended local source of truth; user questions, sessions, history, and statistics remain on-device.
- JSON is the primary import/export format; typical planned flow is `JSON -> Validation -> SQLite -> Tests -> Analytics`.
- Prefer additive schema evolution and migrations that preserve study history.
- Do not commit local databases (`*.db`, `*.sqlite`, WAL/SHM files) or generated outputs.

## Testing Expectations

- Docs expect Vitest and colocated `*.test.ts` for TypeScript business logic, but Vitest is not installed yet.
- Prioritize tests for pure business logic: score calculations, negative marking, analytics, question validation, import processing, and statistics aggregation.
- Avoid expensive UI/E2E tests early unless they cover a real risk; business logic coverage is more valuable at this stage.
- Until test scripts exist, verify frontend changes with `pnpm build` and Rust/Tauri changes with `cargo check --manifest-path src-tauri/Cargo.toml`.

## Documentation Rules

- Documentation must reflect actual behavior; clearly mark future/planned behavior and do not imply unimplemented features exist.
- Keep `README.md`, `DESIGN.md`, `CONTRIBUTING.md`, and this file aligned when product direction, commands, architecture, or workflow changes.
- Trust executable config over prose when scripts/config disagree; for example, missing `package.json` scripts should not be listed as runnable commands.

## AI-Assisted Development Rules

- Prefer small, focused changes that preserve simplicity, maintainability, and practical usefulness.
- Before implementing product features, check whether the supporting stack is already wired; add dependencies/config intentionally and update lockfiles.
- Do not place scoring, analytics, validation, imports, or database calls directly inside presentation components.
- Preserve local-first behavior and avoid external services for user data unless explicitly requested.
- Do not commit generated outputs: `dist/`, `node_modules/`, `src-tauri/target/`, `src-tauri/gen/`, `coverage/`.
- Keep both lockfiles committed when dependencies change: `pnpm-lock.yaml` and `src-tauri/Cargo.lock`.
- TypeScript is strict and fails on unused locals/parameters; Prettier uses semicolons, double quotes, trailing commas, and `printWidth: 100`.
