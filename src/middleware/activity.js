const { logActivity } = require('../services/activity');

const activityLogger = async (req, res, next) => {
  // Skip logging for static assets and certain routes
  const skipPaths = ['/css/', '/js/', '/images/', '/favicon.ico', '/api/admin/activity-stream'];
  
  if (skipPaths.some(path => req.url.includes(path))) {
    return next();
  }
  
  // Log page views for authenticated users
  if (req.isAuthenticated() && req.method === 'GET') {
    const action = 'page_view';
    const details = {
      path: req.path,
      query: req.query,
      referrer: req.get('referrer')
    };
    
    // Don't await to avoid blocking
    logActivity(req.user._id, action, details, req).catch(console.error);
  }
  
  next();
};

module.exports = { activityLogger };