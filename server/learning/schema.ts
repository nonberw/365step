export const LEARNING_SCHEMA = `
CREATE TABLE IF NOT EXISTS learning_profiles (
 user_id TEXT PRIMARY KEY REFERENCES users(id), direction_id TEXT NOT NULL,
 specialization_id TEXT, version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS learning_profile_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL REFERENCES users(id),
 previous_direction TEXT, direction_id TEXT NOT NULL, version INTEGER NOT NULL, at INTEGER NOT NULL,
 UNIQUE(user_id,version)
);
CREATE TABLE IF NOT EXISTS learning_catalog (
 id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 updated_at INTEGER NOT NULL, published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS learning_attempts (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), direction_id TEXT NOT NULL,
 module_id TEXT NOT NULL, lesson_id TEXT NOT NULL, content_version INTEGER NOT NULL,
 items TEXT NOT NULL, answers TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL,
 done_at INTEGER, xp INTEGER NOT NULL DEFAULT 0, request_key TEXT NOT NULL, UNIQUE(user_id,request_key)
);
CREATE TABLE IF NOT EXISTS learning_projects (
 user_id TEXT NOT NULL REFERENCES users(id), project_id TEXT NOT NULL, direction_id TEXT NOT NULL,
 body TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, submitted_at INTEGER,
 updated_at INTEGER NOT NULL, PRIMARY KEY(user_id,project_id)
);
CREATE TABLE IF NOT EXISTS learning_reviews (
 user_id TEXT NOT NULL REFERENCES users(id), item_id TEXT NOT NULL, direction_id TEXT NOT NULL,
 due_at INTEGER NOT NULL, correct_streak INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,item_id)
);
CREATE TABLE IF NOT EXISTS learning_content_edits (
 id TEXT NOT NULL, version INTEGER NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
 reviews TEXT NOT NULL DEFAULT '{}', author_id TEXT NOT NULL REFERENCES users(id), at INTEGER NOT NULL,
 PRIMARY KEY(id,version)
);
CREATE INDEX IF NOT EXISTS learning_attempts_user ON learning_attempts(user_id,direction_id,done_at);
`;
export const DIAGNOSTIC_SCHEMA=`CREATE TABLE IF NOT EXISTS learning_diagnostics(user_id TEXT NOT NULL REFERENCES users(id),direction_id TEXT NOT NULL,result TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(user_id,direction_id));`;
export const PROJECT_REVIEW_SCHEMA=`CREATE TABLE IF NOT EXISTS learning_project_reviews(user_id TEXT NOT NULL,project_id TEXT NOT NULL,version INTEGER NOT NULL,reviewer_id TEXT NOT NULL REFERENCES users(id),scores TEXT NOT NULL,comment TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(user_id,project_id,version));`;
