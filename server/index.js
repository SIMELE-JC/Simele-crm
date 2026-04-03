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
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Sécurité ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false // on gère ça manuellement si besoin
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

app.use(express.json());
app.use(morgan('dev'));

// Rate limiting sur les routes auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' }
});

// ── Routes API ────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/clients', requireAuth, clientsRouter);

// Route santé Railway
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'SIMELE CRM', timestamp: new Date().toISOString() });
});

// ── Frontend statique ─────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// SPA fallback : toutes les routes non-API → index.html
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  }
});

// ── Démarrage ─────────────────────────────────────────────
initDB();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SIMELE CRM démarré sur le port ${PORT}`);
  console.log(`🌐 Environnement : ${process.env.NODE_ENV || 'development'}`);
});
