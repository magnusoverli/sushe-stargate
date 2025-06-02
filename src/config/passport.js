const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { db } = require('./database');

module.exports = function(passport) {
  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          // Find user by email
          db.users.findOne({ email: email.toLowerCase() }, async (err, user) => {
            if (err) return done(err);
            
            if (!user) {
              return done(null, false, { message: 'Invalid credentials' });
            }

            // Match password
            const isMatch = await bcrypt.compare(password, user.hash);
            
            if (isMatch) {
              return done(null, user);
            } else {
              return done(null, false, { message: 'Invalid credentials' });
            }
          });
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser((id, done) => {
    db.users.findOne({ _id: id }, (err, user) => {
      done(err, user);
    });
  });
};