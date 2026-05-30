# Testlytic Design

## Product Focus

- Testlytic is a local-first desktop application for practicing and analyzing multiple-choice tests.
- The core objective is improving learning outcomes through structured practice and performance analytics.
- Questions, test sessions, and statistics belong to the user and remain stored locally.
- Analytics are a first-class feature, not an afterthought.
- The application prioritizes study efficiency over content creation.

---

## UX Principles

- Keep starting a test fast and frictionless.
- Make question navigation clear and predictable.
- Keep the user focused on answering questions, not managing settings.
- Present analytics in a visual and understandable way.
- Require confirmation before destructive actions.
- Preserve light/dark parity using shared theme tokens.
- Maintain a responsive desktop experience across different window sizes.
- Optimize for long study sessions with minimal cognitive load.

---

## Information Architecture

### Home

- quick statistics overview
- total questions available
- recent test sessions
- average score
- weakest topics
- quick start test actions
- import questions entry point

### Practice

- test configuration
- topic selection
- randomization options
- simulation mode
- active test session
- question navigation

### Analytics

#### Dashboard

- KPI cards
- performance trends
- topic breakdown
- weakest areas
- strongest areas
- progress charts

#### Test History

- search
- filters
- sorting
- pagination
- session details
- session deletion

### Question Bank

- imported question overview
- topic management
- category management
- tag filtering
- import validation results

### Settings

- language
- theme
- data management
- import preferences
- danger zone
- about metadata

---

## Question Bank Principles

- Questions are imported, not manually authored inside the application.
- JSON is the primary import format.
- Imported data must be validated before persistence.
- Invalid questions should never corrupt the database.
- Question metadata should remain extensible.
- Topics, categories, and tags must support future expansion.

---

## Test Session Principles

- Tests are generated from stored question banks.
- Question order is randomized by default.
- Users may skip questions and return later.
- Unanswered questions remain a first-class state.
- Negative marking rules must be configurable.
- Time tracking must remain accurate throughout the session.
- Test completion should preserve all answer data for later analysis.

---

## Confirmation Modal Principles

- Confirm before deleting questions.
- Confirm before deleting test history.
- Confirm before resetting analytics.
- Confirm before importing data that overwrites existing content.
- Cancel must preserve the current state.
- Confirm must execute the intended action without side effects.

---

## Analytics Principles

- Analytics derive from completed test sessions only.
- Historical results must remain immutable.
- Topic performance is calculated from all completed attempts.
- Accuracy percentages should always be clearly displayed.
- Trends should prioritize clarity over complexity.
- Analytics must remain understandable for non-technical users.

---

## Learning Analytics

### Core Metrics

- average score
- tests completed
- questions answered
- accuracy percentage
- average completion time
- improvement trend

### Topic Metrics

- best-performing topics
- weakest topics
- most attempted topics
- least attempted topics

### Question Metrics

- most failed questions
- most skipped questions
- hardest questions
- easiest questions

---

## Test Session UX

- Show one question at a time.
- Keep answer options visually clear.
- Highlight current progress.
- Display question position within the test.
- Provide quick navigation to unanswered questions.
- Preserve session state if the application is accidentally closed.
- Keep the interface distraction-free during active tests.

---

## Results UX

- Present results immediately after completion.
- Clearly separate correct, incorrect, and unanswered questions.
- Display score, accuracy, and completion time.
- Allow detailed answer review.
- Show topic-level performance breakdown.
- Surface actionable insights when possible.

---

## Visual System

- Tailwind utilities + shared CSS variables from `src/index.css`.
- Card-based layout focused on data visibility.
- Modern dashboard aesthetic inspired by Chronolytic.
- Consistent spacing and typography hierarchy.
- Minimal but meaningful animations.
- Visual emphasis on KPIs and analytics.
- Strong readability in both light and dark themes.

### Design Characteristics

- clean
- modern
- desktop-first
- analytics-focused
- minimalistic
- information-dense without feeling cluttered

---

## Dashboard Principles

- Most important metrics appear above the fold.
- Cards should communicate information at a glance.
- Charts should answer specific questions.
- Avoid decorative visualizations.
- Maintain consistency across all analytics views.

---

## Accessibility

- Keyboard navigation for all major actions.
- Visible focus states.
- Sufficient contrast ratios.
- Consistent interaction patterns.
- Readable typography at all supported sizes.

---

## Data Persistence

- SQLite is the single source of truth.
- JSON is used primarily for import and export.
- User data remains local by default.
- Schema evolution should be additive whenever possible.
- Data migrations must preserve existing study history.

---

## Implementation Boundaries

- Keep business logic out of React components.
- Keep persistence and SQL access inside repository modules.
- Keep analytics calculations pure and testable.
- Keep UI components reusable and presentation-focused.
- Prefer composition over large monolithic components.
- Maintain strict separation between domain, persistence, and presentation layers.

---

## Long-Term Vision

Testlytic should feel like a professional desktop application for learning analytics.

The goal is not simply to answer questions, but to help users understand how they learn, identify weaknesses, measure progress, and improve over time through meaningful data and structured practice.
