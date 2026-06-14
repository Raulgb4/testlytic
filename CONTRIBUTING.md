# Contributing to Testlytic

Thanks for contributing to Testlytic.

## Project Philosophy

Testlytic is a local-first desktop application for importing, practicing, and analyzing multiple-choice tests.

The project prioritizes:

- Simplicity
- Maintainability
- Data integrity
- Local-first privacy
- Clean architecture
- Practical usefulness
- Data-driven learning analytics

Favor small, focused improvements over large, risky changes.

## Prerequisites

- Node.js `22+`
- pnpm `11.1.2`
- Rust toolchain

Verify your environment:

```bash
node --version
pnpm --version
rustc --version
```

## Setup

Install dependencies:

```bash
pnpm install
```

Run the desktop app:

```bash
pnpm tauri dev
```

Build desktop release artifacts:

```bash
pnpm tauri build
```

## Branching And Commits

Branch model:

```text
main
└── develop
    ├── feature/*
    ├── fix/*
    ├── refactor/*
    └── chore/*
```

- `main`: production-ready releases.
- `develop`: integration branch.
- `feature/*`: new functionality.
- `fix/*`: bug fixes.
- `refactor/*`: internal improvements.
- `chore/*`: maintenance and tooling.

Use Conventional Commits:

```text
feat: add question import validation
fix: correct score calculation
refactor: simplify analytics service
docs: update README
chore: update dependencies
test: add analytics unit tests
```

## Validation Before Pull Request

Run the same quality gates used by GitHub CI:

```bash
pnpm run validate
```

This runs:

```bash
pnpm run format:check
pnpm run typecheck
pnpm test
pnpm run build
pnpm run rust:format:check
pnpm run rust:clippy
```

GitHub CI installs dependencies with `pnpm install --frozen-lockfile` and then runs the same gates.

When runtime or desktop behavior changes, also verify:

```bash
pnpm tauri dev
```

For release work, verify packaging with:

```bash
pnpm tauri build
```

## Current v1.0.0 Feature Surface

Contributors may work around these implemented areas:

- JSON question-bank import and validation.
- SQLite persistence for questions, saved tests, attempts, recovery data, preferences, and analytics inputs.
- Question Bank management with filtering, duplicate handling, reset confirmation, and JSON export.
- Saved tests with category/subcategory filters, timers, unanswered settings, and negative marking.
- Smart Selection for generated test questions.
- Test execution, active recovery, timer states, results, retry/review data, and difficulty ratings.
- Analytics for completed attempts and question-bank health.
- PDF export.
- Settings, English/Spanish i18n, and light/dark mode.

Do not document or present unimplemented ideas as shipped features.

## Architecture Guidelines

### Business Logic

Keep business rules outside React components where practical.

Examples of business logic:

- import validation
- duplicate handling
- scoring
- negative marking
- Smart Selection
- runtime queue handling
- analytics calculations
- PDF payload generation

### Persistence

SQLite is the local source of truth. UI components must not execute SQL directly.

The current flow is:

```text
JSON -> Validation -> SQLite -> Tests -> Results -> Analytics
```

Rust/Tauri commands own database access, migrations, and persistence operations.

### Analytics

Analytics should be:

- derived from completed sessions and stored question statistics
- deterministic
- transparent
- reusable
- unit-testable

Historical completed attempts should remain immutable.

## Import Format Rules

Question banks use JSON schema version `"1"`.

Required question fields:

- `question`
- `questionType`: `single_choice` or `multiple_choice`
- `options`
- `correctOptions`
- `questionCategory`

Optional fields:

- `auxiliaryInformation`
- `shuffleOptions`
- `correctAnswerExplanation`
- `questionSubcategory`
- `questionSource`

Validation must happen before persistence. Invalid imports must not corrupt or replace valid local data.

## Privacy And Generated Files

User data stays local by default. Private question banks must not be committed.

Never commit or ship:

```text
dist/
node_modules/
src-tauri/target/
src-tauri/gen/
coverage/
*.db
*.db-shm
*.db-wal
*.sqlite
*.sqlite3
private question-bank JSON files
exported question-bank JSON files containing private questions
```

Version-controlled lock files:

```text
pnpm-lock.yaml
src-tauri/Cargo.lock
```

must remain committed when dependencies or Rust package metadata change.

Before publishing release artifacts, inspect them to ensure they do not contain private questions, local SQLite databases, or generated development outputs.

## Documentation Rules

Documentation must reflect actual behavior.

Keep these files aligned when behavior, commands, architecture, privacy expectations, or release workflow changes:

- `README.md`
- `DESIGN.md`
- `AGENTS.md`
- `CONTRIBUTING.md`

## Internationalization

For user-facing strings:

- add strings to all supported languages
- keep translation keys consistent
- avoid hardcoded user-facing text unless it is stable metadata such as app version/license

## Pull Request Guidelines

Before opening a pull request:

- keep scope limited
- run `pnpm run validate`
- update documentation if behavior or workflow changes
- include tests when business logic changes
- verify desktop runtime behavior when relevant
- ensure CI passes

Prefer multiple small pull requests over large feature dumps.
