const mongoose = require('mongoose');
const { Schema } = mongoose;
const { ObjectId } = Schema.Types;

// "cs 101" / "CS-101" -> "CS101" so searches and indexes behave consistently
const normCourse = (v) => String(v || '').toUpperCase().replace(/[\s-]/g, '');

const User = mongoose.model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
}, { timestamps: true }));

const bookSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 150 },
  author: { type: String, trim: true, default: '' },
  courseCode: { type: String, required: true },
  semester: { type: String, required: true },           // e.g. "Fall 2026"
  condition: { type: String, enum: ['new', 'good', 'fair', 'worn'], default: 'good' },
  price: { type: Number, min: 0, default: 0 },          // 0 = free
  description: { type: String, maxlength: 1000, default: '' },
  owner: { type: ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['available', 'reserved', 'exchanged'], default: 'available' },
  reservedFor: { type: ObjectId, ref: 'User', default: null },
}, { timestamps: true });

// Full-text search: title matters most, then course code, author, description
bookSchema.index(
  { title: 'text', courseCode: 'text', author: 'text', description: 'text' },
  { weights: { title: 10, courseCode: 6, author: 3, description: 1 }, name: 'book_text' }
);
// Course-code browsing (prefix regex "^CS1" uses this) + semester filter
bookSchema.index({ courseCode: 1, semester: 1, status: 1 });
bookSchema.index({ status: 1, createdAt: -1 });
bookSchema.index({ owner: 1, createdAt: -1 });

const Book = mongoose.model('Book', bookSchema);

const requestSchema = new Schema({
  book: { type: ObjectId, ref: 'Book', required: true },
  owner: { type: ObjectId, ref: 'User', required: true },
  requester: { type: ObjectId, ref: 'User', required: true },
  message: { type: String, maxlength: 500, default: '' },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'cancelled'], default: 'pending' },
}, { timestamps: true });

// One live request per student per book
requestSchema.index({ book: 1, requester: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
requestSchema.index({ owner: 1, status: 1, createdAt: -1 });
requestSchema.index({ requester: 1, createdAt: -1 });

const Request = mongoose.model('Request', requestSchema);

module.exports = { User, Book, Request, normCourse };
