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
const usersRouter = require('./routes/users');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow same-origin requests (no Origin header) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin not allowed — add it to ALLOWED_ORIGINS in backend/.env`));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
    }
  }
}));
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
app.use('/api/users', authMiddleware, usersRouter);

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message });
});

app.listen(PORT, () => console.log(`ATC backend running on http://localhost:${PORT}`));
