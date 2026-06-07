use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Mutex;
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
    Imported { collection: QuestionCollectionDto },
    Conflict { duplicate_questions: Vec<DuplicateQuestionPreviewDto> },
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
    )
}

fn fingerprint_question(question: &CollectionQuestionDto) -> String {
    let normalize = |value: &str| value.trim().split_whitespace().collect::<Vec<_>>().join(" ");
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

fn generate_question_id(fingerprint: &str, used_ids: &mut std::collections::HashSet<String>) -> String {
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

fn question_from_row(conn: &Connection, row: &rusqlite::Row<'_>) -> rusqlite::Result<CollectionQuestionDto> {
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
        correct_answer_explanation: row.get(4)?,
        question_category: row.get(5)?,
        question_subcategory: row.get(6)?,
        question_source: row.get(7)?,
        analytics: QuestionAnalyticsDto {
            computed_difficulty: row.get(8)?,
            user_declared_difficulty: row.get(9)?,
            times_answered_incorrectly: row.get(10)?,
            times_answered_correctly: row.get(11)?,
        },
    })
}

fn load_options(conn: &Connection, question_id: &str) -> rusqlite::Result<Vec<QuestionOptionDto>> {
    let mut stmt = conn.prepare(
        "SELECT option_key, text FROM question_options WHERE question_id = ? ORDER BY position ASC",
    )?;
    let options = stmt.query_map([question_id], |row| {
        Ok(QuestionOptionDto {
            id: row.get(0)?,
            text: row.get(1)?,
        })
    })?
    .collect();
    options
}

fn is_option_correct(conn: &Connection, question_id: &str, option_key: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT is_correct FROM question_options WHERE question_id = ? AND option_key = ?",
        params![question_id, option_key],
        |row| row.get::<_, i64>(0),
    )
    .map(|value| value == 1)
}

fn load_all_questions(conn: &Connection) -> rusqlite::Result<Vec<CollectionQuestionDto>> {
    let mut stmt = conn.prepare(
        "SELECT id, question, auxiliary_information, question_type, correct_answer_explanation,
                question_category, question_subcategory, question_source, computed_difficulty,
                user_declared_difficulty, times_answered_incorrectly, times_answered_correctly
         FROM questions ORDER BY rowid ASC",
    )?;
    let rows = stmt.query_map([], |row| question_from_row(conn, row))?;
    rows.collect()
}

fn build_summary(questions: &[CollectionQuestionDto]) -> QuestionCollectionSummaryDto {
    use std::collections::HashSet;
    let categories = questions.iter().map(|q| q.question_category.clone()).collect::<HashSet<_>>();
    let subcategories = questions.iter().filter_map(|q| q.question_subcategory.clone()).collect::<HashSet<_>>();
    let sources = questions.iter().filter_map(|q| q.question_source.clone()).collect::<HashSet<_>>();
    QuestionCollectionSummaryDto {
        total_questions: questions.len() as i64,
        total_categories: categories.len() as i64,
        total_subcategories: subcategories.len() as i64,
        total_single_choice: questions.iter().filter(|q| q.question_type == "single_choice").count() as i64,
        total_multiple_choice: questions.iter().filter(|q| q.question_type == "multiple_choice").count() as i64,
        total_sources: sources.len() as i64,
    }
}

fn load_collection(conn: &Connection) -> rusqlite::Result<Option<QuestionCollectionDto>> {
    let questions = load_all_questions(conn)?;
    if questions.is_empty() {
        return Ok(None);
    }
    let imported_at = conn
        .query_row("SELECT MAX(imported_at) FROM questions", [], |row| row.get::<_, Option<String>>(0))?
        .unwrap_or_else(now_iso);
    let summary = build_summary(&questions);
    Ok(Some(QuestionCollectionDto { version: "1".into(), imported_at, questions, summary }))
}

fn insert_question(conn: &Connection, question: &CollectionQuestionDto, preserve_id: Option<&str>) -> rusqlite::Result<()> {
    let id = preserve_id.unwrap_or(&question.id);
    let fingerprint = fingerprint_question(question);
    let now = now_iso();
    conn.execute(
        "INSERT OR REPLACE INTO questions(id, content_fingerprint, question, auxiliary_information, question_type,
         correct_answer_explanation, question_category, question_subcategory, question_source, computed_difficulty,
         user_declared_difficulty, times_answered_incorrectly, times_answered_correctly, imported_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            id,
            fingerprint,
            question.question,
            question.auxiliary_information,
            question.question_type,
            question.correct_answer_explanation,
            question.question_category,
            question.question_subcategory,
            question.question_source,
            question.analytics.computed_difficulty,
            question.analytics.user_declared_difficulty,
            question.analytics.times_answered_incorrectly,
            question.analytics.times_answered_correctly,
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
        .query_row("SELECT value FROM app_preferences WHERE key = 'language'", [], |row| row.get::<_, String>(0))
        .optional()
        .map_err(|error| error.to_string())?
        .unwrap_or_else(|| "English".into());
    let theme = conn
        .query_row("SELECT value FROM app_preferences WHERE key = 'theme'", [], |row| row.get::<_, String>(0))
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
fn get_question_collection(state: State<'_, DbState>) -> CommandResult<Option<QuestionCollectionDto>> {
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
            existing_fingerprints.get(&fingerprint).map(|_| DuplicateQuestionPreviewDto {
                fingerprint,
                question: question.question.clone(),
            })
        })
        .collect::<Vec<_>>();

    if request.merge && !duplicates.is_empty() && request.resolution.is_none() {
        return Ok(ImportQuestionCollectionResponse::Conflict { duplicate_questions: duplicates });
    }

    if !request.merge {
        tx.execute("DELETE FROM questions", []).map_err(|error| error.to_string())?;
    }

    let mut used_ids = if request.merge {
        existing.iter().map(|question| question.id.clone()).collect::<std::collections::HashSet<_>>()
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
        if preserve_id.is_none() || request.resolution.as_deref() == Some("replaceExisting") || !existing_fingerprints.contains_key(&fingerprint) {
            insert_question(&tx, &question_to_insert, preserve_id).map_err(|error| error.to_string())?;
        }
    }

    tx.commit().map_err(|error| error.to_string())?;
    let collection = load_collection(&conn).map_err(|error| error.to_string())?.unwrap_or(QuestionCollectionDto {
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
                correct_answer_explanation: question.correct_answer_explanation,
                question_category: question.question_category,
                question_subcategory: question.question_subcategory,
                question_source: question.question_source,
            })
            .collect(),
    })
}

#[tauri::command]
fn save_test_definition(state: State<'_, DbState>, definition: TestDefinitionDto) -> CommandResult<()> {
    let mut conn = state.conn.lock().map_err(|error| error.to_string())?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    tx.execute(
        "INSERT INTO test_definitions(id, title, question_limit, allow_unanswered, time_limit_enabled, time_limit_minutes, negative_marking_enabled, penalty_per_incorrect_answer, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, question_limit = excluded.question_limit, allow_unanswered = excluded.allow_unanswered, time_limit_enabled = excluded.time_limit_enabled, time_limit_minutes = excluded.time_limit_minutes, negative_marking_enabled = excluded.negative_marking_enabled, penalty_per_incorrect_answer = excluded.penalty_per_incorrect_answer, updated_at = excluded.updated_at",
        params![definition.id, definition.title, definition.question_limit, definition.allow_unanswered as i64, definition.time_limit_enabled.unwrap_or(false) as i64, definition.time_limit_minutes, definition.negative_marking_enabled as i64, definition.penalty_per_incorrect_answer, definition.created_at, definition.updated_at],
    ).map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM test_definition_categories WHERE test_definition_id = ?", [&definition.id]).map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM test_definition_subcategories WHERE test_definition_id = ?", [&definition.id]).map_err(|error| error.to_string())?;
    for category in &definition.included_categories {
        tx.execute("INSERT INTO test_definition_categories(test_definition_id, category) VALUES (?, ?)", params![definition.id, category]).map_err(|error| error.to_string())?;
    }
    for subcategory in definition.included_subcategories.clone().unwrap_or_default() {
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
    conn.execute("DELETE FROM test_definitions WHERE id = ?", [id]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn generate_test_questions(state: State<'_, DbState>, definition: TestDefinitionDto) -> CommandResult<Vec<CollectionQuestionDto>> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    let mut questions = load_all_questions(&conn).map_err(|error| error.to_string())?;
    questions.retain(|question| {
        definition.included_categories.contains(&question.question_category)
            && definition
                .included_subcategories
                .as_ref()
                .map(|subs| subs.is_empty() || question.question_subcategory.as_ref().map(|value| subs.contains(value)).unwrap_or(false))
                .unwrap_or(true)
    });
    Ok(questions)
}

#[tauri::command]
fn save_completed_attempt(state: State<'_, DbState>, request: SaveCompletedAttemptRequest) -> CommandResult<()> {
    let mut conn = state.conn.lock().map_err(|error| error.to_string())?;
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let attempt = &request.attempt;
    tx.execute(
        "INSERT OR REPLACE INTO test_attempts(id, test_definition_id, test_title, started_at, completed_at, duration_seconds, total_questions, correct_answers, incorrect_answers, unanswered_questions, raw_score, final_score, accuracy_percentage, grade_out_of_10, retry_attempts, retry_correct_answers, retry_incorrect_answers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![attempt.id, attempt.test_id, attempt.test_title, attempt.started_at, attempt.completed_at, attempt.duration_seconds, attempt.total_questions, attempt.correct_answers, attempt.incorrect_answers, attempt.unanswered_questions, attempt.raw_score, attempt.final_score, attempt.accuracy_percentage, attempt.grade_out_of_10, attempt.retry_attempts, attempt.retry_correct_answers, attempt.retry_incorrect_answers],
    ).map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM test_attempt_category_results WHERE attempt_id = ?", [&attempt.id]).map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM test_attempt_answers WHERE attempt_id = ?", [&attempt.id]).map_err(|error| error.to_string())?;
    for category in &attempt.category_results {
        tx.execute("INSERT INTO test_attempt_category_results(attempt_id, category, correct, incorrect, unanswered, total, accuracy_percentage) VALUES (?, ?, ?, ?, ?, ?, ?)", params![attempt.id, category.category, category.correct, category.incorrect, category.unanswered, category.total, category.accuracy_percentage]).map_err(|error| error.to_string())?;
    }
    for answer in &request.answers {
        tx.execute("INSERT INTO test_attempt_answers(attempt_id, queue_id, source_question_id, retry_number, question_snapshot, selected_option_ids_json, correct_option_ids_json, is_correct, is_unanswered, answered_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", params![attempt.id, answer.queue_id, answer.source_question_id, answer.retry_number, serde_json::to_string(&answer.question).map_err(|error| error.to_string())?, serde_json::to_string(&answer.selected_option_ids).map_err(|error| error.to_string())?, serde_json::to_string(&answer.correct_option_ids).map_err(|error| error.to_string())?, answer.is_correct as i64, answer.is_unanswered as i64, answer.answered_at]).map_err(|error| error.to_string())?;
    }
    tx.commit().map_err(|error| error.to_string())?;
    Ok(())
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
    conn.execute("DELETE FROM test_attempts", []).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn reset_question_bank(state: State<'_, DbState>) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM questions", []).map_err(|error| error.to_string())?;
    conn.execute("DELETE FROM active_test_attempts", []).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn update_question_difficulty(state: State<'_, DbState>, question_id: String, difficulty: String) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    conn.execute("UPDATE questions SET user_declared_difficulty = ?, updated_at = ? WHERE id = ?", params![difficulty, now_iso(), question_id]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_active_test_attempt(state: State<'_, DbState>) -> CommandResult<Option<ActiveTestRecoveryDto>> {
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
fn save_active_test_attempt(state: State<'_, DbState>, recovery: ActiveTestRecoveryDto) -> CommandResult<()> {
    let conn = state.conn.lock().map_err(|error| error.to_string())?;
    let test_definition_snapshot = serde_json::to_string(&recovery.test_definition).map_err(|error| error.to_string())?;
    let active_attempt_snapshot = serde_json::to_string(&recovery.active_attempt).map_err(|error| error.to_string())?;
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
            app.manage(DbState { conn: Mutex::new(conn) });
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
