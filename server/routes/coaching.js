const express = require('express');
const { db } = require('../db');
const router = express.Router();

// GET /api/coaching/:clientId - Toutes les séances d'un client
router.get('/:clientId', (req, res) => {
  try {
    const sessions = db.prepare(
      'SELECT * FROM coaching_sessions WHERE client_id = ? ORDER BY seance_number ASC'
    ).all(req.params.clientId);
    res.json({ sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/coaching/:clientId/seance/:num - Créer ou mettre à jour une séance
router.post('/:clientId/seance/:num', (req, res) => {
  try {
    const { clientId, num } = req.params;
    const {
      statut, bloc1, bloc2, bloc3, bloc4, bloc5,
      synthese_points_cles, synthese_risques, synthese_opportunites,
      synthese_prochaines_etapes, checklists
    } = req.body;

    const existing = db.prepare(
      'SELECT id FROM coaching_sessions WHERE client_id = ? AND seance_number = ?'
    ).get(clientId, num);

    const toJson = (v) => JSON.stringify(v || {});
    const now = "datetime('now')";

    if (existing) {
      db.prepare(`UPDATE coaching_sessions SET
        statut = ?, bloc1 = ?, bloc2 = ?, bloc3 = ?, bloc4 = ?, bloc5 = ?,
        synthese_points_cles = ?, synthese_risques = ?, synthese_opportunites = ?,
        synthese_prochaines_etapes = ?, checklists = ?, updated_at = datetime('now')
        WHERE client_id = ? AND seance_number = ?`).run(
        statut || 'en_cours',
        toJson(bloc1), toJson(bloc2), toJson(bloc3), toJson(bloc4), toJson(bloc5),
        synthese_points_cles || '', synthese_risques || '',
        synthese_opportunites || '', synthese_prochaines_etapes || '',
        toJson(checklists), clientId, num
      );
    } else {
      db.prepare(`INSERT INTO coaching_sessions
        (client_id, seance_number, statut, bloc1, bloc2, bloc3, bloc4, bloc5,
         synthese_points_cles, synthese_risques, synthese_opportunites,
         synthese_prochaines_etapes, checklists)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        clientId, num, statut || 'en_cours',
        toJson(bloc1), toJson(bloc2), toJson(bloc3), toJson(bloc4), toJson(bloc5),
        synthese_points_cles || '', synthese_risques || '',
        synthese_opportunites || '', synthese_prochaines_etapes || '',
        toJson(checklists)
      );
    }

    const session = db.prepare(
      'SELECT * FROM coaching_sessions WHERE client_id = ? AND seance_number = ?'
    ).get(clientId, num);
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
