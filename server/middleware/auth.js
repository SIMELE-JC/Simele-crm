const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'simele_secret_dev_changeme';

fonction requireAuth(req, res, next) {
  const en-tête = req.headers.authorization;
  si (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant. Veuillez vous connecter.' });
  }
  essayer {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = payload;
    suivant();
  } attraper (erreur) {
    return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
  }
}

fonction signToken(utilisateur) {
  retourner jwt.sign(
    { id : user.id, email : user.email, nom : user.nom, prenom : user.prenom, role : user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

module.exports = { requireAuth, signToken };
