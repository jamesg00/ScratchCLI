pub mod models;
pub mod repository;

use crate::error::CoreError;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    Executor, SqlitePool,
};
use std::path::Path;

const INITIAL_MIGRATION: &str = include_str!("../../migrations/0001_initial.sql");
const COCKPIT_NOTES_MIGRATION: &str = include_str!("../../migrations/0002_cockpit_notes.sql");

pub async fn connect(database_path: &Path) -> Result<SqlitePool, CoreError> {
    let in_memory = database_path == Path::new(":memory:");

    let options = (if in_memory {
        SqliteConnectOptions::new().in_memory(true)
    } else {
        if let Some(parent) = database_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        SqliteConnectOptions::new()
            .filename(database_path)
            .create_if_missing(true)
    })
    .foreign_keys(true)
    .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePoolOptions::new()
        .max_connections(if in_memory { 1 } else { 5 })
        .connect_with(options)
        .await?;

    migrate(&pool).await?;
    Ok(pool)
}

async fn migrate(pool: &SqlitePool) -> Result<(), CoreError> {
    let mut transaction = pool.begin().await?;
    transaction
        .execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY NOT NULL,
                applied_at TEXT NOT NULL
            )",
        )
        .await?;

    for (version, migration) in [(1_i64, INITIAL_MIGRATION), (2_i64, COCKPIT_NOTES_MIGRATION)] {
        let applied: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?)")
                .bind(version)
                .fetch_one(&mut *transaction)
                .await?;
        if applied {
            continue;
        }
        for statement in migration.split(';') {
            let statement = statement.trim();
            if !statement.is_empty() {
                transaction.execute(statement).await?;
            }
        }
        sqlx::query(
            "INSERT INTO schema_migrations (version, applied_at)
             VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))",
        )
        .bind(version)
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;
    Ok(())
}
