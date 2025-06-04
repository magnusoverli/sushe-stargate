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
  secret: process.env.SESSION_SECRET || 'default-secret-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'sushe.sid'
};

module.exports = { sessionConfig };