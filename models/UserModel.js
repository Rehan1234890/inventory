const db = require('../config/db');
const bcrypt = require('bcryptjs');

const User = {
  async create(user) {
    try {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      return db.execute('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [user.name, user.email, hashedPassword, user.role]);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },
  async findByEmail(email) {
    try {
      const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0];
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }
};
module.exports = User;