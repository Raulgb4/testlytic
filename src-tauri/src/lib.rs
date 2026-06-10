use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};

struct DbState {
    conn: Mutex<Connection>,
}

type CommandResult<T> = Result<T, String>;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct QuestionOptionDto {
    id: String,
    text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct QuestionAnalyticsDto {
    computed_difficulty: String,
    user_declared_difficulty: String,
    times_answered_incorrectly: i64,
    times_answered_correctly: i64,
    exposure_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QuestionExposureDto {
    question_id: String,
    exposure_count: i64,
}

#[derive(Debug, Clone)]
struct QuestionSelectionStats {
    exposure_count: i64,
    original_answer_count: i64,
    original_correct_count: i64,
    original_incorrect_count: i64,
    last_seen_at: Option<String>,
    last_correct_at: Option<String>,
    last_incorrect_at: Option<String>,
}

#[derive(Debug, Clone)]
struct ScoredQuestion {
    question: CollectionQuestionDto,
    stats: QuestionSelectionStats,
    score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CollectionQuestionDto {
    id: String,
    question: String,
    auxiliary_information: Option<String>,
    question_type: String,
    options: Vec<QuestionOptionDto>,
    correct_options: Vec<String>,
    shuffle_options: bool,
    correct_answer_explanation: Option<String>,
    question_category: String,
    question_subcategory: Option<String>,
    question_source: Option<String>,
    analytics: QuestionAnalyticsDto,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct QuestionCollectionSummaryDto {
    total_questions: i64,
    total_categories: i64,
    total_subcategories: i64,
    total_single_choice: i64,
    total_multiple_choice: i64,
    total_sources: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct QuestionCollectionDto {
    version: String,
    imported_at: String,
    questions: Vec<CollectionQuestionDto>,
    summary: QuestionCollectionSummaryDto,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImportedQuestionDto {
    question: String,
    auxiliary_information: Option<String>,
    question_type: String,
    options: Vec<QuestionOptionDto>,
    correct_options: Vec<String>,
    shuffle_options: bool,
    correct_answer_explanation: Option<String>,
    question_category: String,
    question_subcategory: Option<String>,
    question_source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ImportedQuestionCollectionDto {
    version: String,
    questions: Vec<ImportedQuestionDto>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct DuplicateQuestionPreviewDto {
    fingerprint: String,
    question: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImportQuestionCollectionRequest {
    collection: QuestionCollectionDto,
    merge: bool,
    resolution: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "status")]
enum ImportQuestionCollectionResponse {
    Imported {
        collection: QuestionCollectionDto,
    },
    Conflict {
        duplicate_questions: Vec<DuplicateQuestionPreviewDto>,
    },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TestDefinitionDto {
    id: String,
    title: String,
    question_limit: i64,
    included_categories: Vec<String>,
    included_subcategories: Option<Vec<String>>,
    allow_unanswered: bool,
    time_limit_enabled: Option<bool>,
    negative_marking_enabled: bool,
    penalty_per_incorrect_answer: f64,
    time_limit_minutes: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CategoryAttemptResultDto {
    category: String,
    correct: i64,
    incorrect: i64,
    unanswered: i64,
    total: i64,
    accuracy_percentage: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompletedAttemptDto {
    id: String,
    test_id: String,
    test_title: String,
    started_at: String,
    completed_at: String,
    duration_seconds: i64,
    total_questions: i64,
    correct_answers: i64,
    incorrect_answers: i64,
    unanswered_questions: i64,
    raw_score: f64,
    final_score: f64,
    accuracy_percentage: f64,
    grade_out_of_10: f64,
    retry_attempts: i64,
    retry_correct_answers: i64,
    retry_incorrect_answers: i64,
    category_results: Vec<CategoryAttemptResultDto>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AttemptAnswerSnapshotDto {
    queue_id: String,
    source_question_id: String,
    retry_number: i64,
    question: CollectionQuestionDto,
    selected_option_ids: Vec<String>,
    correct_option_ids: Vec<String>,
    is_correct: bool,
    is_unanswered: bool,
    answered_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveCompletedAttemptRequest {
    attempt: CompletedAttemptDto,
    answers: Vec<AttemptAnswerSnapshotDto>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActiveTestRecoveryDto {
    id: String,
    test_definition: serde_json::Value,
    active_attempt: serde_json::Value,
    saved_at: String,
    app_version: Option<String>,
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn initialize_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "busy_timeout", 5000)?;
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          content_fingerprint TEXT NOT NULL,
          question TEXT NOT NULL,
          auxiliary_information TEXT,
          question_type TEXT NOT NULL,
          shuffle_options INTEGER NOT NULL DEFAULT 1,
          correct_answer_explanation TEXT,
          question_category TEXT NOT NULL,
          question_subcategory TEXT,
          question_source TEXT,
          computed_difficulty TEXT NOT NULL DEFAULT 'unrated',
          user_declared_difficulty TEXT NOT NULL DEFAULT 'unrated',
          times_answered_incorrectly INTEGER NOT NULL DEFAULT 0,
          times_answered_correctly INTEGER NOT NULL DEFAULT 0,
          exposure_count INTEGER NOT NULL DEFAULT 0,
          original_answer_count INTEGER NOT NULL DEFAULT 0,
          original_correct_count INTEGER NOT NULL DEFAULT 0,
          original_incorrect_count INTEGER NOT NULL DEFAULT 0,
          last_seen_at TEXT,
          last_correct_at TEXT,
          last_incorrect_at TEXT,
          imported_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS question_options (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
          option_key TEXT NOT NULL,
          text TEXT NOT NULL,
          is_correct INTEGER NOT NULL DEFAULT 0,
          position INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS test_definitions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          question_limit INTEGER NOT NULL,
          allow_unanswered INTEGER NOT NULL,
          time_limit_enabled INTEGER NOT NULL,
          time_limit_minutes INTEGER NOT NULL,
          negative_marking_enabled INTEGER NOT NULL,
          penalty_per_incorrect_answer REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS test_definition_categories (
          test_definition_id TEXT NOT NULL REFERENCES test_definitions(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          PRIMARY KEY (test_definition_id, category)
        );

        CREATE TABLE IF NOT EXISTS test_definition_subcategories (
          test_definition_id TEXT NOT NULL REFERENCES test_definitions(id) ON DELETE CASCADE,
          subcategory TEXT NOT NULL,
          PRIMARY KEY (test_definition_id, subcategory)
        );

        CREATE TABLE IF NOT EXISTS test_attempts (
          id TEXT PRIMARY KEY,
          test_definition_id TEXT,
          test_title TEXT NOT NULL,
          started_at TEXT NOT NULL,
          completed_at TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          total_questions INTEGER NOT NULL,
          correct_answers INTEGER NOT NULL,
          incorrect_answers INTEGER NOT NULL,
          unanswered_questions INTEGER NOT NULL,
          raw_score REAL NOT NULL,
          final_score REAL NOT NULL,
          accuracy_percentage REAL NOT NULL,
          grade_out_of_10 REAL NOT NULL,
          retry_attempts INTEGER NOT NULL,
          retry_correct_answers INTEGER NOT NULL,
          retry_incorrect_answers INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS test_attempt_category_results (
          attempt_id TEXT NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          correct INTEGER NOT NULL,
          incorrect INTEGER NOT NULL,
          unanswered INTEGER NOT NULL,
          total INTEGER NOT NULL,
          accuracy_percentage REAL NOT NULL,
          PRIMARY KEY (attempt_id, category)
        );

        CREATE TABLE IF NOT EXISTS test_attempt_answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attempt_id TEXT NOT NULL REFERENCES test_attempts(id) ON DELETE CASCADE,
          queue_id TEXT NOT NULL,
          source_question_id TEXT NOT NULL,
          retry_number INTEGER NOT NULL,
          question_snapshot TEXT NOT NULL,
          selected_option_ids_json TEXT NOT NULL,
          correct_option_ids_json TEXT NOT NULL,
          is_correct INTEGER NOT NULL,
          is_unanswered INTEGER NOT NULL,
          answered_at TEXT
        );

        CREATE TABLE IF NOT EXISTS app_preferences (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS active_test_attempts (
          id TEXT PRIMARY KEY,
          test_definition_snapshot TEXT NOT NULL,
          active_attempt_snapshot TEXT NOT NULL,
          saved_at TEXT NOT NULL,
          app_version TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_questions_fingerprint ON questions(content_fingerprint);
        CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(question_category);
        CREATE INDEX IF NOT EXISTS idx_questions_subcategory ON questions(question_subcategory);
        CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);
        CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);
        CREATE INDEX IF NOT EXISTS idx_attempts_completed_at ON test_attempts(completed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id ON test_attempt_answers(attempt_id);
        CREATE INDEX IF NOT EXISTS idx_attempt_answers_source_question_id ON test_attempt_answers(source_question_id);

        INSERT OR IGNORE INTO schema_migrations(version, name, applied_at)
        VALUES (1, 'initial_schema', datetime('now'));
        "#,
    )?;
    run_migrations(conn)
}

fn has_migration(conn: &Connection, version: i64) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?)",
        [version],
        |row| row.get::<_, i64>(0),
    )
    .map(|exists| exists == 1)
}

fn has_column(conn: &Connection, table_name: &str, column_name: &str) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table_name})"))?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for column in columns {
        if column? == column_name {
            return Ok(true);
        }
    }
    Ok(false)
}

fn add_column_if_missing(
    conn: &Connection,
    table_name: &str,
    column_name: &str,
    column_sql: &str,
) -> rusqlite::Result<bool> {
    if !has_column(conn, table_name, column_name)? {
        conn.execute(
            &format!("ALTER TABLE {table_name} ADD COLUMN {column_sql}"),
            [],
        )?;
        return Ok(true);
    }
    Ok(false)
}

fn run_migrations(conn: &Connection) -> rusqlite::Result<()> {
    let migration_applied = has_migration(conn, 2)?;
    let mut changed_schema = false;
    changed_schema |= add_column_if_missing(
        conn,
        "questions",
        "exposure_count",
        "exposure_count INTEGER NOT NULL DEFAULT 0",
    )?;
    changed_schema |= add_column_if_missing(
        conn,
        "questions",
        "original_answer_count",
        "original_answer_count INTEGER NOT NULL DEFAULT 0",
    )?;
    changed_schema |= add_column_if_missing(
        conn,
        "questions",
        "original_correct_count",
        "original_correct_count INTEGER NOT NULL DEFAULT 0",
    )?;
    changed_schema |= add_column_if_missing(
        conn,
        "questions",
        "original_incorrect_count",
        "original_incorrect_count INTEGER NOT NULL DEFAULT 0",
    )?;
    changed_schema |=
        add_column_if_missing(conn, "questions", "last_seen_at", "last_seen_at TEXT")?;
    changed_schema |=
        add_column_if_missing(conn, "questions", "last_correct_at", "last_correct_at TEXT")?;
    changed_schema |= add_column_if_missing(
        conn,
        "questions",
        "last_incorrect_at",
        "last_incorrect_at TEXT",
    )?;

    conn.execute_batch(
        r#"
        CREATE INDEX IF NOT EXISTS idx_questions_category_subcategory ON questions(question_category, question_subcategory);
        CREATE INDEX IF NOT EXISTS idx_questions_exposure_recency ON questions(exposure_count, last_seen_at);
        CREATE INDEX IF NOT EXISTS idx_questions_user_difficulty ON questions(user_declared_difficulty);
        "#,
    )?;

    if !migration_applied || changed_schema {
        rebuild_question_selection_stats(conn)?;
    }

    if !migration_applied {
        conn.execute(
            "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, datetime('now'))",
            params![2, "smart_selection_stats"],
        )?;
    }

    let shuffle_migration_applied = has_migration(conn, 3)?;
    let changed_shuffle_schema = add_column_if_missing(
        conn,
        "questions",
        "shuffle_options",
        "shuffle_options INTEGER NOT NULL DEFAULT 1",
    )?;

    if !shuffle_migration_applied && !changed_shuffle_schema {
        conn.execute(
            "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, datetime('now'))",
            params![3, "question_shuffle_options"],
        )?;
    } else if !shuffle_migration_applied {
        conn.execute(
            "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, datetime('now'))",
            params![3, "question_shuffle_options"],
        )?;
    }

    Ok(())
}

fn rebuild_question_selection_stats(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        UPDATE questions
        SET
          exposure_count = COALESCE((
            SELECT COUNT(*)
            FROM test_attempt_answers
            WHERE test_attempt_answers.source_question_id = questions.id
              AND test_attempt_answers.retry_number = 0
          ), 0),
          original_answer_count = COALESCE((
            SELECT COUNT(*)
            FROM test_attempt_answers
            WHERE test_attempt_answers.source_question_id = questions.id
              AND test_attempt_answers.retry_number = 0
              AND test_attempt_answers.is_unanswered = 0
          ), 0),
          original_correct_count = COALESCE((
            SELECT COUNT(*)
            FROM test_attempt_answers
            WHERE test_attempt_answers.source_question_id = questions.id
              AND test_attempt_answers.retry_number = 0
              AND test_attempt_answers.is_unanswered = 0
              AND test_attempt_answers.is_correct = 1
          ), 0),
          original_incorrect_count = COALESCE((
            SELECT COUNT(*)
            FROM test_attempt_answers
            WHERE test_attempt_answers.source_question_id = questions.id
              AND test_attempt_answers.retry_number = 0
              AND test_attempt_answers.is_unanswered = 0
              AND test_attempt_answers.is_correct = 0
          ), 0),
          times_answered_correctly = COALESCE((
            SELECT COUNT(*)
            FROM test_attempt_answers
            WHERE test_attempt_answers.source_question_id = questions.id
              AND test_attempt_answers.retry_number = 0
              AND test_attempt_answers.is_unanswered = 0
              AND test_attempt_answers.is_correct = 1
          ), 0),
          times_answered_incorrectly = COALESCE((
            SELECT COUNT(*)
            FROM test_attempt_answers
            WHERE test_attempt_answers.source_question_id = questions.id
              AND test_attempt_answers.retry_number = 0
              AND test_attempt_answers.is_unanswered = 0
              AND test_attempt_answers.is_correct = 0
          ), 0),
          last_seen_at = (
            SELECT MAX(COALESCE(test_attempt_answers.answered_at, test_attempts.completed_at))
            FROM test_attempt_answers
            JOIN test_attempts ON test_attempts.id = test_attempt_answers.attempt_id
            WHERE test_attempt_answers.source_question_id = questions.id
              AND test_attempt_answers.retry_number = 0
          ),
          last_correct_at = (
            SELECT MAX(COALESCE(test_attempt_answers.answered_at, test_attempts.completed_at))
            FROM test_attempt_answers
            JOIN test_attempts ON test_attempts.id = test_attempt_answers.attempt_id
            WHERE test_attempt_answers.source_question_id = questions.id
              AND test_attempt_answers.retry_number = 0
              AND test_attempt_answers.is_unanswered = 0
              AND test_attempt_answers.is_correct = 1
          ),
          last_incorrect_at = (
            SELECT MAX(COALESCE(test_attempt_answers.answered_at, test_attempts.completed_at))
            FROM test_attempt_answers
            JOIN test_attempts ON test_attempts.id = test_attempt_answers.attempt_id
            WHERE test_attempt_answers.source_question_id = questions.id
              AND test_attempt_answers.retry_number = 0
              AND test_attempt_answers.is_unanswered = 0
              AND test_attempt_answers.is_correct = 0
          );
        "#,
    )
}

fn fingerprint_question(question: &CollectionQuestionDto) -> String {
    let normalize = |value: &str| {
        value
            .trim()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    };
    let mut correct_options = question.correct_options.clone();
    correct_options.sort();
    let options = question
        .options
        .iter()
        .map(|option| serde_json::json!({ "id": normalize(&option.id), "text": normalize(&option.text) }))
        .collect::<Vec<_>>();
    let payload = serde_json::json!({
        "question": normalize(&question.question),
        "auxiliaryInformation": normalize(&question.auxiliary_information.clone().unwrap_or_default()),
        "questionType": question.question_type,
        "options": options,
        "correctOptions": correct_options,
        "shuffleOptions": question.shuffle_options,
        "correctAnswerExplanation": normalize(&question.correct_answer_explanation.clone().unwrap_or_default()),
        "questionCategory": normalize(&question.question_category),
        "questionSubcategory": normalize(&question.question_subcategory.clone().unwrap_or_default()),
        "questionSource": normalize(&question.question_source.clone().unwrap_or_default())
    });
    let text = payload.to_string();
    let mut hash = 0x811c9dc5u32;
    for byte in text.bytes() {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    format!("{:x}", hash)
}

fn generate_question_id(
    fingerprint: &str,
    used_ids: &mut std::collections::HashSet<String>,
) -> String {
    let base_id = format!("q_{}", fingerprint);
    let mut next_id = base_id.clone();
    let mut suffix = 2;
    while used_ids.contains(&next_id) {
        next_id = format!("{}_{}", base_id, suffix);
        suffix += 1;
    }
    used_ids.insert(next_id.clone());
    next_id
}

fn question_from_row(
    conn: &Connection,
    row: &rusqlite::Row<'_>,
) -> rusqlite::Result<CollectionQuestionDto> {
    let question_id: String = row.get(0)?;
    let options = load_options(conn, &question_id)?;
    let correct_options = options
        .iter()
        .filter(|option| is_option_correct(conn, &question_id, &option.id).unwrap_or(false))
        .map(|option| option.id.clone())
        .collect::<Vec<_>>();
    Ok(CollectionQuestionDto {
        id: question_id,
        question: row.get(1)?,
        auxiliary_information: row.get(2)?,
        question_type: row.get(3)?,
        options,
        correct_options,
        shuffle_options: row.get::<_, i64>(4)? != 0,
        correct_answer_explanation: row.get(5)?,
        question_category: row.get(6)?,
        question_subcategory: row.get(7)?,
        question_source: row.get(8)?,
        analytics: QuestionAnalyticsDto {
            computed_difficulty: row.get(9)?,
            user_declared_difficulty: row.get(10)?,
            times_answered_incorrectly: row.get(11)?,
            times_answered_correctly: row.get(12)?,
            exposure_count: row.get(13)?,
        },
    })
}

fn load_options(conn: &Connection, question_id: &str) -> rusqlite::Result<Vec<QuestionOptionDto>> {
    let mut stmt = conn.prepare(
        "SELECT option_key, text FROM question_options WHERE question_id = ? ORDER BY position ASC",
    )?;
    let options = stmt
        .query_map([question_id], |row| {
            Ok(QuestionOptionDto {
                id: row.get(0)?,
                text: row.get(1)?,
            })
        })?
        .collect();
    options
}

fn load_question_selection_stats(
    conn: &Connection,
    question_id: &str,
) -> rusqlite::Result<Option<QuestionSelectionStats>> {
    conn.query_row(
        "SELECT exposure_count, original_answer_count, original_correct_count, original_incorrect_count,
                last_seen_at, last_correct_at, last_incorrect_at
         FROM questions WHERE id = ?",
        [question_id],
        |row| {
            Ok(QuestionSelectionStats {
                exposure_count: row.get(0)?,
                original_answer_count: row.get(1)?,
                original_correct_count: row.get(2)?,
                original_incorrect_count: row.get(3)?,
                last_seen_at: row.get(4)?,
                last_correct_at: row.get(5)?,
                last_incorrect_at: row.get(6)?,
            })
        },
    )
    .optional()
}

fn load_question_exposures(
    conn: &Connection,
    question_ids: &[String],
) -> rusqlite::Result<Vec<QuestionExposureDto>> {
    if question_ids.is_empty() {
        return Ok(vec![]);
    }

    let mut query = String::from("SELECT id, exposure_count FROM questions WHERE id IN (");
    query.push_str(&vec!["?"; question_ids.len()].join(", "));
    query.push(')');

    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map(params_from_iter(question_ids.iter()), |row| {
        Ok(QuestionExposureDto {
            question_id: row.get(0)?,
            exposure_count: row.get(1)?,
        })
    })?;
    rows.collect()
}

fn is_option_correct(
    conn: &Connection,
    question_id: &str,
    option_key: &str,
) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT is_correct FROM question_options WHERE question_id = ? AND option_key = ?",
        params![question_id, option_key],
        |row| row.get::<_, i64>(0),
    )
    .map(|value| value == 1)
}

fn load_all_questions(conn: &Connection) -> rusqlite::Result<Vec<CollectionQuestionDto>> {
    let mut stmt = conn.prepare(
        "SELECT id, question, auxiliary_information, question_type, shuffle_options, correct_answer_explanation,
                question_category, question_subcategory, question_source, computed_difficulty,
                user_declared_difficulty, times_answered_incorrectly, times_answered_correctly,
                exposure_count
         FROM questions ORDER BY rowid ASC",
    )?;
    let rows = stmt.query_map([], |row| question_from_row(conn, row))?;
    rows.collect()
}

fn load_eligible_questions(
    conn: &Connection,
    definition: &TestDefinitionDto,
) -> rusqlite::Result<Vec<ScoredQuestion>> {
    if definition.included_categories.is_empty() {
        return Ok(vec![]);
    }

    let mut query = String::from(
        "SELECT id, question, auxiliary_information, question_type, shuffle_options, correct_answer_explanation,
                question_category, question_subcategory, question_source, computed_difficulty,
                user_declared_difficulty, times_answered_incorrectly, times_answered_correctly,
                exposure_count, original_answer_count, original_correct_count, original_incorrect_count,
                last_seen_at, last_correct_at, last_incorrect_at
         FROM questions WHERE question_category IN (",
    );
    query.push_str(&vec!["?"; definition.included_categories.len()].join(", "));
    query.push(')');

    let mut values = definition.included_categories.clone();
    let subcategories = definition
        .included_subcategories
        .clone()
        .unwrap_or_default();
    if !subcategories.is_empty() {
        query.push_str(" AND question_subcategory IN (");
        query.push_str(&vec!["?"; subcategories.len()].join(", "));
        query.push(')');
        values.extend(subcategories);
    }

    let mut stmt = conn.prepare(&query)?;
    let rows = stmt.query_map(params_from_iter(values.iter()), |row| {
        let question = question_from_row(conn, row)?;
        let stats = QuestionSelectionStats {
            exposure_count: row.get(13)?,
            original_answer_count: row.get(14)?,
            original_correct_count: row.get(15)?,
            original_incorrect_count: row.get(16)?,
            last_seen_at: row.get(17)?,
            last_correct_at: row.get(18)?,
            last_incorrect_at: row.get(19)?,
        };
        Ok(ScoredQuestion {
            question,
            stats,
            score: 0.0,
        })
    })?;
    rows.collect()
}

fn days_since(iso_timestamp: &Option<String>, now: chrono::DateTime<chrono::Utc>) -> f64 {
    iso_timestamp
        .as_ref()
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .map(|date| {
            let elapsed = now.signed_duration_since(date.with_timezone(&chrono::Utc));
            elapsed.num_seconds().max(0) as f64 / 86_400.0
        })
        .unwrap_or(365.0)
}

fn score_question(
    stats: &QuestionSelectionStats,
    user_declared_difficulty: &str,
    max_exposure: i64,
    avg_exposure: f64,
    now: chrono::DateTime<chrono::Utc>,
) -> f64 {
    let unseen_boost = if stats.exposure_count == 0 {
        100_000.0
    } else {
        0.0
    };
    let least_seen_boost = (max_exposure - stats.exposure_count).max(0) as f64 * 40.0;
    let days_since_seen = days_since(&stats.last_seen_at, now);
    let recency_boost = days_since_seen.min(90.0) * 1.2;
    let incorrect_rate = if stats.original_answer_count > 0 {
        stats.original_incorrect_count as f64 / stats.original_answer_count as f64
    } else {
        0.0
    };
    let incorrect_history_boost = if stats.original_incorrect_count > 0 {
        incorrect_rate * 25.0 + stats.original_incorrect_count.min(5) as f64 * 3.0
    } else {
        0.0
    };
    let user_difficulty_boost = match user_declared_difficulty {
        "high" => 10.0,
        "medium" => 4.0,
        "unrated" => 1.0,
        _ => 0.0,
    };
    let recent_exposure_penalty = if days_since_seen < 1.0 {
        80.0
    } else if days_since_seen < 3.0 {
        45.0
    } else if days_since_seen < 7.0 {
        20.0
    } else {
        0.0
    };
    let overexposure_penalty = (stats.exposure_count as f64 - avg_exposure).max(0.0) * 12.0;

    unseen_boost
        + least_seen_boost
        + recency_boost
        + incorrect_history_boost
        + user_difficulty_boost
        - recent_exposure_penalty
        - overexposure_penalty
}

fn score_questions(
    mut questions: Vec<ScoredQuestion>,
    now: chrono::DateTime<chrono::Utc>,
) -> Vec<ScoredQuestion> {
    let max_exposure = questions
        .iter()
        .map(|question| question.stats.exposure_count)
        .max()
        .unwrap_or(0);
    let avg_exposure = if questions.is_empty() {
        0.0
    } else {
        questions
            .iter()
            .map(|question| question.stats.exposure_count as f64)
            .sum::<f64>()
            / questions.len() as f64
    };

    for scored in &mut questions {
        scored.score = score_question(
            &scored.stats,
            &scored.question.analytics.user_declared_difficulty,
            max_exposure,
            avg_exposure,
            now,
        );
    }
    questions.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    questions
}

#[derive(Debug)]
struct WeightedRng {
    state: u64,
}

impl WeightedRng {
    fn new(seed: u64) -> Self {
        Self { state: seed.max(1) }
    }

    fn next_f64(&mut self) -> f64 {
        self.state = self
            .state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        (self.state >> 11) as f64 / ((1u64 << 53) as f64)
    }
}

fn selection_seed() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(1)
}

fn weighted_select_questions(
    scored_questions: Vec<ScoredQuestion>,
    question_limit: i64,
    seed: u64,
) -> Vec<CollectionQuestionDto> {
    let requested = question_limit.max(0) as usize;
    if requested == 0 || scored_questions.is_empty() {
        return vec![];
    }

    let mut rng = WeightedRng::new(seed);
    let mut candidates = scored_questions;
    let mut selected = Vec::with_capacity(requested.min(candidates.len()));
    while selected.len() < requested && !candidates.is_empty() {
        let remaining = requested - selected.len();
        let unseen_count = candidates
            .iter()
            .take_while(|candidate| candidate.stats.exposure_count == 0)
            .count();
        let pool_size = if unseen_count > 0 {
            unseen_count
        } else {
            candidates.len().min((remaining * 3).max(remaining + 50))
        };
        let min_pool_score = candidates[..pool_size]
            .iter()
            .map(|candidate| candidate.score)
            .fold(f64::INFINITY, f64::min);
        let weights = candidates[..pool_size]
            .iter()
            .map(|candidate| (candidate.score - min_pool_score + 1.0).max(1.0))
            .collect::<Vec<_>>();
        let total_weight = weights.iter().sum::<f64>();
        let mut target = rng.next_f64() * total_weight;
        let mut selected_index = 0;
        for (index, weight) in weights.iter().enumerate() {
            if target <= *weight {
                selected_index = index;
                break;
            }
            target -= weight;
        }
        selected.push(candidates.remove(selected_index).question);
    }

    selected
}

fn build_summary(questions: &[CollectionQuestionDto]) -> QuestionCollectionSummaryDto {
    use std::collections::HashSet;
    let categories = questions
        .iter()
        .map(|q| q.question_category.clone())
        .collect::<HashSet<_>>();
    let subcategories = questions
        .iter()
        .filter_map(|q| q.question_subcategory.clone())
        .collect::<HashSet<_>>();
    let sources = questions
        .iter()
        .filter_map(|q| q.question_source.clone())
        .collect::<HashSet<_>>();
    QuestionCollectionSummaryDto {
        total_questions: questions.len() as i64,
        total_categories: categories.len() as i64,
        total_subcategories: subcategories.len() as i64,
        total_single_choice: questions
            .iter()
            .filter(|q| q.question_type == "single_choice")
            .count() as i64,
        total_multiple_choice: questions
            .iter()
            .filter(|q| q.question_type == "multiple_choice")
            .count() as i64,
        total_sources: sources.len() as i64,
    }
}

fn load_collection(conn: &Connection) -> rusqlite::Result<Option<QuestionCollectionDto>> {
    let questions = load_all_questions(conn)?;
    if questions.is_empty() {
        return Ok(None);
    }
    let imported_at = conn
        .query_row("SELECT MAX(imported_at) FROM questions", [], |row| {
            row.get::<_, Option<String>>(0)
        })?
        .unwrap_or_else(now_iso);
    let summary = build_summary(&questions);
    Ok(Some(QuestionCollectionDto {
        version: "1".into(),
        imported_at,
        questions,
        summary,
    }))
}

fn insert_question(
    conn: &Connection,
    question: &CollectionQuestionDto,
    preserve_id: Option<&str>,
) -> rusqlite::Result<()> {
    let id = preserve_id.unwrap_or(&question.id);
    let fingerprint = fingerprint_question(question);
    let now = now_iso();
    let preserved_stats =
        load_question_selection_stats(conn, id)?.unwrap_or(QuestionSelectionStats {
            exposure_count: 0,
            original_answer_count: 0,
            original_correct_count: 0,
            original_incorrect_count: 0,
            last_seen_at: None,
            last_correct_at: None,
            last_incorrect_at: None,
        });
    conn.execute(
        "INSERT OR REPLACE INTO questions(id, content_fingerprint, question, auxiliary_information, question_type,
         shuffle_options, correct_answer_explanation, question_category, question_subcategory, question_source, computed_difficulty,
         user_declared_difficulty, times_answered_incorrectly, times_answered_correctly, exposure_count,
         original_answer_count, original_correct_count, original_incorrect_count, last_seen_at, last_correct_at,
         last_incorrect_at, imported_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            id,
            fingerprint,
            question.question,
            question.auxiliary_information,
            question.question_type,
            question.shuffle_options as i64,
            question.correct_answer_explanation,
            question.question_category,
            question.question_subcategory,
            question.question_source,
            question.analytics.computed_difficulty,
            question.analytics.user_declared_difficulty,
            question.analytics.times_answered_incorrectly,
            question.analytics.times_answered_correctly,
            preserved_stats.exposure_count,
            preserved_stats.original_answer_count,
            preserved_stats.original_correct_count,
            preserved_stats.original_incorrect_count,
            preserved_stats.last_seen_at,
            preserved_stats.last_correct_at,
            preserved_stats.last_incorrect_at,
            now,
            now,
        ],
    )?;
    conn.execute("DELETE FROM question_options WHERE question_id = ?", [id])?;
    for (index, option) in question.options.iter().enumerate() {
        let is_correct = question.correct_options.contains(&option.id) as i64;
        conn.execute(
            "INSERT INTO question_options(question_id, option_key, text, is_correct, position) VALUES (?, ?, ?, ?, ?)",
            params![id, option.id, option.text, is_correct, index as i64],
        )?;
    }
    Ok(())
}

#[tauri::command]
fn get_preferences(state: State<'_, DbState>) -> CommandResult<serde_json::Value> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    let language = conn
        .query_row(
            "SELECT value FROM app_preferences WHERE key = 'language'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .unwrap_or_else(|| "English".into());
    let theme = conn
        .query_row(
            "SELECT value FROM app_preferences WHERE key = 'theme'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?
        .unwrap_or_else(|| "dark".into());
    Ok(serde_json::json!({ "language": language, "theme": theme }))
}

#[tauri::command]
fn set_preference(state: State<'_, DbState>, key: String, value: String) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO app_preferences(key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, value, now_iso()],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_question_collection(
    state: State<'_, DbState>,
) -> CommandResult<Option<QuestionCollectionDto>> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    load_collection(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_question_collection(
    state: State<'_, DbState>,
    request: ImportQuestionCollectionRequest,
) -> CommandResult<ImportQuestionCollectionResponse> {
    let mut conn = state.conn.lock().map_err(|error| error.to_string())?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let existing = load_all_questions(&tx).map_err(|error| error.to_string())?;
    let existing_fingerprints = existing
        .iter()
        .map(|question| (fingerprint_question(question), question.id.clone()))
        .collect::<std::collections::HashMap<_, _>>();
    let duplicates = request
        .collection
        .questions
        .iter()
        .filter_map(|question| {
            let fingerprint = fingerprint_question(question);
            existing_fingerprints
                .get(&fingerprint)
                .map(|_| DuplicateQuestionPreviewDto {
                    fingerprint,
                    question: question.question.clone(),
                })
        })
        .collect::<Vec<_>>();

    if request.merge && !duplicates.is_empty() && request.resolution.is_none() {
        return Ok(ImportQuestionCollectionResponse::Conflict {
            duplicate_questions: duplicates,
        });
    }

    if !request.merge {
        tx.execute("DELETE FROM questions", [])
            .map_err(|error| error.to_string())?;
    }

    let mut used_ids = if request.merge {
        existing
            .iter()
            .map(|question| question.id.clone())
            .collect::<std::collections::HashSet<_>>()
    } else {
        std::collections::HashSet::new()
    };
    for question in &request.collection.questions {
        let fingerprint = fingerprint_question(question);
        let preserve_id = if request.resolution.as_deref() == Some("replaceExisting") {
            existing_fingerprints.get(&fingerprint).map(String::as_str)
        } else {
            None
        };
        let mut question_to_insert = question.clone();
        if preserve_id.is_none() && used_ids.contains(&question_to_insert.id) {
            question_to_insert.id = generate_question_id(&fingerprint, &mut used_ids);
        } else {
            used_ids.insert(question_to_insert.id.clone());
        }
        if preserve_id.is_none()
            || request.resolution.as_deref() == Some("replaceExisting")
            || !existing_fingerprints.contains_key(&fingerprint)
        {
            insert_question(&tx, &question_to_insert, preserve_id)
                .map_err(|error| error.to_string())?;
        }
    }

    tx.commit().map_err(|error| error.to_string())?;
    let collection = load_collection(&conn)
        .map_err(|error| error.to_string())?
        .unwrap_or(QuestionCollectionDto {
            version: "1".into(),
            imported_at: now_iso(),
            questions: vec![],
            summary: build_summary(&[]),
        });
    Ok(ImportQuestionCollectionResponse::Imported { collection })
}

#[tauri::command]
fn export_question_bank(state: State<'_, DbState>) -> CommandResult<ImportedQuestionCollectionDto> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    let questions = load_all_questions(&conn).map_err(|error| error.to_string())?;
    Ok(ImportedQuestionCollectionDto {
        version: "1".into(),
        questions: questions
            .into_iter()
            .map(|question| ImportedQuestionDto {
                question: question.question,
                auxiliary_information: question.auxiliary_information,
                question_type: question.question_type,
                options: question.options,
                correct_options: question.correct_options,
                shuffle_options: question.shuffle_options,
                correct_answer_explanation: question.correct_answer_explanation,
                question_category: question.question_category,
                question_subcategory: question.question_subcategory,
                question_source: question.question_source,
            })
            .collect(),
    })
}

#[tauri::command]
fn save_test_definition(
    state: State<'_, DbState>,
    definition: TestDefinitionDto,
) -> CommandResult<()> {
    let mut conn = state.conn.lock().map_err(|error| error.to_string())?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO test_definitions(id, title, question_limit, allow_unanswered, time_limit_enabled, time_limit_minutes, negative_marking_enabled, penalty_per_incorrect_answer, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, question_limit = excluded.question_limit, allow_unanswered = excluded.allow_unanswered, time_limit_enabled = excluded.time_limit_enabled, time_limit_minutes = excluded.time_limit_minutes, negative_marking_enabled = excluded.negative_marking_enabled, penalty_per_incorrect_answer = excluded.penalty_per_incorrect_answer, updated_at = excluded.updated_at",
        params![definition.id, definition.title, definition.question_limit, definition.allow_unanswered as i64, definition.time_limit_enabled.unwrap_or(false) as i64, definition.time_limit_minutes, definition.negative_marking_enabled as i64, definition.penalty_per_incorrect_answer, definition.created_at, definition.updated_at],
    ).map_err(|error| error.to_string())?;
    tx.execute(
        "DELETE FROM test_definition_categories WHERE test_definition_id = ?",
        [&definition.id],
    )
    .map_err(|error| error.to_string())?;
    tx.execute(
        "DELETE FROM test_definition_subcategories WHERE test_definition_id = ?",
        [&definition.id],
    )
    .map_err(|error| error.to_string())?;
    for category in &definition.included_categories {
        tx.execute(
            "INSERT INTO test_definition_categories(test_definition_id, category) VALUES (?, ?)",
            params![definition.id, category],
        )
        .map_err(|error| error.to_string())?;
    }
    for subcategory in definition
        .included_subcategories
        .clone()
        .unwrap_or_default()
    {
        tx.execute("INSERT INTO test_definition_subcategories(test_definition_id, subcategory) VALUES (?, ?)", params![definition.id, subcategory]).map_err(|error| error.to_string())?;
    }
    tx.commit().map_err(|error| error.to_string())?;
    Ok(())
}

fn load_test_definitions_from_conn(conn: &Connection) -> rusqlite::Result<Vec<TestDefinitionDto>> {
    let mut stmt = conn.prepare("SELECT id, title, question_limit, allow_unanswered, time_limit_enabled, time_limit_minutes, negative_marking_enabled, penalty_per_incorrect_answer, created_at, updated_at FROM test_definitions ORDER BY updated_at DESC")?;
    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let categories = conn.prepare("SELECT category FROM test_definition_categories WHERE test_definition_id = ? ORDER BY category")?
            .query_map([&id], |cat_row| cat_row.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let subcategories = conn.prepare("SELECT subcategory FROM test_definition_subcategories WHERE test_definition_id = ? ORDER BY subcategory")?
            .query_map([&id], |cat_row| cat_row.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(TestDefinitionDto {
            id,
            title: row.get(1)?,
            question_limit: row.get(2)?,
            allow_unanswered: row.get::<_, i64>(3)? == 1,
            time_limit_enabled: Some(row.get::<_, i64>(4)? == 1),
            time_limit_minutes: row.get(5)?,
            negative_marking_enabled: row.get::<_, i64>(6)? == 1,
            penalty_per_incorrect_answer: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
            included_categories: categories,
            included_subcategories: Some(subcategories),
        })
    })?;
    rows.collect()
}

#[tauri::command]
fn list_test_definitions(state: State<'_, DbState>) -> CommandResult<Vec<TestDefinitionDto>> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    load_test_definitions_from_conn(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_test_definition(state: State<'_, DbState>, id: String) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM test_definitions WHERE id = ?", [id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn generate_test_questions(
    state: State<'_, DbState>,
    definition: TestDefinitionDto,
) -> CommandResult<Vec<CollectionQuestionDto>> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    let eligible =
        load_eligible_questions(&conn, &definition).map_err(|error| error.to_string())?;
    let scored = score_questions(eligible, chrono::Utc::now());
    Ok(weighted_select_questions(
        scored,
        definition.question_limit,
        selection_seed(),
    ))
}

#[tauri::command]
fn save_completed_attempt(
    state: State<'_, DbState>,
    request: SaveCompletedAttemptRequest,
) -> CommandResult<Vec<QuestionExposureDto>> {
    let mut conn = state.conn.lock().map_err(|error| error.to_string())?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let attempt = &request.attempt;
    let mut original_question_ids = Vec::new();
    tx.execute(
        "INSERT OR REPLACE INTO test_attempts(id, test_definition_id, test_title, started_at, completed_at, duration_seconds, total_questions, correct_answers, incorrect_answers, unanswered_questions, raw_score, final_score, accuracy_percentage, grade_out_of_10, retry_attempts, retry_correct_answers, retry_incorrect_answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![attempt.id, attempt.test_id, attempt.test_title, attempt.started_at, attempt.completed_at, attempt.duration_seconds, attempt.total_questions, attempt.correct_answers, attempt.incorrect_answers, attempt.unanswered_questions, attempt.raw_score, attempt.final_score, attempt.accuracy_percentage, attempt.grade_out_of_10, attempt.retry_attempts, attempt.retry_correct_answers, attempt.retry_incorrect_answers],
    ).map_err(|error| error.to_string())?;
    tx.execute(
        "DELETE FROM test_attempt_category_results WHERE attempt_id = ?",
        [&attempt.id],
    )
    .map_err(|error| error.to_string())?;
    tx.execute(
        "DELETE FROM test_attempt_answers WHERE attempt_id = ?",
        [&attempt.id],
    )
    .map_err(|error| error.to_string())?;
    for category in &attempt.category_results {
        tx.execute("INSERT INTO test_attempt_category_results(attempt_id, category, correct, incorrect, unanswered, total, accuracy_percentage) VALUES (?, ?, ?, ?, ?, ?, ?)", params![attempt.id, category.category, category.correct, category.incorrect, category.unanswered, category.total, category.accuracy_percentage]).map_err(|error| error.to_string())?;
    }
    for answer in &request.answers {
        if answer.retry_number == 0 && !original_question_ids.contains(&answer.source_question_id) {
            original_question_ids.push(answer.source_question_id.clone());
        }
        tx.execute("INSERT INTO test_attempt_answers(attempt_id, queue_id, source_question_id, retry_number, question_snapshot, selected_option_ids_json, correct_option_ids_json, is_correct, is_unanswered, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", params![attempt.id, answer.queue_id, answer.source_question_id, answer.retry_number, serde_json::to_string(&answer.question).map_err(|error| error.to_string())?, serde_json::to_string(&answer.selected_option_ids).map_err(|error| error.to_string())?, serde_json::to_string(&answer.correct_option_ids).map_err(|error| error.to_string())?, answer.is_correct as i64, answer.is_unanswered as i64, answer.answered_at]).map_err(|error| error.to_string())?;
    }
    rebuild_question_selection_stats(&tx).map_err(|error| error.to_string())?;
    let exposures = load_question_exposures(&tx, &original_question_ids)
        .map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(exposures)
}

fn load_attempts(conn: &Connection) -> rusqlite::Result<Vec<CompletedAttemptDto>> {
    let mut stmt = conn.prepare("SELECT id, test_definition_id, test_title, started_at, completed_at, duration_seconds, total_questions, correct_answers, incorrect_answers, unanswered_questions, raw_score, final_score, accuracy_percentage, grade_out_of_10, retry_attempts, retry_correct_answers, retry_incorrect_answers FROM test_attempts ORDER BY completed_at DESC")?;
    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let category_results = conn.prepare("SELECT category, correct, incorrect, unanswered, total, accuracy_percentage FROM test_attempt_category_results WHERE attempt_id = ? ORDER BY category")?
            .query_map([&id], |category_row| Ok(CategoryAttemptResultDto { category: category_row.get(0)?, correct: category_row.get(1)?, incorrect: category_row.get(2)?, unanswered: category_row.get(3)?, total: category_row.get(4)?, accuracy_percentage: category_row.get(5)? }))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(CompletedAttemptDto { id, test_id: row.get::<_, Option<String>>(1)?.unwrap_or_default(), test_title: row.get(2)?, started_at: row.get(3)?, completed_at: row.get(4)?, duration_seconds: row.get(5)?, total_questions: row.get(6)?, correct_answers: row.get(7)?, incorrect_answers: row.get(8)?, unanswered_questions: row.get(9)?, raw_score: row.get(10)?, final_score: row.get(11)?, accuracy_percentage: row.get(12)?, grade_out_of_10: row.get(13)?, retry_attempts: row.get(14)?, retry_correct_answers: row.get(15)?, retry_incorrect_answers: row.get(16)?, category_results })
    })?;
    rows.collect()
}

#[tauri::command]
fn list_completed_attempts(state: State<'_, DbState>) -> CommandResult<Vec<CompletedAttemptDto>> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    load_attempts(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_all_completed_attempts(state: State<'_, DbState>) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM test_attempts", [])
        .map_err(|error| error.to_string())?;
    rebuild_question_selection_stats(&conn).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn reset_question_bank(state: State<'_, DbState>) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM questions", [])
        .map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM active_test_attempts", [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_question_difficulty(
    state: State<'_, DbState>,
    question_id: String,
    difficulty: String,
) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    conn.execute(
        "UPDATE questions SET user_declared_difficulty = ?, updated_at = ? WHERE id = ?",
        params![difficulty, now_iso(), question_id],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_active_test_attempt(
    state: State<'_, DbState>,
) -> CommandResult<Option<ActiveTestRecoveryDto>> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    let row = conn
        .query_row(
            "SELECT id, test_definition_snapshot, active_attempt_snapshot, saved_at, app_version FROM active_test_attempts ORDER BY saved_at DESC LIMIT 1",
            [],
            |row| {
                let test_definition_json: String = row.get(1)?;
                let active_attempt_json: String = row.get(2)?;
                let test_definition = serde_json::from_str(&test_definition_json).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        1,
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })?;
                let active_attempt = serde_json::from_str(&active_attempt_json).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        2,
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })?;
                Ok(ActiveTestRecoveryDto {
                    id: row.get(0)?,
                    test_definition,
                    active_attempt,
                    saved_at: row.get(3)?,
                    app_version: row.get(4)?,
                })
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;
    Ok(row)
}

#[tauri::command]
fn save_active_test_attempt(
    state: State<'_, DbState>,
    recovery: ActiveTestRecoveryDto,
) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    let test_definition_snapshot =
        serde_json::to_string(&recovery.test_definition).map_err(|error| error.to_string())?;
    let active_attempt_snapshot =
        serde_json::to_string(&recovery.active_attempt).map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM active_test_attempts", [])
        .map_err(|error| error.to_string())?;
    conn.execute(
        "INSERT INTO active_test_attempts(id, test_definition_snapshot, active_attempt_snapshot, saved_at, app_version) VALUES (?, ?, ?, ?, ?)",
        params![recovery.id, test_definition_snapshot, active_attempt_snapshot, recovery.saved_at, recovery.app_version],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn clear_active_test_attempt(state: State<'_, DbState>) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM active_test_attempts", [])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_question(id: &str, difficulty: &str) -> CollectionQuestionDto {
        CollectionQuestionDto {
            id: id.into(),
            question: format!("Question {id}"),
            auxiliary_information: None,
            question_type: "single_choice".into(),
            options: vec![QuestionOptionDto {
                id: "a".into(),
                text: "A".into(),
            }],
            correct_options: vec!["a".into()],
            shuffle_options: true,
            correct_answer_explanation: None,
            question_category: "Category".into(),
            question_subcategory: None,
            question_source: None,
            analytics: QuestionAnalyticsDto {
                computed_difficulty: "unrated".into(),
                user_declared_difficulty: difficulty.into(),
                times_answered_incorrectly: 0,
                times_answered_correctly: 0,
                exposure_count: 0,
            },
        }
    }

    fn test_stats(
        exposure_count: i64,
        answer_count: i64,
        correct_count: i64,
        incorrect_count: i64,
        last_seen_at: Option<&str>,
    ) -> QuestionSelectionStats {
        QuestionSelectionStats {
            exposure_count,
            original_answer_count: answer_count,
            original_correct_count: correct_count,
            original_incorrect_count: incorrect_count,
            last_seen_at: last_seen_at.map(String::from),
            last_correct_at: None,
            last_incorrect_at: None,
        }
    }

    fn scored(id: &str, difficulty: &str, stats: QuestionSelectionStats) -> ScoredQuestion {
        ScoredQuestion {
            question: test_question(id, difficulty),
            stats,
            score: 0.0,
        }
    }

    #[test]
    fn score_questions_prioritizes_unseen_questions() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-06-07T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let questions = score_questions(
            vec![
                scored(
                    "seen",
                    "high",
                    test_stats(4, 4, 0, 4, Some("2026-06-01T12:00:00Z")),
                ),
                scored("unseen", "low", test_stats(0, 0, 0, 0, None)),
            ],
            now,
        );

        assert_eq!(questions.first().unwrap().question.id, "unseen");
    }

    #[test]
    fn score_questions_uses_incorrect_history_and_difficulty_as_tiebreakers() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-06-07T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let questions = score_questions(
            vec![
                scored(
                    "easy-correct",
                    "low",
                    test_stats(2, 2, 2, 0, Some("2026-05-01T12:00:00Z")),
                ),
                scored(
                    "hard-incorrect",
                    "high",
                    test_stats(2, 2, 0, 2, Some("2026-05-01T12:00:00Z")),
                ),
            ],
            now,
        );

        assert_eq!(questions.first().unwrap().question.id, "hard-incorrect");
    }

    #[test]
    fn weighted_selection_respects_limit_and_avoids_duplicates() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-06-07T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let scored_questions = score_questions(
            vec![
                scored("q1", "unrated", test_stats(0, 0, 0, 0, None)),
                scored("q2", "unrated", test_stats(0, 0, 0, 0, None)),
                scored("q3", "unrated", test_stats(0, 0, 0, 0, None)),
            ],
            now,
        );
        let selected = weighted_select_questions(scored_questions, 2, 42);
        let ids = selected
            .iter()
            .map(|question| question.id.clone())
            .collect::<std::collections::HashSet<_>>();

        assert_eq!(selected.len(), 2);
        assert_eq!(ids.len(), 2);
    }

    #[test]
    fn weighted_selection_exhausts_unseen_before_seen_questions() {
        let now = chrono::DateTime::parse_from_rfc3339("2026-06-07T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let scored_questions = score_questions(
            vec![
                scored("unseen-1", "unrated", test_stats(0, 0, 0, 0, None)),
                scored("unseen-2", "unrated", test_stats(0, 0, 0, 0, None)),
                scored(
                    "seen-hard",
                    "high",
                    test_stats(6, 6, 0, 6, Some("2026-05-01T12:00:00Z")),
                ),
            ],
            now,
        );
        let selected = weighted_select_questions(scored_questions, 2, 7);
        let ids = selected
            .iter()
            .map(|question| question.id.as_str())
            .collect::<std::collections::HashSet<_>>();

        assert!(ids.contains("unseen-1"));
        assert!(ids.contains("unseen-2"));
        assert!(!ids.contains("seen-hard"));
    }

    #[test]
    fn initialize_db_migrates_pre_smart_selection_schema() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE schema_migrations (
              version INTEGER PRIMARY KEY,
              name TEXT NOT NULL,
              applied_at TEXT NOT NULL
            );
            INSERT INTO schema_migrations(version, name, applied_at)
            VALUES (1, 'initial_schema', '2026-01-01T00:00:00Z');

            CREATE TABLE questions (
              id TEXT PRIMARY KEY,
              content_fingerprint TEXT NOT NULL,
              question TEXT NOT NULL,
              auxiliary_information TEXT,
              question_type TEXT NOT NULL,
              correct_answer_explanation TEXT,
              question_category TEXT NOT NULL,
              question_subcategory TEXT,
              question_source TEXT,
              computed_difficulty TEXT NOT NULL DEFAULT 'unrated',
              user_declared_difficulty TEXT NOT NULL DEFAULT 'unrated',
              times_answered_incorrectly INTEGER NOT NULL DEFAULT 0,
              times_answered_correctly INTEGER NOT NULL DEFAULT 0,
              imported_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            INSERT INTO questions(id, content_fingerprint, question, question_type, question_category, imported_at, updated_at)
            VALUES ('q1', 'fp1', 'Question 1', 'single_choice', 'Category', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

            CREATE TABLE test_attempts (
              id TEXT PRIMARY KEY,
              test_definition_id TEXT,
              test_title TEXT NOT NULL,
              started_at TEXT NOT NULL,
              completed_at TEXT NOT NULL,
              duration_seconds INTEGER NOT NULL,
              total_questions INTEGER NOT NULL,
              correct_answers INTEGER NOT NULL,
              incorrect_answers INTEGER NOT NULL,
              unanswered_questions INTEGER NOT NULL,
              raw_score REAL NOT NULL,
              final_score REAL NOT NULL,
              accuracy_percentage REAL NOT NULL,
              grade_out_of_10 REAL NOT NULL,
              retry_attempts INTEGER NOT NULL,
              retry_correct_answers INTEGER NOT NULL,
              retry_incorrect_answers INTEGER NOT NULL
            );
            INSERT INTO test_attempts(id, test_title, started_at, completed_at, duration_seconds, total_questions, correct_answers, incorrect_answers, unanswered_questions, raw_score, final_score, accuracy_percentage, grade_out_of_10, retry_attempts, retry_correct_answers, retry_incorrect_answers)
            VALUES ('a1', 'Test', '2026-01-01T00:00:00Z', '2026-01-01T00:10:00Z', 600, 1, 1, 0, 0, 1, 1, 100, 10, 1, 0, 1);

            CREATE TABLE test_attempt_answers (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              attempt_id TEXT NOT NULL,
              queue_id TEXT NOT NULL,
              source_question_id TEXT NOT NULL,
              retry_number INTEGER NOT NULL,
              question_snapshot TEXT NOT NULL,
              selected_option_ids_json TEXT NOT NULL,
              correct_option_ids_json TEXT NOT NULL,
              is_correct INTEGER NOT NULL,
              is_unanswered INTEGER NOT NULL,
              answered_at TEXT
            );
            INSERT INTO test_attempt_answers(attempt_id, queue_id, source_question_id, retry_number, question_snapshot, selected_option_ids_json, correct_option_ids_json, is_correct, is_unanswered, answered_at)
            VALUES ('a1', 'q1-original', 'q1', 0, '{}', '["a"]', '["a"]', 1, 0, '2026-01-01T00:05:00Z');
            INSERT INTO test_attempt_answers(attempt_id, queue_id, source_question_id, retry_number, question_snapshot, selected_option_ids_json, correct_option_ids_json, is_correct, is_unanswered, answered_at)
            VALUES ('a1', 'q1-retry', 'q1', 1, '{}', '["b"]', '["a"]', 0, 0, '2026-01-01T00:06:00Z');
            "#,
        )
        .unwrap();

        initialize_db(&conn).unwrap();

        let stats = load_question_selection_stats(&conn, "q1").unwrap().unwrap();
        let migration_exists = has_migration(&conn, 2).unwrap();
        let shuffle_migration_exists = has_migration(&conn, 3).unwrap();
        let shuffle_options: i64 = conn
            .query_row("SELECT shuffle_options FROM questions WHERE id = 'q1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        let index_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'idx_questions_exposure_recency')",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map(|value| value == 1)
            .unwrap();

        assert!(migration_exists);
        assert!(shuffle_migration_exists);
        assert!(index_exists);
        assert_eq!(shuffle_options, 1);
        assert_eq!(stats.exposure_count, 1);
        assert_eq!(stats.original_answer_count, 1);
        assert_eq!(stats.original_correct_count, 1);
        assert_eq!(stats.original_incorrect_count, 0);
        assert_eq!(stats.last_seen_at.as_deref(), Some("2026-01-01T00:05:00Z"));
    }

    #[test]
    fn insert_and_load_question_preserves_shuffle_options_false() {
        let conn = Connection::open_in_memory().unwrap();
        initialize_db(&conn).unwrap();
        let mut question = test_question("fixed-order", "unrated");
        question.shuffle_options = false;

        insert_question(&conn, &question, None).unwrap();
        let loaded = load_all_questions(&conn).unwrap();

        assert_eq!(loaded.len(), 1);
        assert!(!loaded[0].shuffle_options);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("testlytic.sqlite");
            let conn = Connection::open(db_path)?;
            initialize_db(&conn)?;
            app.manage(DbState {
                conn: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_preferences,
            set_preference,
            get_question_collection,
            import_question_collection,
            export_question_bank,
            save_test_definition,
            list_test_definitions,
            delete_test_definition,
            generate_test_questions,
            save_completed_attempt,
            list_completed_attempts,
            delete_all_completed_attempts,
            reset_question_bank,
            update_question_difficulty,
            get_active_test_attempt,
            save_active_test_attempt,
            clear_active_test_attempt
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
