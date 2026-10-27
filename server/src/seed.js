require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Book } = require('./models');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.deleteMany({}), Book.deleteMany({})]);
  const hash = await bcrypt.hash('password', 10);
  const [a, b] = await User.create([
    { name: 'Asha', email: 'asha@uni.edu', passwordHash: hash },
    { name: 'Ravi', email: 'ravi@uni.edu', passwordHash: hash },
  ]);
  await Book.create([
    { title: 'Introduction to Algorithms', author: 'Cormen et al.', courseCode: 'CS201', semester: 'Fall 2026', condition: 'good', price: 25, owner: a._id },
    { title: 'Operating System Concepts', author: 'Silberschatz', courseCode: 'CS301', semester: 'Spring 2026', condition: 'fair', price: 0, owner: a._id },
    { title: 'Engineering Mathematics', author: 'K. A. Stroud', courseCode: 'MA101', semester: 'Fall 2026', condition: 'good', price: 10, owner: b._id },
    { title: 'Database System Concepts', author: 'Silberschatz', courseCode: 'CS310', semester: 'Fall 2026', condition: 'new', price: 30, owner: b._id },
  ]);
  console.log('Seeded. Log in as asha@uni.edu or ravi@uni.edu, password: password');
  process.exit(0);
})();
