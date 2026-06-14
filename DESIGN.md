# Testlytic Design

## Product Focus

- Testlytic is a local-first desktop app for practicing and analyzing multiple-choice tests.
- Questions, saved tests, completed attempts, recovery data, preferences, and analytics inputs remain on the user's device by default.
- Version `1.0.0` prioritizes import, practice, recovery, results, analytics, PDF export, and data safety over in-app question authoring.
- Analytics are a first-class feature and derive from completed test sessions and stored question-bank statistics.

## Current Information Architecture

### Question Bank

- First-run onboarding with JSON template download and import action.
- JSON validation before persistence.
- Duplicate detection and resolution when merging imports.
- Question-bank summary metrics.
- Search and filtering by question text, type, category, subcategory, and difficulty.
- Paginated table with horizontal scroll for dense banks.
- JSON export through an explicit user save action.

### Test

- Empty state when no question bank exists.
- Test definition modal with title, question count, categories, subcategories, time limit, negative marking, and unanswered-question settings.
- Saved test list with run and delete actions.
- Smart Selection generation from eligible stored questions.
- Active test execution with one question at a time, answer selection, progress, timer state, unanswered handling, and finish confirmation.
- Difficulty rating for questions during review/execution flows.
- Active test recovery after restart or accidental close.
- Results review with score, grade, accuracy, category breakdown, answer snapshots, explanations, and retry metrics.
- PDF export for generated test content.

### Analytics

- User analytics from completed attempts only.
- Question-bank analytics from stored question metadata and exposure history.
- Filters for date range, category, and subcategory.
- KPI cards, trend bars, distribution bars, ranking lists, insight panels, and Smart Selection health.

### Settings

- Language selection for English and Spanish.
- Light/dark theme switching through shared theme tokens.
- Destructive data actions with confirmation.
- About metadata including app version.

## UX Principles

- Keep importing and starting tests fast.
- Validate before persistence and never let invalid imports corrupt local storage.
- Keep active tests distraction-free.
- Make question navigation, unanswered states, timer state, and finish rules clear.
- Preserve recovery options after interrupted sessions.
- Require confirmation before destructive actions.
- Keep analytics readable, deterministic, and actionable.
- Preserve light/dark parity using shared theme tokens.
- Maintain keyboard access, visible focus states, sufficient contrast, and readable typography.

## Question Bank Principles

- Questions are imported from JSON, not manually authored inside the app.
- JSON schema version `"1"` is the current import/export format.
- Required fields are question text, question type, options, correct option IDs, and category.
- Optional metadata includes auxiliary information, explanation, subcategory, source, and option shuffling.
- Imported data must be validated before persistence.
- Exports are user-initiated and should not include private data unless the user chooses to save it.

## Test Session Principles

- Tests are generated from stored SQLite question data.
- Smart Selection should favor unseen and under-exposed questions while using performance and difficulty signals.
- Question option order may be shuffled according to question settings.
- Unanswered questions are preserved as a distinct state.
- Negative marking is configurable per saved test definition.
- Timed tests must surface warning/critical states clearly.
- Completion must preserve answer snapshots for later review and analytics.
- Active recovery must preserve enough state to resume an interrupted test.

## Results And Analytics Principles

- Results appear immediately after completion.
- Results separate correct, incorrect, unanswered, original, and retry data clearly.
- Historical completed attempts should remain immutable.
- Analytics derive from completed sessions and stored question statistics only.
- Prefer transparent metrics: average grade, tests completed, questions answered, accuracy, completion time, trends, topic accuracy, strongest/weakest topics, missed questions, exposure, difficulty coverage, and Smart Selection health.
- Avoid metrics that imply precision not supported by the data.

## Visual System

- The current visual system uses shared CSS variables in `src/index.css` plus feature CSS files.
- Tailwind CSS is installed and imported, but the v1.0.0 release does not require a styling migration.
- The UI should feel modern, desktop-first, card-based, analytics-forward, and information-dense without clutter.
- Keep light/dark behavior token-driven instead of one-off color overrides.
- Preserve meaningful motion for switches, selectors, and state changes without distracting from study flows.

## Accessibility

- All primary actions should be keyboard reachable.
- Focus states must remain visible in both themes.
- Modals and confirmation flows must be understandable and operable without a mouse.
- Form fields require clear labels and error text.
- Tables and dense analytics views should remain readable at supported desktop sizes.

## Data Persistence And Privacy

- SQLite is the local source of truth.
- The app creates `testlytic.sqlite` in the per-user Tauri app data directory.
- Local databases, WAL/SHM files, exported banks, and private question banks must not be committed or shipped accidentally.
- JSON and PDF exports are explicit user actions.
- Release artifacts must be inspected for private data before publication.

## Implementation Boundaries

- Keep scoring, validation, import processing, test generation, Smart Selection, analytics, and PDF payload preparation testable outside presentation components where practical.
- Keep SQL and persistence inside Rust/Tauri persistence code rather than React UI components.
- Preserve a clear boundary between domain logic, persistence, and presentation.
- Prefer small, focused changes for release preparation.
