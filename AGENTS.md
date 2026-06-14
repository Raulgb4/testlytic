# Repository Guidelines

## Project Purpose

- Testlytic is a local-first desktop app for importing, practicing, and analyzing multiple-choice tests.
- Version `1.0.0` implements JSON question-bank import/validation, local SQLite persistence, saved tests, Smart Selection, test execution, active recovery, timer support, results review, analytics, PDF export, settings, i18n, and light/dark mode.
- Do not describe future ideas as implemented behavior. Documentation must match executable config and current code.

## Stack And Commands

- Implemented stack: Tauri 2, Vite 7, React 19, TypeScript, Tailwind CSS 4, Vitest, and SQLite through Rust `rusqlite`.
- Use `pnpm` only; `package.json` pins `pnpm@11.1.2` and `pnpm-lock.yaml` is committed.
- Requirements: Node.js 22+, pnpm 11.1.2, and a Rust toolchain.
- Install deps with `pnpm install`.
- Frontend dev: `pnpm dev` (Vite fixed to port `1420`, strict port).
- Desktop dev: `pnpm tauri dev`; `src-tauri/tauri.conf.json` runs `pnpm dev` before launching Tauri.
- Full validation: `pnpm run validate`.
- Frontend build: `pnpm run build` runs `tsc && vite build`.
- Rust format check: `pnpm run rust:format:check`.
- Rust clippy: `pnpm run rust:clippy`.
- Desktop package build: `pnpm tauri build`.

## Branch And Commit Conventions

- Branch model from `CONTRIBUTING.md`: `main` for releases, `develop` for integration, and `feature/*`, `fix/*`, `refactor/*`, `chore/*` for work branches.
- Use Conventional Commits such as `feat: add question import validation`, `fix: correct score calculation`, `refactor: simplify analytics service`, `docs: update README`, `chore: update dependencies`, `test: add analytics unit tests`.
- Keep commits and PRs small and focused; update docs when behavior, commands, product guidance, or release metadata changes.

## Architecture Rules

- Keep business rules out of React components; scoring, validation, import processing, Smart Selection, test generation, analytics, and PDF payload preparation should be pure/testable where practical.
- Keep persistence and SQL access inside Rust/Tauri persistence code, never in UI components.
- Maintain a clear boundary between domain logic, persistence, and presentation.
- Questions are imported from JSON, not manually authored in-app; validate before persistence and never let invalid imports corrupt storage.
- Tauri Rust entrypoints: `src-tauri/src/main.rs` starts the app, and `src-tauri/src/lib.rs` registers commands/plugins. Frontend calls Rust through Tauri `invoke`.

## UI/UX Rules

- Testlytic should visually feel like a sibling product to Chronolytic: modern, clean, desktop-first, card-based, analytics-first, and information-dense without clutter.
- Preserve light/dark parity with shared theme tokens; avoid one-off colors that break theme consistency.
- Prioritize compact KPI cards, readable charts, clear dashboards, strong data hierarchy, and minimal but meaningful motion.
- Keep starting a test fast, question navigation predictable, and active test screens distraction-free.
- Require confirmation before destructive actions: deleting answers/history, deleting saved tests, resetting the question bank, and other destructive local-data actions.
- Ensure keyboard navigation, visible focus states, sufficient contrast, and readable typography.
- Postpone Tailwind migration unless explicitly requested; v1.0.0 release prep should not include styling migration work.

## Analytics Rules

- Analytics are a first-class feature and must derive from completed test sessions and stored question statistics only.
- Historical results must remain immutable; preserve answer snapshots needed for later review and analysis.
- Prefer clear metrics over clever ones: average grade, tests completed, questions answered, accuracy, completion time, improvement trend, topic accuracy, weakest/strongest topics, frequently missed/skipped questions, exposure, difficulty coverage, and Smart Selection health.
- Keep calculations deterministic, transparent, reusable, and unit-testable; avoid misleading metrics.

## Persistence And Privacy Rules

- SQLite is the local source of truth; user questions, saved tests, sessions, history, recovery data, preferences, and statistics remain on-device.
- JSON is the primary import/export format; current flow is `JSON -> Validation -> SQLite -> Tests -> Results -> Analytics`.
- The app creates `testlytic.sqlite` in the per-user Tauri app data directory.
- Prefer additive schema evolution and migrations that preserve study history.
- Do not commit or ship private question banks, exported question-bank JSON files, local databases (`*.db`, `*.sqlite`, `*.sqlite3`, WAL/SHM files), or generated release/build outputs.
- Release artifacts must be inspected to ensure they do not include private questions or local user data.

## Testing Expectations

- Vitest is installed and `pnpm test` runs colocated `*.test.ts` and `*.test.tsx` tests.
- Prioritize tests for pure business logic: score calculations, negative marking, analytics, question validation, import processing, Smart Selection, runtime utilities, PDF payload generation, and statistics aggregation.
- Avoid expensive UI/E2E tests unless they cover a real release risk; business logic coverage is more valuable at this stage.
- Before merging or releasing, run `pnpm run validate`.
- For release packaging, also run `pnpm tauri build`.

## Documentation Rules

- Documentation must reflect actual behavior; clearly mark future/planned behavior and do not imply unimplemented features exist.
- Keep `README.md`, `DESIGN.md`, `CONTRIBUTING.md`, and this file aligned when product direction, commands, architecture, privacy expectations, or workflow changes.
- Trust executable config over prose when scripts/config disagree.

## AI-Assisted Development Rules

- Prefer small, focused changes that preserve simplicity, maintainability, and practical usefulness.
- Before implementing product features, check whether the supporting stack is already wired; add dependencies/config intentionally and update lockfiles.
- Do not place scoring, analytics, validation, imports, Smart Selection, PDF export logic, or database calls directly inside presentation components.
- Preserve local-first behavior and avoid external services for user data unless explicitly requested.
- Do not commit generated outputs: `dist/`, `node_modules/`, `src-tauri/target/`, `src-tauri/gen/`, `coverage/`.
- Keep both lockfiles committed when dependencies change: `pnpm-lock.yaml` and `src-tauri/Cargo.lock`.
- TypeScript is strict and fails on unused locals/parameters; Prettier uses semicolons, double quotes, trailing commas, and `printWidth: 100`.
