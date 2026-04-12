const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');

const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'simele_secret_dev_changeme';

function requireAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Token admin manquant' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.type === 'portal') return res.status(403).json({ error: 'Acces reserve admin' });
    req.adminUser = payload;
    next();
  } catch (e) { return res.status(401).json({ error: 'Session expiree' }); }
}

function requirePortal(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autorise' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.type !== 'portal') return res.status(403).json({ error: 'Token client requis' });
    req.portalUser = payload;
    next();
  } catch (e) { return res.status(401).json({ error: 'Token invalide' }); }
}

router.post('/inscription', (req, res) => {
  try {
    const { nom, prenom, email, tel, adresse, date_nais, lieu_nais, situation_fam, projet, prestation } = req.body;
    if (!nom || !prenom || !email) return res.status(400).json({ error: 'Nom, prenom et email obligatoires' });
    const existing = db.prepare('SELECT id FROM portal_inscriptions WHERE email=?').get(email.trim().toLowerCase());
    if (existing) return res.status(409).json({ error: 'Un compte avec cet email existe deja' });
    const result = db.prepare("INSERT INTO portal_inscriptions (nom,prenom,email,tel,adresse,date_nais,lieu_nais,situation_fam,projet,prestation,statut) VALUES (?,?,?,?,?,?,?,?,?,?,'en_attente')")
      .run(nom.trim(), prenom.trim(), email.trim().toLowerCase(), tel||'', adresse||'', date_nais||'', lieu_nais||'', situation_fam||'', projet||'', prestation||'');
    res.json({ success: true, message: 'Demande recue. Le cabinet vous contactera sous 48h.', id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
    const insc = db.prepare("SELECT * FROM portal_inscriptions WHERE email=? AND statut='valide'").get(email.trim().toLowerCase());
    if (!insc) return res.status(401).json({ error: 'Compte introuvable ou pas encore valide' });
    const ok = await bcrypt.compare(password, insc.password_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = jwt.sign({ id: insc.id, email: insc.email, identifiant: insc.identifiant, type: 'portal' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, identifiant: insc.identifiant, prenom: insc.prenom, nom: insc.nom });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/inscriptions', requireAdmin, (req, res) => {
  try {
    const { statut } = req.query;
    let q = 'SELECT * FROM portal_inscriptions';
    const p = [];
    if (statut) { q += ' WHERE statut=?'; p.push(statut); }
    q += ' ORDER BY created_at DESC';
    const list = db.prepare(q).all(...p);
    res.json({ inscriptions: list, total: list.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/inscriptions/:id', requireAdmin, (req, res) => {
  try {
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.params.id);
    if (!insc) return res.status(404).json({ error: 'Introuvable' });
    const client = insc.client_id ? db.prepare('SELECT * FROM clients WHERE id=?').get(insc.client_id) : null;
    res.json({ inscription: insc, client });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/valider/:id', requireAdmin, async (req, res) => {
  try {
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.params.id);
    if (!insc) return res.status(404).json({ error: 'Inscription introuvable' });
    if (insc.statut === 'valide') return res.status(400).json({ error: 'Deja validee' });
    const year = new Date().getFullYear();
    const n = db.prepare("SELECT COUNT(*) as n FROM portal_inscriptions WHERE statut='valide'").get().n;
    const identifiant = 'CCS-' + year + '-' + String(n + 1).padStart(4, '0');
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let tempPassword = '';
    for (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];
    const hash = await bcrypt.hash(tempPassword, 10);
    let clientId = insc.client_id;
    if (!clientId) {
      const initials = ((insc.prenom[0]||'')+(insc.nom[0]||'')).toUpperCase();
      const COLORS = ['#D6EAF8','#D4EDDA','#FDEBD0','#E8D5F5','#FADBD8'];
      const TXTS   = ['#1a5f8a','#1e8449','#8a5e05','#6c3483','#C0392B'];
      const ci = n % COLORS.length;
      const r = db.prepare("INSERT INTO clients (nom,prenom,email,tel,adresse,date_nais,lieu_nais,situation_fam,projet,statut,profil,initials,color,text_color) VALUES (?,?,?,?,?,?,?,?,?,'Prospect','A qualifier',?,?,?)")
        .run(insc.nom,insc.prenom,insc.email,insc.tel,insc.adresse,insc.date_nais,insc.lieu_nais,insc.situation_fam,insc.projet,initials,COLORS[ci],TXTS[ci]);
      clientId = r.lastInsertRowid;
    }
    db.prepare("UPDATE portal_inscriptions SET statut='valide',identifiant=?,password_hash=?,client_id=?,validated_at=datetime('now') WHERE id=?")
      .run(identifiant, hash, clientId, req.params.id);
    res.json({ success: true, identifiant, tempPassword, client_id: clientId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/rejeter/:id', requireAdmin, (req, res) => {
  try {
    const { motif } = req.body;
    db.prepare("UPDATE portal_inscriptions SET statut='rejete',notes_admin=?,rejected_at=datetime('now') WHERE id=?").run(motif||'', req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/clients/:clientId/documents', requireAdmin, (req, res) => {
  try {
    const docs = db.prepare('SELECT * FROM client_documents WHERE client_id=? ORDER BY updated_at DESC').all(req.params.clientId);
    res.json({ documents: docs, total: docs.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/clients/:clientId/documents', requireAdmin, (req, res) => {
  try {
    const { nom, type, description, contenu_base64, visible_client } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom requis' });
    const clientId = req.params.clientId;
    const client = db.prepare('SELECT id FROM clients WHERE id=?').get(clientId);
    if (!client) return res.status(404).json({ error: 'Client introuvable' });
    const insc = db.prepare('SELECT id FROM portal_inscriptions WHERE client_id=?').get(clientId);
    let cheminStockage = '', taille = 0;
    if (contenu_base64) {
      const DOCS_PATH = process.env.DOCS_PATH || path.join(__dirname, '../../data/documents');
      const dir = path.join(DOCS_PATH, String(clientId));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = Date.now() + '_' + nom.replace(/[^a-zA-Z0-9._-]/g, '_');
      const buf = Buffer.from(contenu_base64, 'base64');
      cheminStockage = path.join(dir, filename);
      fs.writeFileSync(cheminStockage, buf);
      taille = buf.length;
    }
    const r = db.prepare("INSERT INTO client_documents (client_id,inscription_id,nom,type,description,chemin_stockage,taille,version,visible_client,created_by,updated_by) VALUES (?,?,?,?,?,?,?,1,?,?,?)")
      .run(clientId, insc?insc.id:null, nom, type||'document', description||'', cheminStockage, taille, visible_client!==false?1:0, req.adminUser.id, req.adminUser.id);
    res.status(201).json({ success: true, document: db.prepare('SELECT * FROM client_documents WHERE id=?').get(r.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/documents/:id', requireAdmin, (req, res) => {
  try {
    const { nom, description, contenu_base64, visible_client } = req.body;
    const doc = db.prepare('SELECT * FROM client_documents WHERE id=?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    db.prepare('INSERT INTO document_versions (document_id,version,chemin_stockage,created_by) VALUES (?,?,?,?)').run(doc.id, doc.version, doc.chemin_stockage, req.adminUser.id);
    const newVer = doc.version + 1;
    let cheminStockage = doc.chemin_stockage, taille = doc.taille;
    if (contenu_base64) {
      const DOCS_PATH = process.env.DOCS_PATH || path.join(__dirname, '../../data/documents');
      const dir = path.join(DOCS_PATH, String(doc.client_id));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const buf = Buffer.from(contenu_base64, 'base64');
      cheminStockage = path.join(dir, Date.now() + '_v' + newVer + '_' + (nom||doc.nom).replace(/[^a-zA-Z0-9._-]/g, '_'));
      fs.writeFileSync(cheminStockage, buf);
      taille = buf.length;
    }
    db.prepare("UPDATE client_documents SET nom=?,description=?,chemin_stockage=?,taille=?,version=?,visible_client=?,updated_at=datetime('now'),updated_by=? WHERE id=?")
      .run(nom||doc.nom, description!==undefined?description:doc.description, cheminStockage, taille, newVer, visible_client!==undefined?(visible_client?1:0):doc.visible_client, req.adminUser.id, doc.id);
    res.json({ success: true, document: db.prepare('SELECT * FROM client_documents WHERE id=?').get(doc.id), version: newVer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/documents/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM client_documents WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', requireAdmin, (req, res) => {
  try {
    const total     = db.prepare('SELECT COUNT(*) as n FROM portal_inscriptions').get().n;
    const enAttente = db.prepare("SELECT COUNT(*) as n FROM portal_inscriptions WHERE statut='en_attente'").get().n;
    const valides   = db.prepare("SELECT COUNT(*) as n FROM portal_inscriptions WHERE statut='valide'").get().n;
    const rejetes   = db.prepare("SELECT COUNT(*) as n FROM portal_inscriptions WHERE statut='rejete'").get().n;
    res.json({ total, en_attente: enAttente, valides, rejetes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/mon-dossier', requirePortal, (req, res) => {
  try {
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.status(404).json({ error: 'Dossier introuvable' });
    const client = insc.client_id ? db.prepare('SELECT id,nom,prenom,email,tel,projet,prestation,score,profil,statut FROM clients WHERE id=?').get(insc.client_id) : null;
    const { password_hash, ...safeInsc } = insc;
    res.json({ inscription: safeInsc, client });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/mes-documents', requirePortal, (req, res) => {
  try {
    const insc = db.prepare('SELECT client_id FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc || !insc.client_id) return res.json({ documents: [] });
    const docs = db.prepare('SELECT id,nom,type,description,taille,version,created_at,updated_at FROM client_documents WHERE client_id=? AND visible_client=1 ORDER BY updated_at DESC').all(insc.client_id);
    res.json({ documents: docs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/quiz', requirePortal, (req, res) => {
  try {
    const { reponses, score, profil, recommandations } = req.body;
    db.prepare('INSERT OR REPLACE INTO quiz_resultats (inscription_id,reponses,score,profil,recommandations) VALUES (?,?,?,?,?)')
      .run(req.portalUser.id, JSON.stringify(reponses||{}), score||0, profil||'', recommandations||'');
    const insc = db.prepare('SELECT client_id FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (insc && insc.client_id) db.prepare('UPDATE clients SET score=?,profil=? WHERE id=?').run(score||0, profil||'A qualifier', insc.client_id);
    res.json({ success: true, score, profil, recommandations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/commande', requirePortal, (req, res) => {
  try {
    const { offres, total, methode_paiement } = req.body;
    db.prepare("INSERT INTO commandes (inscription_id,offres,total,methode_paiement,statut) VALUES (?,?,?,?,'en_attente')")
      .run(req.portalUser.id, JSON.stringify(offres||[]), total||0, methode_paiement||'');
    res.json({ success: true, message: 'Commande enregistree. Nous vous contacterons sous 24h.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
