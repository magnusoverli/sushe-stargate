const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || './data';

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const db = new Database(path.join(dataDir, 'sushe.db'));

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      hash TEXT NOT NULL,
      role TEXT,
      accentColor TEXT DEFAULT '#dc2626',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastSelectedList TEXT,
      resetToken TEXT,
      resetExpires TEXT,
      adminGrantedAt TEXT
    )
  `);

  // Create lists table
  db.exec(`
    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      data TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, name)
    )
  `);

  // Create activity table
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      userId TEXT,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL,
      sessionId TEXT,
      ipAddress TEXT,
      userAgent TEXT,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lists_userId ON lists(userId);
    CREATE INDEX IF NOT EXISTS idx_activity_userId ON activity(userId);
    CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);
  `);

  console.log('SQLite database initialized successfully');
}

// Helper to generate IDs (similar to NeDB's _id)
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

module.exports = { db, initializeDatabase, generateId };