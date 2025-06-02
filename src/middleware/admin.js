const { logActivity } = require('../services/activity');

module.exports = {
  ensureAdmin: async function(req, res, next) {
    if (!req.isAuthenticated()) {
      req.flash('error_msg', 'Please log in to access admin features');
      return res.redirect('/auth/login');
    }
    
    if (req.user.role !== 'admin') {
      await logActivity(req.user._id, 'admin_access_denied', {
        attemptedRoute: req.originalUrl
      }, req);
      
      req.flash('error_msg', 'Access denied. Admin privileges required.');
      return res.redirect('/');
    }
    
    next();
  }
};