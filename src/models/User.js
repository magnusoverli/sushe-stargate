const { db, generateId } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create(userData) {
    const { email, username, password } = userData;
    
    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);
    
    const user = {
      id: generateId(),
      email: email.toLowerCase(),
      username,
      hash,
      role: null,
      accentColor: '#dc2626',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastSelectedList: null,
      resetToken: null,
      resetExpires: null,
      adminGrantedAt: null
    };
    
    const stmt = db.prepare(`
      INSERT INTO users (id, email, username, hash, role, accentColor, createdAt, updatedAt, lastSelectedList, resetToken, resetExpires, adminGrantedAt)
      VALUES (@id, @email, @username, @hash, @role, @accentColor, @createdAt, @updatedAt, @lastSelectedList, @resetToken, @resetExpires, @adminGrantedAt)
    `);
    
    try {
      stmt.run(user);
      return { ...user, _id: user.id }; // For compatibility
    } catch (error) {
      throw error;
    }
  }
  
  static async findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email.toLowerCase());
    return user ? { ...user, _id: user.id } : null;
  }
  
  static async findByUsername(username) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);
    return user ? { ...user, _id: user.id } : null;
  }
  
  static async findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(id);
    return user ? { ...user, _id: user.id } : null;
  }
  
  static async updateById(id, updates) {
    updates.updatedAt = new Date().toISOString();

    // Convert Date objects to ISO strings and undefined to null
    Object.keys(updates).forEach(key => {
      const value = updates[key];
      if (value instanceof Date) {
        updates[key] = value.toISOString();
      } else if (typeof value === 'undefined') {
        updates[key] = null;
      }
    });

    const fields = Object.keys(updates).map(key => `${key} = @${key}`).join(', ');
    const stmt = db.prepare(`UPDATE users SET ${fields} WHERE id = @id`);

    stmt.run({ ...updates, id });
    return this.findById(id);
  }
  
  static async delete(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(id);
    return result.changes;
  }
  
  static async findAll() {
    const stmt = db.prepare('SELECT * FROM users');
    const users = stmt.all();
    return users.map(user => ({ ...user, _id: user.id }));
  }
  
  static async setResetToken(email, token, expires) {
    const stmt = db.prepare(`
      UPDATE users 
      SET resetToken = ?, resetExpires = ?, updatedAt = ? 
      WHERE email = ?
    `);
    
    // Convert expires to ISO string if it's a Date object
    const expiresStr = expires instanceof Date ? expires.toISOString() : expires;
    
    stmt.run(token, expiresStr, new Date().toISOString(), email.toLowerCase());
    return this.findByEmail(email);
  }

  static countSince(dateIso) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE createdAt >= ?');
    const result = stmt.get(dateIso);
    return result.count;
  }
}

module.exports = User;