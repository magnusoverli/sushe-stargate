const { db } = require('../config/database');

class ActivityLog {
  static async create(logData) {
    const log = {
      ...logData,
      timestamp: new Date()
    };
    
    return new Promise((resolve, reject) => {
      db.activity.insert(log, (err, newLog) => {
        if (err) reject(err);
        else resolve(newLog);
      });
    });
  }
  
  static async findByUser(userId, limit = 100) {
    return new Promise((resolve, reject) => {
      db.activity
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec((err, logs) => {
          if (err) reject(err);
          else resolve(logs);
        });
    });
  }
  
  static async findRecent(limit = 50) {
    return new Promise((resolve, reject) => {
      db.activity
        .find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec((err, logs) => {
          if (err) reject(err);
          else resolve(logs);
        });
    });
  }
  
  static async cleanOldLogs(daysToKeep) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    return new Promise((resolve, reject) => {
      db.activity.remove(
        { timestamp: { $lt: cutoffDate } },
        { multi: true },
        (err, numRemoved) => {
          if (err) reject(err);
          else resolve(numRemoved);
        }
      );
    });
  }
  
  static async getStats(days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return new Promise((resolve, reject) => {
      db.activity.find({ timestamp: { $gte: cutoffDate } }, (err, logs) => {
        if (err) reject(err);
        else {
          const stats = {
            totalActions: logs.length,
            uniqueUsers: new Set(logs.map(log => log.userId)).size,
            actionBreakdown: {}
          };
          
          logs.forEach(log => {
            stats.actionBreakdown[log.action] = (stats.actionBreakdown[log.action] || 0) + 1;
          });
          
          resolve(stats);
        }
      });
    });
  }
}

module.exports = ActivityLog;