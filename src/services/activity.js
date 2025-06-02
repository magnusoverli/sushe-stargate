const ActivityLog = require('../models/ActivityLog');

const logActivity = async (userId, action, details = {}, req = null) => {
  try {
    const logData = {
      userId,
      action,
      details,
      sessionId: req?.sessionID || null,
      ipAddress: req?.ip || req?.connection?.remoteAddress || null,
      userAgent: req?.get('user-agent') || null
    };
    
    await ActivityLog.create(logData);
  } catch (error) {
    console.error('Activity logging error:', error);
  }
};

// Clean up old logs periodically
const cleanupOldLogs = async () => {
  const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS) || 30;
  try {
    const removed = await ActivityLog.cleanOldLogs(retentionDays);
    console.log(`Cleaned up ${removed} old activity logs`);
  } catch (error) {
    console.error('Log cleanup error:', error);
  }
};

// Run cleanup daily
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);

module.exports = {
  logActivity
};