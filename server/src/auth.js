const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = require('express').Router();
const { User } = require('./models');

const sign = (u) => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const pub = (u) => ({ id: u._id, name: u.name, email: u.email });

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    req.userId = jwt.verify(h.replace('Bearer ', ''), process.env.JWT_SECRET).id;
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in first.' });
  }
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required.' });
  if (await User.exists({ email: email.toLowerCase() }))
    return res.status(409).json({ error: 'That email is already registered.' });
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(user), user: pub(user) });
});

router.post('/login', async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash)))
    return res.status(401).json({ error: 'Wrong email or password.' });
  res.json({ token: sign(user), user: pub(user) });
});

module.exports = { router, requireAuth };
