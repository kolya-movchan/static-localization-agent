import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

export const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'pending',
    input_type  TEXT NOT NULL,
    input_url   TEXT NOT NULL,
    parent_folder_id   TEXT,
    parent_folder_url  TEXT,
    languages   TEXT NOT NULL,
    comments    TEXT,
    error_message TEXT,
    total_images      INTEGER DEFAULT 0,
    processed_images  INTEGER DEFAULT 0,
    failed_images     INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS job_items (
    id          TEXT PRIMARY KEY,
    job_id      TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    image_name  TEXT NOT NULL,
    image_id    TEXT NOT NULL,
    mime_type   TEXT NOT NULL DEFAULT 'image/png',
    language    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    model_used  TEXT,
    error_message TEXT,
    output_file_id  TEXT,
    output_file_url TEXT,
    output_folder_id  TEXT,
    output_folder_url TEXT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ItemStatus = 'pending' | 'processing' | 'success' | 'error';

export interface Job {
  id: string;
  status: JobStatus;
  input_type: string;
  input_url: string;
  parent_folder_id: string | null;
  parent_folder_url: string | null;
  languages: string;
  comments: string | null;
  error_message: string | null;
  total_images: number;
  processed_images: number;
  failed_images: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface JobItem {
  id: string;
  job_id: string;
  image_name: string;
  image_id: string;
  mime_type: string;
  language: string;
  status: ItemStatus;
  model_used: string | null;
  error_message: string | null;
  output_file_id: string | null;
  output_file_url: string | null;
  output_folder_id: string | null;
  output_folder_url: string | null;
  created_at: string;
  updated_at: string;
}

const touch = () => new Date().toISOString();

export const queries = {
  createJob: db.prepare<[string, string, string, string, string, string | null]>(`
    INSERT INTO jobs (id, status, input_type, input_url, languages, comments)
    VALUES (?, 'pending', ?, ?, ?, ?)
  `),

  updateJob: db.prepare<[string, string, string]>(`
    UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?
  `),

  updateJobCounts: db.prepare<[number, number, number, string, string]>(`
    UPDATE jobs SET total_images = ?, processed_images = ?, failed_images = ?, updated_at = ? WHERE id = ?
  `),

  setJobParentFolder: db.prepare<[string, string, string, string]>(`
    UPDATE jobs SET parent_folder_id = ?, parent_folder_url = ?, updated_at = ? WHERE id = ?
  `),

  completeJob: db.prepare<[JobStatus, string, string, string]>(`
    UPDATE jobs SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
  `),

  failJob: db.prepare<[string, string, string]>(`
    UPDATE jobs SET status = 'failed', error_message = ?, completed_at = ?, updated_at = ? WHERE id = ?
  `),

  getJob: db.prepare<[string], Job>(`SELECT * FROM jobs WHERE id = ?`),

  listJobs: db.prepare<[], Job>(`SELECT * FROM jobs ORDER BY created_at DESC`),

  deleteJob: db.prepare<[string]>(`DELETE FROM jobs WHERE id = ?`),

  createJobItem: db.prepare<[string, string, string, string, string, string]>(`
    INSERT INTO job_items (id, job_id, image_name, image_id, mime_type, language)
    VALUES (?, ?, ?, ?, ?, ?)
  `),

  updateJobItem: db.prepare<[ItemStatus, string | null, string | null, string | null, string | null, string | null, string | null, string]>(`
    UPDATE job_items
    SET status = ?, model_used = ?, error_message = ?,
        output_file_id = ?, output_file_url = ?, output_folder_id = ?, output_folder_url = ?,
        updated_at = ?
    WHERE id = ?
  `),

  setJobItemProcessing: db.prepare<[string, string]>(`
    UPDATE job_items SET status = 'processing', updated_at = ? WHERE id = ?
  `),

  getJobItems: db.prepare<[string], JobItem>(`
    SELECT * FROM job_items WHERE job_id = ? ORDER BY image_name, language
  `),

  getPendingJobs: db.prepare<[], Job>(`
    SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1
  `),

  incrementProcessed: db.prepare<[string, string]>(`
    UPDATE jobs SET processed_images = processed_images + 1, updated_at = ? WHERE id = ?
  `),

  incrementFailed: db.prepare<[string, string]>(`
    UPDATE jobs SET failed_images = failed_images + 1, processed_images = processed_images + 1, updated_at = ? WHERE id = ?
  `),
};

// Migrate existing DB: add error_message column if missing
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN error_message TEXT`);
} catch {
  // column already exists — safe to ignore
}

export { touch };
