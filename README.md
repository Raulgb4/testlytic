# Testlytic

Testlytic is a local-first desktop app for importing, practicing, and analyzing multiple-choice tests.

Version `1.0.0` focuses on user-owned question banks, deterministic local persistence, configurable test sessions, recovery, PDF export, and learning analytics. User data stays on the device unless the user explicitly exports it.

## Features

- JSON question-bank import with validation before persistence.
- Local SQLite persistence for questions, saved tests, preferences, completed attempts, analytics inputs, and active test recovery.
- Question Bank screen with import, duplicate handling, filtering, pagination, reset confirmation, and JSON export.
- Saved test definitions with category/subcategory filters, question limits, timer settings, unanswered-question rules, and negative marking.
- Smart Selection for generated tests, prioritizing unseen and lower-exposure questions while using historical performance and difficulty signals.
- Test execution with single-choice and multiple-choice questions, shuffled options, unanswered states, timer warnings, retry/review support, and manual difficulty ratings.
- Active test recovery after app restart or accidental close.
- Results review with score, grade, accuracy, category breakdown, answer snapshots, explanations, and retry metrics.
- Analytics for completed sessions and question-bank health, including KPIs, trends, topic performance, missed questions, exposure, difficulty coverage, and Smart Selection health.
- PDF export for generated tests.
- Settings for English/Spanish UI, light/dark theme, destructive data actions, and app metadata.

## Privacy And Local Data

- Testlytic does not ship with a private question bank.
- Imported questions are stored locally in a per-user SQLite database named `testlytic.sqlite` under the Tauri app data directory.
- Question-bank JSON exports and PDF exports are created only when the user chooses to save them.
- Do not commit private question banks, exported question-bank JSON files, local SQLite databases, or release artifacts that contain user data.
- The repository `.gitignore` excludes local database files such as `*.db`, `*.sqlite`, `*.sqlite3`, WAL, and SHM files.

## Import Format

Question banks use JSON schema version `"1"`.

```json
{
  "version": "1",
  "questions": [
    {
      "question": "Which metric best tracks study consistency over time?",
      "auxiliaryInformation": "Pick the most representative analytics metric.",
      "questionType": "single_choice",
      "options": [
        { "id": "a", "text": "Maximum single score" },
        { "id": "b", "text": "Average score across completed tests" },
        { "id": "c", "text": "Most recent topic attempted" }
      ],
      "correctOptions": ["b"],
      "shuffleOptions": true,
      "correctAnswerExplanation": "Average score across completed tests is stable over time.",
      "questionCategory": "Analytics",
      "questionSubcategory": "Core Metrics",
      "questionSource": "Template"
    }
  ]
}
```

Required question fields:

- `question`
- `questionType`: `single_choice` or `multiple_choice`
- `options`: array of `{ id, text }`
- `correctOptions`: array of option IDs
- `questionCategory`

Optional fields:

- `auxiliaryInformation`
- `shuffleOptions`
- `correctAnswerExplanation`
- `questionSubcategory`
- `questionSource`

The app validates imported JSON before writing to SQLite. Invalid imports do not replace stored questions.

## Setup

Requirements:

- Node.js `22+`
- pnpm `11.1.2`
- Rust toolchain

Install dependencies:

```bash
pnpm install
```

Run the desktop app in development:

```bash
pnpm tauri dev
```

Run the full validation gate:

```bash
pnpm run validate
```

Build desktop installers/packages:

```bash
pnpm tauri build
```

## Commands

- `pnpm dev`: start the Vite dev server on port `1420`.
- `pnpm tauri dev`: run the Tauri desktop app and start Vite first.
- `pnpm run format:check`: check Prettier formatting.
- `pnpm run typecheck`: run TypeScript with `--noEmit`.
- `pnpm test`: run the Vitest suite.
- `pnpm run build`: run `tsc && vite build`.
- `pnpm run rust:format:check`: run Rust formatting checks.
- `pnpm run rust:clippy`: run Rust clippy with warnings denied.
- `pnpm run validate`: run the full local pre-merge gate.
- `pnpm tauri build`: create release bundles/installers.

## Validation And CI

GitHub CI installs dependencies with `pnpm install --frozen-lockfile` and runs the same quality gates as `pnpm run validate`.

Before release or merge, run:

```bash
pnpm run validate
```

For release packaging, also run:

```bash
pnpm tauri build
```

## Architecture

Testlytic follows this data flow:

```text
JSON -> Validation -> SQLite -> Tests -> Results -> Analytics
```

- React and TypeScript own the UI.
- Tauri commands bridge the frontend to Rust persistence and selection logic.
- SQLite is the local source of truth.
- Import validation, scoring, analytics, PDF payload preparation, and test runtime logic are kept testable outside presentation components where practical.

## Release Safety

Before publishing a release:

- Confirm `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, Settings About, and recovery metadata use the same app version.
- Run `pnpm run validate`.
- Run `pnpm tauri build`.
- Inspect release artifacts and confirm no private question banks, exported JSON banks, local SQLite databases, or generated development outputs are included.
