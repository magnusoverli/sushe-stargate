const validateRegistration = (req, res, next) => {
  const { email, username, password, confirmPassword } = req.body;
  const errors = [];

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('Please provide a valid email address');
  }

  // Username validation
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!username || !usernameRegex.test(username)) {
    errors.push('Username must be 3-30 characters and contain only letters, numbers, and underscores');
  }

  // Password validation
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (errors.length > 0) {
    req.flash('error_msg', errors.join(', '));
    return res.redirect('/auth/register');
  }

  next();
};

const validatePasswordChange = (req, res, next) => {
  const { newPassword, confirmPassword } = req.body;
  
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ 
      success: false, 
      message: 'Password must be at least 8 characters long' 
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ 
      success: false, 
      message: 'Passwords do not match' 
    });
  }

  next();
};

module.exports = {
  validateRegistration,
  validatePasswordChange
};