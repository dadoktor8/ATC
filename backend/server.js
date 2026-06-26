require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('express-async-errors');
require('./db/schema');

const { authMiddleware, adminOnly } = require('./middleware/auth');
const studentsRouter = require('./routes/students');
const marksRouter = require('./routes/marks');
const generateRouter = require('./routes/generate');
const authRouter = require('./routes/auth');
const centersRouter = require('./routes/centers');
const batchesRouter = require('./routes/batches');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, ngrok-skip-browser-warning');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({ 
  windowMs: 60 * 1000, 
  max: 200,
  validate: { xForwardedForHeader: false }
});
app.use('/api', apiLimiter);

app.use('/api/auth', authRouter);
app.use('/api/students', authMiddleware, studentsRouter);
app.use('/api/marks', authMiddleware, marksRouter);
app.use('/api/generate', authMiddleware, generateRouter);
app.use('/api/centers', authMiddleware, centersRouter);
app.use('/api/batches', authMiddleware, batchesRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

app.listen(PORT, () => console.log(`ATC backend running on http://localhost:${PORT}`));
