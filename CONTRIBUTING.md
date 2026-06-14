# Contributing to Testlytic

Thanks for contributing.

## Project Philosophy

Testlytic is a local-first desktop application for practicing and analyzing multiple-choice tests.

The project prioritizes:

- Simplicity
- Maintainability
- Performance
- Clean architecture
- Practical usefulness
- Data-driven learning analytics

Contributors should favor small, focused improvements over large, complex changes.

---

## Prerequisites

- Node.js 22+
- pnpm
- Rust toolchain (required for Tauri development and builds)

Verify your environment:

```bash
node --version
pnpm --version
rustc --version
```

---

## Setup

Install dependencies:

```bash
pnpm install
```

Start the application:

```bash
pnpm tauri dev
```

---

## Branching and Commits

### Branch Model

```text
main
└── develop
    ├── feature/*
    ├── fix/*
    ├── refactor/*
    └── chore/*
```

### Branch Purpose

- `main`: production-ready releases
- `develop`: integration branch
- `feature/*`: new functionality
- `fix/*`: bug fixes
- `refactor/*`: internal improvements
- `chore/*`: maintenance and tooling

### Commit Messages

Use Conventional Commits:

```text
feat: add question import validation
fix: correct score calculation
refactor: simplify analytics service
docs: update README
chore: update dependencies
test: add analytics unit tests
```

Keep commits focused and easy to review.

---

## Validation Before Pull Request

Run the same frontend quality gates used by GitHub CI before creating a pull request:

```bash
pnpm run validate
```

The validation command runs:

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

The application should start without errors.

---

## Testing Expectations

### Unit Testing

- Use Vitest.
- Keep tests colocated using `*.test.ts`.
- Prioritize testing business logic.
- Prefer pure functions whenever possible.

### What Should Be Tested

Examples:

- score calculations
- negative marking rules
- analytics calculations
- question validation
- import processing
- statistics aggregation

### What Should Not Be Tested First

Avoid adding complex UI or end-to-end tests unless there is a clear need.

Business logic coverage is more valuable than UI coverage during early development.

---

## Architecture Guidelines

### Business Logic

Keep business rules outside React components.

Avoid:

```tsx
<QuestionResults score={calculateScore(answers, settings)} />
```

Prefer:

```ts
const score = calculateScore(answers, settings);
```

and pass the result to the component.

### Persistence

All database access should remain inside repository or persistence modules.

UI components should never execute SQL directly.

### Analytics

Analytics calculations should be:

- pure
- reusable
- deterministic
- unit-testable

### Components

Prefer:

- small components
- composable components
- reusable components

Avoid large monolithic screens.

---

## Data and Persistence Rules

### Source of Truth

SQLite is the single source of truth.

### Import Format

JSON is the primary import format.

Typical flow:

```text
JSON → Validation → SQLite → Tests → Analytics
```

### Data Integrity

- Never import invalid questions.
- Preserve user history whenever possible.
- Prefer additive schema evolution.
- Avoid destructive migrations.

---

## Question Bank Rules

Questions are primarily imported rather than manually authored.

A valid question should contain:

- statement
- answer options
- correct answer
- topic or category

Optional fields may include:

- explanation
- tags
- difficulty

Validation should happen before persistence.

---

## Analytics Rules

Analytics should derive from completed test sessions only.

Historical results must remain immutable.

When implementing analytics:

- prioritize clarity
- avoid misleading metrics
- keep calculations transparent
- prefer understandable insights over excessive complexity

---

## Documentation Rules

Documentation must reflect actual behavior.

Do not document features that have not been implemented.

Keep the following documents updated when relevant:

- README.md
- DESIGN.md
- AGENTS.md
- CONTRIBUTING.md

---

## Internationalization

If the application introduces localization:

- add strings to all supported languages
- keep translation keys consistent
- avoid hardcoded user-facing strings

---

## Generated Files Policy

Do not commit generated outputs:

```text
dist/
node_modules/
src-tauri/target/
src-tauri/gen/
coverage/
```

Version-controlled lock files:

```text
pnpm-lock.yaml
Cargo.lock
```

must remain committed.

---

## Pull Request Guidelines

Before opening a pull request:

- ensure CI passes
- keep scope limited
- update documentation if needed
- include tests when business logic changes
- verify desktop runtime behavior

Prefer multiple small pull requests over large feature dumps.

---

## Additional Guidance

See:

- `README.md` for project overview
- `DESIGN.md` for product and UX principles
- `AGENTS.md` for repository-specific engineering constraints

When unsure, choose the simpler solution.
