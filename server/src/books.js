const router = require('express').Router();
const { Book, Request, normCourse } = require('./models');
const { requireAuth } = require('./auth');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/books?q=&course=&semester=&page=   (public)
router.get('/', async (req, res) => {
  const { q, course, semester } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 12;
  const filter = { status: 'available' };
  if (course) filter.courseCode = new RegExp('^' + esc(normCourse(course))); // anchored prefix -> index scan
  if (semester) filter.semester = semester;

  let query;
  if (q && q.trim()) {
    filter.$text = { $search: q.trim() };
    query = Book.find(filter, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } });
  } else {
    query = Book.find(filter).sort({ createdAt: -1 });
  }
  const [books, total] = await Promise.all([
    query.skip((page - 1) * limit).limit(limit).populate('owner', 'name').lean(),
    Book.countDocuments(filter),
  ]);
  res.json({ books, total, pages: Math.ceil(total / limit) });
});

// Values for the filter dropdowns / course autocomplete
router.get('/facets', async (_req, res) => {
  const [courses, semesters] = await Promise.all([
    Book.distinct('courseCode', { status: 'available' }),
    Book.distinct('semester', { status: 'available' }),
  ]);
  res.json({ courses: courses.sort(), semesters: semesters.sort().reverse() });
});

router.get('/mine', requireAuth, async (req, res) => {
  res.json(await Book.find({ owner: req.userId }).sort({ createdAt: -1 }).lean());
});

router.post('/', requireAuth, async (req, res) => {
  const { title, author, courseCode, semester, condition, price, description } = req.body;
  if (!title || !courseCode || !semester)
    return res.status(400).json({ error: 'Title, course code and semester are required.' });
  const book = await Book.create({
    title, author, semester, condition, price, description,
    courseCode: normCourse(courseCode), owner: req.userId,
  });
  res.status(201).json(book);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const book = await Book.findOne({ _id: req.params.id, owner: req.userId });
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  if (book.status === 'reserved')
    return res.status(409).json({ error: 'This book is reserved. Mark it exchanged first.' });
  await Promise.all([book.deleteOne(), Request.updateMany({ book: book._id, status: 'pending' }, { status: 'cancelled' })]);
  res.json({ ok: true });
});

// Owner confirms the hand-off happened
router.post('/:id/complete', requireAuth, async (req, res) => {
  const book = await Book.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId, status: 'reserved' }, { status: 'exchanged' }, { new: true });
  if (!book) return res.status(409).json({ error: 'Only reserved books can be marked exchanged.' });
  res.json(book);
});

// Student requests a book
router.post('/:id/requests', requireAuth, async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book || book.status !== 'available') return res.status(409).json({ error: 'This book is no longer available.' });
  if (String(book.owner) === req.userId) return res.status(400).json({ error: "You can't request your own book." });
  try {
    const r = await Request.create({
      book: book._id, owner: book.owner, requester: req.userId, message: (req.body.message || '').slice(0, 500),
    });
    res.status(201).json(r);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'You already have a pending request for this book.' });
    throw e;
  }
});

module.exports = router;
