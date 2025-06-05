const { db, generateId } = require('../config/database');

class List {
  static async create(userId, name) {
    const list = {
      id: generateId(),
      userId,
      name,
      data: '[]',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const stmt = db.prepare(`
      INSERT INTO lists (id, userId, name, data, createdAt, updatedAt)
      VALUES (@id, @userId, @name, @data, @createdAt, @updatedAt)
    `);
    
    try {
      stmt.run(list);
      return { 
        ...list, 
        data: JSON.parse(list.data),
        _id: list.id 
      };
    } catch (error) {
      throw error;
    }
  }
  
  static async findByUserAndName(userId, name) {
    const stmt = db.prepare('SELECT * FROM lists WHERE userId = ? AND name = ?');
    const list = stmt.get(userId, name);
    
    if (list) {
      return {
        ...list,
        data: JSON.parse(list.data),
        _id: list.id
      };
    }
    return null;
  }
  
  static async findByUser(userId) {
    const stmt = db.prepare('SELECT * FROM lists WHERE userId = ? ORDER BY createdAt');
    const lists = stmt.all(userId);
    
    return lists.map(list => ({
      ...list,
      data: JSON.parse(list.data),
      _id: list.id
    }));
  }
  
  static async update(userId, name, data) {
    const stmt = db.prepare(`
      UPDATE lists 
      SET data = ?, updatedAt = ? 
      WHERE userId = ? AND name = ?
    `);
    
    stmt.run(JSON.stringify(data), new Date().toISOString(), userId, name);
    return this.findByUserAndName(userId, name);
  }
  
  static async rename(userId, oldName, newName) {
    const stmt = db.prepare(`
      UPDATE lists 
      SET name = ?, updatedAt = ? 
      WHERE userId = ? AND name = ?
    `);
    
    stmt.run(newName, new Date().toISOString(), userId, oldName);
    return this.findByUserAndName(userId, newName);
  }
  
  static async delete(userId, name) {
    const stmt = db.prepare('DELETE FROM lists WHERE userId = ? AND name = ?');
    const result = stmt.run(userId, name);
    return result.changes;
  }
  
  static async deleteAllByUser(userId) {
    const stmt = db.prepare('DELETE FROM lists WHERE userId = ?');
    const result = stmt.run(userId);
    return result.changes;
  }
  
  static async countByUser(userId) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM lists WHERE userId = ?');
    const result = stmt.get(userId);
    return result.count;
  }

  static countCreatedSince(dateIso) {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM lists WHERE createdAt >= ?');
    const result = stmt.get(dateIso);
    return result.count;
  }
  
  static async getStats() {
    const stmt = db.prepare('SELECT COUNT(*) as totalLists FROM lists');
    const listCount = stmt.get();
    
    // Calculate total albums by parsing JSON data
    const allLists = db.prepare('SELECT data FROM lists').all();
    const totalAlbums = allLists.reduce((sum, list) => {
      const data = JSON.parse(list.data);
      return sum + data.length;
    }, 0);
    
    return { 
      totalLists: listCount.totalLists, 
      totalAlbums 
    };
  }
}

module.exports = List;