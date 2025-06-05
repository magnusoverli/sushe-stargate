const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../models/User');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          // Use the User model instead of direct db access
          const user = await User.findByEmail(email);

          if (!user) {
            return done(null, false, { message: 'Email not found' });
          }

          // Match password
          const isMatch = await bcrypt.compare(password, user.hash);

          if (isMatch) {
            return done(null, user);
          } else {
            return done(null, false, { message: 'Incorrect password' });
          }
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user._id || user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};