const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, email: user.email, nom: user.nom, prenom: user.prenom, role: user.role }
  });
});

// GET /api/auth/me — vérifier que le token est encore valide
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Champs manquants.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(currentPassword, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Mot de passe actuel incorrect.' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Mot de passe modifié avec succès.' });
});

module.exports = router;
