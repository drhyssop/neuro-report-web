import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 오프라인 SQLite 연결 (싱글턴).
 * DB 파일 위치: 프로젝트 루트의 data/neuro.db  (NEURO_DB_PATH로 재정의 가능)
 */
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbPath =
    process.env.NEURO_DB_PATH || path.join(process.cwd(), 'data', 'neuro.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 스키마 적용 (idempotent — create table if not exists)
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  _db = db;
  return db;
}

// JSON 컬럼 목록 — 저장 시 stringify, 읽을 때 parse
export const JSON_COLUMNS: Record<string, Set<string>> = {
  patients: new Set([
    'baseline_regions', 'medications', 'consults_log', 'drains_log',
    'imaging_log', 'antibiotics_log', 'preop_imaging', 'rounding_notes',
  ]),
  examinations: new Set([
    'regions', 'antibiotics', 'drains', 'drain_outputs', 'followup_imaging', 'labs',
  ]),
};

// boolean 컬럼 — 0/1 <-> true/false
export const BOOL_COLUMNS: Record<string, Set<string>> = {
  patients: new Set(['active', 'is_consult', 'is_admission_pending', 'is_on_mview']),
  examinations: new Set(['fever']),
};
