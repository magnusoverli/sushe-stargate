const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');

const sessionConfig = {
  store: new FileStore({
    path: path.join(process.env.DATA_DIR || './data', 'sessions'),
    ttl: 86400, // 24 hours
    retries: 0,
    secret: process.env.SESSION_SECRET
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