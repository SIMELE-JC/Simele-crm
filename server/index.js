process.on('uncaughtException', (err) => {
  console.error('CRASH:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (err) => {
  console.error('REJECTION:', err);
});

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { initDB } = require('./db');
const authRouter = require('./routes/auth');
const clientsRouter = require('./routes/clients');
const portalRouter = require('./routes/portal');
const { requireAuth } = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 8080;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Trop de tentatives. Reessayez dans 15 minutes.' }
});

app.use('/api/auth', authLimiter, authRouter);
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/portal', portalRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'SIMELE CRM', timestamp: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

initDB();

app.listen(PORT, '0.0.0.0', () => {
  console.log('SIMELE CRM demarre sur le port ' + PORT);
  console.log('Environnement : ' + (process.env.NODE_ENV || 'development'));
  console.log('Portail client : /api/portal');
});
