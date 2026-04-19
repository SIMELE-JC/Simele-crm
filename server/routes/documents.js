const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Répertoire de stockage sur le volume Railway
const BASE_DIR = process.env.DB_PATH
  ? path.join(path.dirname(process.env.DB_PATH), 'documents')
  : '/app/data/documents';
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join(BASE_DIR, 'client_' + req.params.clientId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const safe = Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '_' + safe);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    const ok = ['.pdf','.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.gif','.txt','.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    ok.includes(ext) ? cb(null, true) : cb(new Error('Type non autorisé: ' + ext));
  }
});

// GET liste des documents d'un client
router.get('/client/:clientId', requireAuth, function(req, res) {
  try {
    const docs = db.prepare(
      'SELECT * FROM client_documents WHERE client_id = ? ORDER BY created_at DESC'
    ).all(req.params.clientId);
    res.json(docs);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST upload d'un fichier
router.post('/client/:clientId', requireAuth, upload.single('fichier'), function(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  try {
    const { nom, description, type, visible_client } = req.body;
    const result = db.prepare(
      'INSERT INTO client_documents (client_id, type, nom, description, chemin_stockage, taille, visible_client) VALUES (?,?,?,?,?,?,?)'
    ).run(
      req.params.clientId,
      type || 'document',
      nom || req.file.originalname,
      description || '',
      req.file.path,
      req.file.size,
      visible_client === '0' ? 0 : 1
    );
    res.json({ success: true, doc: db.prepare('SELECT * FROM client_documents WHERE id=?').get(result.lastInsertRowid) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET télécharger un fichier
router.get('/:id/download', requireAuth, function(req, res) {
  try {
    const doc = db.prepare('SELECT * FROM client_documents WHERE id=?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (!fs.existsSync(doc.chemin_stockage)) return res.status(404).json({ error: 'Fichier absent du serveur' });
    res.download(doc.chemin_stockage, doc.nom);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT modifier visibilité ou nom
router.put('/:id', requireAuth, function(req, res) {
  try {
    const { nom, visible_client } = req.body;
    db.prepare('UPDATE client_documents SET nom=?, visible_client=? WHERE id=?')
      .run(nom, visible_client ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE supprimer un document
router.delete('/:id', requireAuth, function(req, res) {
  try {
    const doc = db.prepare('SELECT * FROM client_documents WHERE id=?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    if (doc.chemin_stockage && fs.existsSync(doc.chemin_stockage)) {
      try { fs.unlinkSync(doc.chemin_stockage); } catch(e) {}
    }
    db.prepare('DELETE FROM client_documents WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
