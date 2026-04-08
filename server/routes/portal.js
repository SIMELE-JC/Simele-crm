const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const db      = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'simele_secret';

// Middleware auth client portal
function authPortal(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const payload = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    if (payload.type !== 'portal') return res.status(403).json({ error: 'Accès refusé' });
    req.portalUser = payload;
    next();
  } catch(e) {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// ─── POST /api/portal/inscription ───────────────────────────────────────────
// Le client remplit le formulaire depuis le site vitrine
router.post('/inscription', async (req, res) => {
  try {
    const { nom, prenom, email, tel, adresse, date_nais, lieu_nais, situation_fam, projet } = req.body;
    if (!nom || !prenom || !email) return res.status(400).json({ error: 'Champs obligatoires manquants' });

    // Vérifier si email déjà inscrit
    const existing = db.prepare('SELECT id FROM portal_inscriptions WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Un compte avec cet email existe déjà' });

    const result = db.prepare(`
      INSERT INTO portal_inscriptions (nom, prenom, email, tel, adresse, date_nais, lieu_nais, situation_fam, projet, statut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente')
    `).run(nom, prenom, email, tel||'', adresse||'', date_nais||'', lieu_nais||'', situation_fam||'', projet||'');

    res.json({ success: true, message: 'Demande reçue. Vous serez notifié par email lors de la validation.', id: result.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/portal/inscriptions ────────────────────────────────────────────
// Admin : liste des inscriptions en attente
router.get('/inscriptions', (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Non autorisé' });
  try {
    jwt.verify(token.replace('Bearer ',''), JWT_SECRET);
    const list = db.prepare("SELECT * FROM portal_inscriptions ORDER BY created_at DESC").all();
    res.json(list);
  } catch(e) { res.status(401).json({ error: 'Token invalide' }); }
});

// ─── POST /api/portal/valider/:id ────────────────────────────────────────────
// Admin valide une inscription → génère identifiant unique + mot de passe temporaire
router.post('/valider/:id', async (req, res) => {
  const adminToken = req.headers.authorization;
  if (!adminToken) return res.status(401).json({ error: 'Non autorisé' });
  try {
    jwt.verify(adminToken.replace('Bearer ',''), JWT_SECRET);

    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id = ?').get(req.params.id);
    if (!insc) return res.status(404).json({ error: 'Inscription introuvable' });

    // Générer identifiant unique CCS-AAAA-XXXX
    const year = new Date().getFullYear();
    const count = db.prepare("SELECT COUNT(*) as n FROM portal_inscriptions WHERE statut = 'validé'").get().n + 1;
    const identifiant = 'CCS-' + year + '-' + String(count).padStart(4, '0');

    // Mot de passe temporaire
    const tempPassword = Math.random().toString(36).slice(2, 10).toUpperCase();
    const hash = await bcrypt.hash(tempPassword, 10);

    // Créer aussi le client dans le CRM si pas encore fait
    let clientId = insc.client_id;
    if (!clientId) {
      const initials = (insc.prenom[0] + insc.nom[0]).toUpperCase();
      const newClient = db.prepare(`
        INSERT INTO clients (nom, prenom, email, tel, adresse, date_nais, lieu_nais, situation_fam, projet, statut, profil, initials)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Prospect', 'À qualifier', ?)
      `).run(insc.nom, insc.prenom, insc.email, insc.tel, insc.adresse, insc.date_nais, insc.lieu_nais, insc.situation_fam, insc.projet, initials);
      clientId = newClient.lastInsertRowid;
    }

    db.prepare(`
      UPDATE portal_inscriptions
      SET statut = 'validé', identifiant = ?, password_hash = ?, client_id = ?, validated_at = datetime('now')
      WHERE id = ?
    `).run(identifiant, hash, clientId, req.params.id);

    res.json({ success: true, identifiant, tempPassword, message: 'Espace client créé avec succès' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/portal/login ──────────────────────────────────────────────────
// Connexion espace client
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const insc = db.prepare("SELECT * FROM portal_inscriptions WHERE email = ? AND statut = 'validé'").get(email);
    if (!insc) return res.status(401).json({ error: 'Compte introuvable ou non validé' });

    const ok = await bcrypt.compare(password, insc.password_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });

    const token = jwt.sign({ id: insc.id, email: insc.email, identifiant: insc.identifiant, type: 'portal' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, identifiant: insc.identifiant, prenom: insc.prenom, nom: insc.nom });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── GET /api/portal/mon-dossier ─────────────────────────────────────────────
// Client : voir son propre dossier
router.get('/mon-dossier', authPortal, (req, res) => {
  const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id = ?').get(req.portalUser.id);
  const client = insc.client_id ? db.prepare('SELECT * FROM clients WHERE id = ?').get(insc.client_id) : null;
  res.json({ inscription: insc, client });
});

// ─── POST /api/portal/quiz ───────────────────────────────────────────────────
// Sauvegarder résultat du quiz
router.post('/quiz', authPortal, (req, res) => {
  try {
    const { reponses, score, profil, recommandations } = req.body;
    db.prepare(`
      INSERT OR REPLACE INTO quiz_resultats (inscription_id, reponses, score, profil, recommandations)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.portalUser.id, JSON.stringify(reponses), score, profil, recommandations);

    // Mettre à jour le profil dans le CRM aussi
    const insc = db.prepare('SELECT client_id FROM portal_inscriptions WHERE id = ?').get(req.portalUser.id);
    if (insc && insc.client_id) {
      db.prepare('UPDATE clients SET score = ?, profil = ? WHERE id = ?').run(score, profil, insc.client_id);
    }

    res.json({ success: true, score, profil, recommandations });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── POST /api/portal/commande ───────────────────────────────────────────────
// Client passe une commande
router.post('/commande', authPortal, (req, res) => {
  try {
    const { offres, total, methode_paiement } = req.body;
    db.prepare(`
      INSERT INTO commandes (inscription_id, offres, total, methode_paiement)
      VALUES (?, ?, ?, ?)
    `).run(req.portalUser.id, JSON.stringify(offres), total, methode_paiement);
    res.json({ success: true, message: 'Commande enregistrée. Nous vous contacterons pour finaliser.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;