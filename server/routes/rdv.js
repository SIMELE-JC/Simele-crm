const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

// GET tous les RDV d'un client
router.get('/client/:clientId', requireAuth, function(req, res) {
  try {
    const rdvs = db.prepare('SELECT * FROM rendez_vous WHERE client_id = ? ORDER BY date_rdv, heure_rdv').all(req.params.clientId);
    res.json(rdvs);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST créer un RDV
router.post('/', requireAuth, function(req, res) {
  try {
    const { client_id, date_rdv, heure_rdv, objet, lieu, notes, statut } = req.body;
    if (!client_id || !date_rdv || !heure_rdv || !objet) return res.status(400).json({ error: 'Champs obligatoires manquants' });
    const result = db.prepare(
      'INSERT INTO rendez_vous (client_id, date_rdv, heure_rdv, objet, lieu, notes, statut) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(client_id, date_rdv, heure_rdv, objet, lieu || 'En ligne', notes || '', statut || 'confirme');
    const rdv = db.prepare('SELECT * FROM rendez_vous WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, rdv });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// PUT modifier un RDV
router.put('/:id', requireAuth, function(req, res) {
  try {
    const { date_rdv, heure_rdv, objet, lieu, notes, statut } = req.body;
    db.prepare(
      'UPDATE rendez_vous SET date_rdv=?, heure_rdv=?, objet=?, lieu=?, notes=?, statut=? WHERE id=?'
    ).run(date_rdv, heure_rdv, objet, lieu || 'En ligne', notes || '', statut || 'confirme', req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// DELETE supprimer un RDV
router.delete('/:id', requireAuth, function(req, res) {
  try {
    db.prepare('DELETE FROM rendez_vous WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
