const { countries, genres } = require('./utils/helpers');
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const passport = require('passport');
const flash = require('connect-flash');
const multer = require('multer');
const expressLayouts = require('express-ejs-layouts');

// Import configurations
const { initializeDatabase } = require('./config/database');
const configurePassport = require('./config/passport');
const { sessionConfig } = require('./config/session');

// Import middleware
const { activityLogger } = require('./middleware/activity');

// Import routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const pageRoutes = require('./routes/pages');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initializeDatabase();

// Configure view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Use express-ejs-layouts
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session(sessionConfig));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());
configurePassport(passport);

// Flash messages
app.use(flash());

// Activity logging middleware
app.use(activityLogger);

// Global variables middleware
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated();
  
  // Add countries and genres globally
  res.locals.countries = countries;
  res.locals.genres = genres;
  
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);
app.use('/', pageRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`SuShe Stargate running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});