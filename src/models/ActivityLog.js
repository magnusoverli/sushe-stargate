const { db, generateId } = require('../config/database');

class ActivityLog {
  static async create(logData) {
    const log = {
      id: generateId(),
      ...logData,
      details: JSON.stringify(logData.details || {}),
      timestamp: new Date().toISOString()
    };
    
    const stmt = db.prepare(`
      INSERT INTO activity (id, userId, action, details, timestamp, sessionId, ipAddress, userAgent)
      VALUES (@id, @userId, @action, @details, @timestamp, @sessionId, @ipAddress, @userAgent)
    `);
    
    stmt.run(log);
    return { ...log, _id: log.id };
  }
  
  static async findByUser(userId, limit = 100) {
    const stmt = db.prepare(`
      SELECT * FROM activity 
      WHERE userId = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    const logs = stmt.all(userId, limit);
    return logs.map(log => ({
      ...log,
      details: JSON.parse(log.details),
      _id: log.id
    }));
  }
  
  static async findRecent(limit = 50) {
    const stmt = db.prepare(`
      SELECT * FROM activity 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    
    const logs = stmt.all(limit);
    return logs.map(log => ({
      ...log,
      details: JSON.parse(log.details),
      _id: log.id
    }));
  }
  
  static async cleanOldLogs(daysToKeep) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const stmt = db.prepare('DELETE FROM activity WHERE timestamp < ?');
    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }
  
  static async getStats(days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as totalActions,
        COUNT(DISTINCT userId) as uniqueUsers,
        action,
        COUNT(*) as actionCount
      FROM activity 
      WHERE timestamp >= ?
      GROUP BY action
    `);
    
    const results = stmt.all(cutoffDate.toISOString());
    
    const stats = {
      totalActions: 0,
      uniqueUsers: 0,
      actionBreakdown: {}
    };
    
    if (results.length > 0) {
      stats.totalActions = results.reduce((sum, r) => sum + r.actionCount, 0);
      stats.uniqueUsers = results[0].uniqueUsers;
      
      results.forEach(r => {
        stats.actionBreakdown[r.action] = r.actionCount;
      });
    }
    
    return stats;
  }
}

module.exports = ActivityLog;