const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'simele_secret_dev_changeme';

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant. Veuillez vous connecter.' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
  }
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nom: user.nom, prenom: user.prenom, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

module.exports = { requireAuth, signToken };
