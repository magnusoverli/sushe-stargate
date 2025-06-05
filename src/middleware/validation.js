const validateRegistration = (req, res, next) => {
  const { email, username, password, confirmPassword } = req.body;
  const errors = [];

  // Email validation - just check it looks like an email
  if (!email || !email.includes('@')) {
    errors.push('Please provide a valid email address');
  }

  // Username validation - just length
  if (!username || username.length < 3) {
    errors.push('Username must be at least 3 characters');
  }

  // Password validation - just minimum length
  if (!password || password.length < 4) {
    errors.push('Password must be at least 4 characters long');
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
  
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ 
      success: false, 
      message: 'Password must be at least 4 characters long' 
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

const validatePasswordResetForm = (req, res, next) => {
  const { newPassword, confirmPassword } = req.body;
  const errors = [];

  if (!newPassword || newPassword.length < 4) {
    errors.push('Password must be at least 4 characters long');
  }

  if (newPassword !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (errors.length > 0) {
    req.flash('error_msg', errors.join(', '));
    return res.redirect(`/auth/reset/${req.params.token}`);
  }

  next();
};

module.exports = {
  validateRegistration,
  validatePasswordChange,
  validatePasswordResetForm
};