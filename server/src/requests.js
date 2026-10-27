const router = require('express').Router();
const { Book, Request } = require('./models');
const { requireAuth } = require('./auth');
router.use(requireAuth);

const bookFields = 'title author courseCode semester status';

// Requests other students sent for MY books
router.get('/incoming', async (req, res) => {
  const list = await Request.find({ owner: req.userId })
    .sort({ createdAt: -1 }).populate('book', bookFields).populate('requester', 'name email').lean();
  // requester email is only shared once the request is accepted
  res.json(list.map((r) => (r.status === 'accepted' ? r : { ...r, requester: { _id: r.requester._id, name: r.requester.name } })));
});

// Requests I sent
router.get('/outgoing', async (req, res) => {
  const list = await Request.find({ requester: req.userId })
    .sort({ createdAt: -1 }).populate('book', bookFields).populate('owner', 'name email').lean();
  res.json(list.map((r) => (r.status === 'accepted' ? r : { ...r, owner: { _id: r.owner._id, name: r.owner.name } })));
});

// Accept: atomically reserve the book, then reject competing requests
router.post('/:id/accept', async (req, res) => {
  const r = await Request.findOne({ _id: req.params.id, owner: req.userId, status: 'pending' });
  if (!r) return res.status(404).json({ error: 'Pending request not found.' });
  const book = await Book.findOneAndUpdate(
    { _id: r.book, owner: req.userId, status: 'available' },
    { status: 'reserved', reservedFor: r.requester });
  if (!book) return res.status(409).json({ error: 'This book has already been reserved.' });
  r.status = 'accepted';
  await r.save();
  await Request.updateMany({ book: r.book, status: 'pending', _id: { $ne: r._id } }, { status: 'rejected' });
  res.json(r);
});

router.post('/:id/reject', async (req, res) => {
  const r = await Request.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId, status: 'pending' }, { status: 'rejected' }, { new: true });
  if (!r) return res.status(404).json({ error: 'Pending request not found.' });
  res.json(r);
});

// Requester withdraws; if it was already accepted the book goes back on the shelf
router.post('/:id/cancel', async (req, res) => {
  const r = await Request.findOne({ _id: req.params.id, requester: req.userId, status: { $in: ['pending', 'accepted'] } });
  if (!r) return res.status(404).json({ error: 'Request not found.' });
  if (r.status === 'accepted')
    await Book.updateOne({ _id: r.book, status: 'reserved' }, { status: 'available', reservedFor: null });
  r.status = 'cancelled';
  await r.save();
  res.json(r);
});

module.exports = router;
