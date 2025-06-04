const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

const sessionConfig = {
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: process.env.DATA_DIR || './data',
    table: 'sessions',
    concurrentDB: true
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Always allow HTTP
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  },
  name: 'sushe.sid'
};

module.exports = { sessionConfig };