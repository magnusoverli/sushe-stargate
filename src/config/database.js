const Datastore = require('nedb');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || './data';

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize databases
const db = {
  users: new Datastore({ 
    filename: path.join(dataDir, 'users.db'), 
    autoload: true 
  }),
  lists: new Datastore({ 
    filename: path.join(dataDir, 'lists.db'), 
    autoload: true 
  }),
  activity: new Datastore({ 
    filename: path.join(dataDir, 'activity.db'), 
    autoload: true 
  })
};

// Create indexes
function initializeDatabase() {
  // User indexes
  db.users.ensureIndex({ fieldName: 'email', unique: true });
  db.users.ensureIndex({ fieldName: 'username', unique: true });
  
  // List indexes
  db.lists.ensureIndex({ fieldName: 'userId' });
  db.lists.ensureIndex({ fieldName: 'name' });
  
  // Activity log indexes
  db.activity.ensureIndex({ fieldName: 'userId' });
  db.activity.ensureIndex({ fieldName: 'timestamp' });
  
  console.log('Database initialized successfully');
}

module.exports = { db, initializeDatabase };