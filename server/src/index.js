require('dotenv').config();
require('express-async-errors'); // lets async route handlers throw into the error middleware
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { router: authRouter } = require('./auth');
const { Book, Request } = require('./models');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/books', require('./books'));
app.use('/api/requests', require('./requests'));

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id.' });
  if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    await Promise.all([Book.syncIndexes(), Request.syncIndexes()]); // make sure indexes exist
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log('API on :' + port));
  })
  .catch((e) => { console.error('Mongo connection failed:', e.message); process.exit(1); });
