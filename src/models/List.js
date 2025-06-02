const { db } = require('../config/database');

class List {
  static async create(userId, name) {
    const list = {
      userId,
      name,
      data: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    return new Promise((resolve, reject) => {
      db.lists.insert(list, (err, newList) => {
        if (err) reject(err);
        else resolve(newList);
      });
    });
  }
  
  static async findByUserAndName(userId, name) {
    return new Promise((resolve, reject) => {
      db.lists.findOne({ userId, name }, (err, list) => {
        if (err) reject(err);
        else resolve(list);
      });
    });
  }
  
  static async findByUser(userId) {
    return new Promise((resolve, reject) => {
      db.lists.find({ userId }).sort({ createdAt: 1 }).exec((err, lists) => {
        if (err) reject(err);
        else resolve(lists);
      });
    });
  }
  
  static async update(userId, name, data) {
    return new Promise((resolve, reject) => {
      db.lists.update(
        { userId, name },
        { $set: { data, updatedAt: new Date() } },
        { returnUpdatedDocs: true },
        (err, numUpdated, updatedDoc) => {
          if (err) reject(err);
          else resolve(updatedDoc);
        }
      );
    });
  }
  
  static async rename(userId, oldName, newName) {
    return new Promise((resolve, reject) => {
      db.lists.update(
        { userId, name: oldName },
        { $set: { name: newName, updatedAt: new Date() } },
        { returnUpdatedDocs: true },
        (err, numUpdated, updatedDoc) => {
          if (err) reject(err);
          else resolve(updatedDoc);
        }
      );
    });
  }
  
  static async delete(userId, name) {
    return new Promise((resolve, reject) => {
      db.lists.remove({ userId, name }, {}, (err, numRemoved) => {
        if (err) reject(err);
        else resolve(numRemoved);
      });
    });
  }
  
  static async deleteAllByUser(userId) {
    return new Promise((resolve, reject) => {
      db.lists.remove({ userId }, { multi: true }, (err, numRemoved) => {
        if (err) reject(err);
        else resolve(numRemoved);
      });
    });
  }
  
  static async countByUser(userId) {
    return new Promise((resolve, reject) => {
      db.lists.count({ userId }, (err, count) => {
        if (err) reject(err);
        else resolve(count);
      });
    });
  }
  
  static async getStats() {
    return new Promise((resolve, reject) => {
      db.lists.find({}, (err, lists) => {
        if (err) reject(err);
        else {
          const totalLists = lists.length;
          const totalAlbums = lists.reduce((sum, list) => sum + (list.data?.length || 0), 0);
          resolve({ totalLists, totalAlbums });
        }
      });
    });
  }
}

module.exports = List;