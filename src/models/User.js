const { db } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { email, username, password } = userData;
    
    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);
    
    const user = {
      email: email.toLowerCase(),
      username,
      hash,
      role: undefined,
      accentColor: '#dc2626',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSelectedList: null
    };
    
    return new Promise((resolve, reject) => {
      db.users.insert(user, (err, newUser) => {
        if (err) reject(err);
        else resolve(newUser);
      });
    });
  }
  
  static async findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.users.findOne({ email: email.toLowerCase() }, (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });
  }
  
  static async findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.users.findOne({ username }, (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });
  }
  
  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.users.findOne({ _id: id }, (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });
  }
  
  static async updateById(id, updates) {
    updates.updatedAt = new Date();
    
    return new Promise((resolve, reject) => {
      db.users.update(
        { _id: id },
        { $set: updates },
        { returnUpdatedDocs: true },
        (err, numUpdated, updatedDoc) => {
          if (err) reject(err);
          else resolve(updatedDoc);
        }
      );
    });
  }
  
  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.users.remove({ _id: id }, {}, (err, numRemoved) => {
        if (err) reject(err);
        else resolve(numRemoved);
      });
    });
  }
  
  static async findAll() {
    return new Promise((resolve, reject) => {
      db.users.find({}, (err, users) => {
        if (err) reject(err);
        else resolve(users);
      });
    });
  }
  
  static async setResetToken(email, token, expires) {
    return new Promise((resolve, reject) => {
      db.users.update(
        { email: email.toLowerCase() },
        { 
          $set: { 
            resetToken: token,
            resetExpires: expires,
            updatedAt: new Date()
          } 
        },
        { returnUpdatedDocs: true },
        (err, numUpdated, updatedDoc) => {
          if (err) reject(err);
          else resolve(updatedDoc);
        }
      );
    });
  }
}

module.exports = User;