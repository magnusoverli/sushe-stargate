const express = require('express');
const router = express.Router();
const passport = require('passport');
const crypto = require('crypto');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../services/email');
const { validateRegistration, validatePasswordChange } = require('../middleware/validation');
const { ensureGuest } = require('../middleware/auth');
const { logActivity } = require('../services/activity');
const { checkRateLimit } = require('../utils/helpers');

// Login page
router.get('/login', ensureGuest, (req, res) => {
  res.render('login');
});

// Login handler
router.post('/login', ensureGuest, async (req, res, next) => {
  const { email } = req.body;
  
  // Rate limiting
  if (!checkRateLimit(`login-${email}`, 5, 15 * 60 * 1000)) {
    await logActivity(null, 'login_rate_limited', { email }, req);
    req.flash('error_msg', 'Too many login attempts. Please try again later.');
    return res.redirect('/auth/login');
  }
  
  passport.authenticate('local', async (err, user, info) => {
    if (err) return next(err);
    
    if (!user) {
      await logActivity(null, 'login_failed', { email, reason: info.message }, req);
      req.flash('error_msg', info.message);
      return res.redirect('/auth/login');
    }
    
    req.logIn(user, async (err) => {
      if (err) return next(err);
      
      await logActivity(user._id, 'login_success', { email }, req);
      
      // Remember me functionality
      if (req.body.remember) {
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
      }
      
      res.redirect('/');
    });
  })(req, res, next);
});

// Register page
router.get('/register', ensureGuest, (req, res) => {
  res.render('register');
});

// Register handler
router.post('/register', ensureGuest, validateRegistration, async (req, res) => {
  const { email, username, password } = req.body;
  
  try {
    // Check if user exists
    const existingEmail = await User.findByEmail(email);
    if (existingEmail) {
      req.flash('error_msg', 'Email already registered');
      return res.redirect('/auth/register');
    }
    
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      req.flash('error_msg', 'Username already taken');
      return res.redirect('/auth/register');
    }
    
    // Create new user
    const newUser = await User.create({ email, username, password });
    
    await logActivity(newUser._id, 'registration_success', { email, username }, req);
    
    req.flash('success_msg', 'Registration successful! Please log in.');
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Registration error:', error);
    await logActivity(null, 'registration_error', { email, error: error.message }, req);
    req.flash('error_msg', 'Registration failed. Please try again.');
    res.redirect('/auth/register');
  }
});

// Logout
router.get('/logout', (req, res) => {
  const userId = req.user?._id;
  
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    
    if (userId) {
      logActivity(userId, 'logout', {}, req).catch(console.error);
    }
    
    res.redirect('/auth/login');
  });
});

// Forgot password page
router.get('/forgot', ensureGuest, (req, res) => {
  res.render('forgot');
});

// Forgot password handler
router.post('/forgot', ensureGuest, async (req, res) => {
  const { email } = req.body;
  
  try {
    const user = await User.findByEmail(email);
    
    if (!user) {
      // Don't reveal if email exists
      req.flash('success_msg', 'If that email exists, a reset link has been sent.');
      return res.redirect('/auth/forgot');
    }
    
    // Generate reset token
    const token = crypto.randomBytes(20).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour
    
    await User.setResetToken(email, token, expires);
    
    // Send email
    const resetUrl = `${process.env.BASE_URL}/auth/reset/${token}`;
    await sendPasswordResetEmail(email, resetUrl);
    
    await logActivity(user._id, 'password_reset_requested', { email }, req);
    
    req.flash('success_msg', 'If that email exists, a reset link has been sent.');
    res.redirect('/auth/forgot');
  } catch (error) {
    console.error('Password reset error:', error);
    req.flash('error_msg', 'An error occurred. Please try again.');
    res.redirect('/auth/forgot');
  }
});

// Reset password page
router.get('/reset/:token', ensureGuest, async (req, res) => {
  const { token } = req.params;
  
  try {
    const users = await User.findAll();
    const user = users.find(u => 
      u.resetToken === token && 
      u.resetExpires && 
      new Date(u.resetExpires) > new Date()
    );
    
    if (!user) {
      req.flash('error_msg', 'Invalid or expired reset token.');
      return res.redirect('/auth/forgot');
    }
    
    res.render('reset', { token });
  } catch (error) {
    console.error('Reset token validation error:', error);
    req.flash('error_msg', 'An error occurred. Please try again.');
    res.redirect('/auth/forgot');
  }
});

// Reset password handler
router.post('/reset/:token', ensureGuest, validatePasswordChange, async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  
  try {
    const users = await User.findAll();
    const user = users.find(u => 
      u.resetToken === token && 
      u.resetExpires && 
      new Date(u.resetExpires) > new Date()
    );
    
    if (!user) {
      req.flash('error_msg', 'Invalid or expired reset token.');
      return res.redirect('/auth/forgot');
    }
    
    // Update password
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(newPassword, salt);
    
    await User.updateById(user._id, {
      hash,
      resetToken: null,
      resetExpires: null
    });
    
    await logActivity(user._id, 'password_reset_success', {}, req);
    
    req.flash('success_msg', 'Password reset successful! Please log in.');
    res.redirect('/auth/login');
  } catch (error) {
    console.error('Password reset error:', error);
    req.flash('error_msg', 'An error occurred. Please try again.');
    res.redirect('/auth/forgot');
  }
});

module.exports = router;