const Datastore = require('@seald-io/nedb');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function migrate() {
  console.log('Starting migration from NeDB to SQLite...');
  
  const dataDir = './data';
  const sqlitePath = path.join(dataDir, 'sushe.db');
  
  // Check if SQLite file already exists and remove it
  if (fs.existsSync(sqlitePath)) {
    console.log('Removing existing SQLite database...');
    fs.unlinkSync(sqlitePath);
  }
  
  // Initialize SQLite with a fresh database
  const sqliteDb = new Database(sqlitePath);
  
  // Enable foreign keys
  sqliteDb.pragma('foreign_keys = ON');
  
  // Create schema
  sqliteDb.exec(`
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
    );

    CREATE TABLE IF NOT EXISTS lists (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      data TEXT DEFAULT '[]',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(userId, name)
    );

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
    );

    CREATE INDEX IF NOT EXISTS idx_lists_userId ON lists(userId);
    CREATE INDEX IF NOT EXISTS idx_activity_userId ON activity(userId);
    CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);
  `);
  
  console.log('SQLite schema created successfully');
  
  // Check if NeDB files exist
  const nedbFiles = {
    users: path.join(dataDir, 'users.db'),
    lists: path.join(dataDir, 'lists.db'),
    activity: path.join(dataDir, 'activity.db')
  };
  
  for (const [name, file] of Object.entries(nedbFiles)) {
    if (!fs.existsSync(file)) {
      console.log(`Warning: ${name}.db not found, skipping...`);
    }
  }
  
  // Load NeDB databases
  const nedb = {
    users: new Datastore({ filename: nedbFiles.users, autoload: true }),
    lists: new Datastore({ filename: nedbFiles.lists, autoload: true }),
    activity: new Datastore({ filename: nedbFiles.activity, autoload: true })
  };
  
  // Migrate users if file exists
  if (fs.existsSync(nedbFiles.users)) {
    console.log('Migrating users...');
    const users = await new Promise((resolve, reject) => {
      nedb.users.find({}, (err, docs) => err ? reject(err) : resolve(docs));
    });
    
    if (users.length > 0) {
      const userStmt = sqliteDb.prepare(`
        INSERT INTO users (id, email, username, hash, role, accentColor, createdAt, updatedAt, lastSelectedList, resetToken, resetExpires, adminGrantedAt)
        VALUES (@id, @email, @username, @hash, @role, @accentColor, @createdAt, @updatedAt, @lastSelectedList, @resetToken, @resetExpires, @adminGrantedAt)
      `);
      
      const insertMany = sqliteDb.transaction((users) => {
        for (const user of users) {
          userStmt.run({
            id: user._id,
            email: user.email,
            username: user.username,
            hash: user.hash,
            role: user.role || null,
            accentColor: user.accentColor || '#dc2626',
            createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: user.updatedAt ? new Date(user.updatedAt).toISOString() : new Date().toISOString(),
            lastSelectedList: user.lastSelectedList || null,
            resetToken: user.resetToken || null,
            resetExpires: user.resetExpires ? new Date(user.resetExpires).toISOString() : null,
            adminGrantedAt: user.adminGrantedAt ? new Date(user.adminGrantedAt).toISOString() : null
          });
        }
      });
      
      insertMany(users);
      console.log(`Migrated ${users.length} users`);
    } else {
      console.log('No users to migrate');
    }
  }
  
  // Migrate lists if file exists
  if (fs.existsSync(nedbFiles.lists)) {
    console.log('Migrating lists...');
    const lists = await new Promise((resolve, reject) => {
      nedb.lists.find({}, (err, docs) => err ? reject(err) : resolve(docs));
    });
    
    if (lists.length > 0) {
      const listStmt = sqliteDb.prepare(`
        INSERT INTO lists (id, userId, name, data, createdAt, updatedAt)
        VALUES (@id, @userId, @name, @data, @createdAt, @updatedAt)
      `);
      
      const insertLists = sqliteDb.transaction((lists) => {
        for (const list of lists) {
          listStmt.run({
            id: list._id,
            userId: list.userId,
            name: list.name,
            data: JSON.stringify(list.data || []),
            createdAt: list.createdAt ? new Date(list.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: list.updatedAt ? new Date(list.updatedAt).toISOString() : new Date().toISOString()
          });
        }
      });
      
      insertLists(lists);
      console.log(`Migrated ${lists.length} lists`);
    } else {
      console.log('No lists to migrate');
    }
  }
  
  // Migrate activity if file exists
  if (fs.existsSync(nedbFiles.activity)) {
    console.log('Migrating activity logs...');
    const activities = await new Promise((resolve, reject) => {
      nedb.activity.find({}, (err, docs) => err ? reject(err) : resolve(docs));
    });
    
    if (activities.length > 0) {
      const activityStmt = sqliteDb.prepare(`
        INSERT INTO activity (id, userId, action, details, timestamp, sessionId, ipAddress, userAgent)
        VALUES (@id, @userId, @action, @details, @timestamp, @sessionId, @ipAddress, @userAgent)
      `);
      
      const insertActivities = sqliteDb.transaction((activities) => {
        for (const activity of activities) {
          activityStmt.run({
            id: activity._id,
            userId: activity.userId || null,
            action: activity.action,
            details: JSON.stringify(activity.details || {}),
            timestamp: activity.timestamp ? new Date(activity.timestamp).toISOString() : new Date().toISOString(),
            sessionId: activity.sessionId || null,
            ipAddress: activity.ipAddress || null,
            userAgent: activity.userAgent || null
          });
        }
      });
      
      insertActivities(activities);
      console.log(`Migrated ${activities.length} activity logs`);
    } else {
      console.log('No activities to migrate');
    }
  }
  
  // Verify migration
  const userCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM users').get();
  const listCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM lists').get();
  const activityCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM activity').get();
  
  console.log('\nMigration Summary:');
  console.log(`- Users in SQLite: ${userCount.count}`);
  console.log(`- Lists in SQLite: ${listCount.count}`);
  console.log(`- Activities in SQLite: ${activityCount.count}`);
  
  // Close database
  sqliteDb.close();
  
  console.log('\nMigration completed successfully!');
  console.log('\nNext steps:');
  console.log('1. Backup your old .db files:');
  console.log('   mkdir data\\nedb-backup');
  console.log('   move data\\*.db data\\nedb-backup\\');
  console.log('2. Update your application code to use SQLite models');
  console.log('3. Test the application thoroughly');
  console.log('\nThe new SQLite database is at: data/sushe.db');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});