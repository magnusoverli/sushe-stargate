const express = require('express');
const router = express.Router();
const User = require('../models/User');
const List = require('../models/List');
const ActivityLog = require('../models/ActivityLog');
const { ensureAdmin } = require('../middleware/admin');
const { ensureAuthenticated } = require('../middleware/auth');
const { validateAdminCode } = require('../utils/adminCode');
const { logActivity } = require('../services/activity');
const { checkRateLimit } = require('../utils/helpers');
const { db } = require('../config/database');

// Admin panel page
router.get('/', ensureAdmin, async (req, res) => {
  try {
    // Get all users with list counts
    const users = await User.findAll();
    const userStats = await Promise.all(users.map(async (user) => {
      const listCount = await List.countByUser(user._id);
      return { ...user, listCount };
    }));
    
    // Get system statistics
    const { totalLists, totalAlbums } = await List.getStats();
    const activityStats = await ActivityLog.getStats(7);
    
    res.render('admin', {
      users: userStats,
      stats: {
        totalUsers: users.length,
        totalLists,
        totalAlbums,
        activeUsers: activityStats.uniqueUsers,
        activeSessions: 0 // TODO: Count active sessions
      }
    });
  } catch (error) {
    console.error('Admin panel error:', error);
    req.flash('error_msg', 'Failed to load admin panel');
    res.redirect('/');
  }
});

// Submit admin code
router.post('/request-admin', ensureAuthenticated, async (req, res) => {
  const { adminCode } = req.body;
  const userId = req.user._id;
  
  // Rate limiting
  if (!checkRateLimit(`admin-${userId}`, 5, 30 * 60 * 1000)) {
    await logActivity(userId, 'admin_code_rate_limited', {}, req);
    return res.status(429).json({ 
      success: false, 
      message: 'Too many attempts. Please try again later.' 
    });
  }
  
  if (validateAdminCode(adminCode)) {
    await User.updateById(userId, {
      role: 'admin',
      adminGrantedAt: new Date()
    });
    
    await logActivity(userId, 'admin_access_granted', { code: adminCode }, req);
    
    res.json({ success: true, message: 'Admin access granted!' });
  } else {
    await logActivity(userId, 'admin_code_failed', { code: adminCode }, req);
    
    res.status(400).json({ 
      success: false, 
      message: 'Invalid or expired code' 
    });
  }
});

// Make user admin
router.post('/make-admin', ensureAdmin, async (req, res) => {
  const { userId } = req.body;
  
  try {
    await User.updateById(userId, {
      role: 'admin',
      adminGrantedAt: new Date()
    });
    
    await logActivity(req.user._id, 'admin_granted_to_user', {
      targetUserId: userId
    }, req);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Make admin error:', error);
    res.status(500).json({ error: 'Failed to grant admin access' });
  }
});

// Revoke admin
router.post('/revoke-admin', ensureAdmin, async (req, res) => {
  const { userId } = req.body;
  
  try {
    await User.updateById(userId, {
      role: undefined,
      adminGrantedAt: undefined
    });
    
    await logActivity(req.user._id, 'admin_revoked_from_user', {
      targetUserId: userId
    }, req);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke admin error:', error);
    res.status(500).json({ error: 'Failed to revoke admin access' });
  }
});

// Delete user
router.post('/delete-user', ensureAdmin, async (req, res) => {
  const { userId } = req.body;
  
  try {
    // Don't allow deleting yourself
    if (userId === req.user._id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Delete user's lists first
    await List.deleteAllByUser(userId);
    
    // Delete user
    await User.delete(userId);
    
    await logActivity(req.user._id, 'user_deleted', {
      targetUserId: userId
    }, req);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Export users as CSV
router.get('/export-users', ensureAdmin, async (req, res) => {
  try {
    const users = await User.findAll();
    const stats = await Promise.all(users.map(async (user) => {
      const listCount = await List.countByUser(user._id);
      return { ...user, listCount };
    }));
    
    // Create CSV
    const csv = [
      'Email,Username,Role,Accent Color,Created At,List Count',
      ...stats.map(u => 
        `"${u.email}","${u.username}","${u.role || 'user'}","${u.accentColor}","${u.createdAt}",${u.listCount}`
      )
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users.csv"');
    res.send(csv);
    
    await logActivity(req.user._id, 'users_exported', {
      count: users.length
    }, req);
  } catch (error) {
    console.error('Export users error:', error);
    res.status(500).json({ error: 'Failed to export users' });
  }
});

// Get user's lists
router.get('/user-lists/:userId', ensureAdmin, async (req, res) => {
  const { userId } = req.params;
  
  try {
    const lists = await List.findByUser(userId);
    res.json(lists);
  } catch (error) {
    console.error('Get user lists error:', error);
    res.status(500).json({ error: 'Failed to fetch user lists' });
  }
});

// Database backup
router.get('/backup', ensureAdmin, async (req, res) => {
  try {
    const users = await User.findAll();
    const lists = db.prepare('SELECT * FROM lists').all();
    const activity = db.prepare('SELECT * FROM activity').all();

    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      data: {
        users,
        lists,
        activity
      }
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="sushe-backup.json"');
    res.send(JSON.stringify(backup, null, 2));
    
    await logActivity(req.user._id, 'database_backup_created', {}, req);
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

// Database restore
router.post('/restore', ensureAdmin, async (req, res) => {
  // TODO: Implement database restore
  res.status(501).json({ error: 'Not implemented yet' });
});

// Clear all sessions
router.post('/clear-sessions', ensureAdmin, async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    const sessionsDir = path.join(process.env.DATA_DIR || './data', 'sessions');
    
    const files = await fs.readdir(sessionsDir);
    await Promise.all(files.map(file => 
      fs.unlink(path.join(sessionsDir, file)).catch(() => {})
    ));
    
    await logActivity(req.user._id, 'sessions_cleared', {
      count: files.length
    }, req);
    
    res.json({ success: true, count: files.length });
  } catch (error) {
    console.error('Clear sessions error:', error);
    res.status(500).json({ error: 'Failed to clear sessions' });
  }
});

// Check admin status
router.get('/api/admin/status', ensureAuthenticated, (req, res) => {
  res.json({ isAdmin: req.user.role === 'admin' });
});

// Activity stream for real-time monitoring
router.get('/api/admin/activity-stream', ensureAdmin, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send recent activities
  const recent = await ActivityLog.findRecent(20);
  res.write(`data: ${JSON.stringify(recent)}\n\n`);
  
  // TODO: Implement real-time streaming
  // For now, just send periodic updates
  const interval = setInterval(async () => {
    const latest = await ActivityLog.findRecent(1);
    if (latest.length > 0) {
      res.write(`data: ${JSON.stringify(latest)}\n\n`);
    }
  }, 5000);
  
  req.on('close', () => {
    clearInterval(interval);
  });
});

module.exports = router;