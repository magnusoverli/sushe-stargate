const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { validatePasswordChange } = require('../middleware/validation');
const { logActivity } = require('../services/activity');

// Main application page
router.get('/', ensureAuthenticated, (req, res) => {
  res.render('index', {
    user: req.user,
    countries: require('../utils/helpers').countries,
    genres: require('../utils/helpers').genres
  });
});

// Settings page
router.get('/settings', ensureAuthenticated, (req, res) => {
  res.render('settings', { user: req.user });
});

// Change password
router.post('/settings/change-password', ensureAuthenticated, validatePasswordChange, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  try {
    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, req.user.hash);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(newPassword, salt);
    
    // Update user
    await User.updateById(req.user._id, { hash });
    
    await logActivity(req.user._id, 'password_changed', {}, req);
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update password' 
    });
  }
});

// Update accent color
router.post('/settings/update-accent-color', ensureAuthenticated, async (req, res) => {
  const { color } = req.body;
  
  try {
    await User.updateById(req.user._id, { accentColor: color });
    
    await logActivity(req.user._id, 'theme_changed', { color }, req);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Update color error:', error);
    res.status(500).json({ error: 'Failed to update color' });
  }
});

// Update email
router.post('/settings/update-email', ensureAuthenticated, async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Verify password
    const isMatch = await bcrypt.compare(password, req.user.hash);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is incorrect' 
      });
    }
    
    // Check if email already exists
    const existing = await User.findByEmail(email);
    if (existing && existing._id !== req.user._id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already in use' 
      });
    }
    
    // Update email
    await User.updateById(req.user._id, { email: email.toLowerCase() });
    
    await logActivity(req.user._id, 'email_changed', { 
      oldEmail: req.user.email,
      newEmail: email 
    }, req);
    
    res.json({ success: true, message: 'Email updated successfully' });
  } catch (error) {
    console.error('Update email error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update email' 
    });
  }
});

// Update username
router.post('/settings/update-username', ensureAuthenticated, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Verify password
    const isMatch = await bcrypt.compare(password, req.user.hash);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is incorrect' 
      });
    }
    
    // Validate username
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username must be 3-30 characters and contain only letters, numbers, and underscores' 
      });
    }
    
    // Check if username already exists
    const existing = await User.findByUsername(username);
    if (existing && existing._id !== req.user._id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username already taken' 
      });
    }
    
    // Update username
    await User.updateById(req.user._id, { username });
    
    await logActivity(req.user._id, 'username_changed', { 
      oldUsername: req.user.username,
      newUsername: username 
    }, req);
    
    res.json({ success: true, message: 'Username updated successfully' });
  } catch (error) {
    console.error('Update username error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update username' 
    });
  }
});

module.exports = router;