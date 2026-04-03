const express = require('express');
const { db } = require('../db');

const router = express.Router();

// ── Utilitaires ───────────────────────────────────────────
const COLORS = [
  {bg:'#D6EAF8',txt:'#1a5f8a'},{bg:'#D4EDDA',txt:'#1e8449'},
  {bg:'#FDEBD0',txt:'#8a5e05'},{bg:'#E8D5F5',txt:'#6c3483'},
  {bg:'#FADBD8',txt:'#C0392B'},{bg:'#D5F5E3',txt:'#1d6a3e'},
  {bg:'#FEF9E7',txt:'#7d6608'},{bg:'#EBF5FB',txt:'#1a5276'},
];

function getColor(index) {
  return COLORS[index % COLORS.length];
}

function getInitials(prenom, nom) {
  return ((prenom||'')[0]||'?').toUpperCase() + ((nom||'')[0]||'?').toUpperCase();
}

// ── GET /api/clients ──────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { search, profil } = req.query;
    let query = 'SELECT * FROM clients WHERE 1=1';
    const params = [];

    if (search) {
      query += ' AND (nom LIKE ? OR prenom LIKE ? OR email LIKE ? OR prestation LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    if (profil) {
      query += ' AND profil = ?';
      params.push(profil);
    }

    query += ' ORDER BY created_at DESC';
    const clients = db.prepare(query).all(...params);
    res.json({ clients, total: clients.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── GET /api/clients/:id ──────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client non trouvé.' });

    // Récupérer le dernier entretien
    const entretien = db.prepare(
      'SELECT * FROM entretiens WHERE client_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(client.id);

    // Récupérer les documents
    const documents = db.prepare(
      'SELECT * FROM documents WHERE client_id = ? ORDER BY created_at DESC'
    ).all(client.id);

    res.json({ client, entretien: entretien || null, documents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── POST /api/clients ─────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { nom, prenom, email, tel, adresse, date_nais, lieu_nais, situation_fam, statut, prestation, projet, notes } = req.body;
    if (!nom || !prenom) {
      return res.status(400).json({ error: 'Nom et prénom requis.' });
    }

    // Couleur auto basée sur le nb de clients existants
    const count = db.prepare('SELECT COUNT(*) as n FROM clients').get();
    const cl = getColor(count.n);
    const initials = getInitials(prenom, nom);

    const result = db.prepare(`
      INSERT INTO clients
        (nom, prenom, email, tel, adresse, date_nais, lieu_nais, situation_fam,
         statut, prestation, projet, notes, color, text_color, initials, created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      nom.trim(), prenom.trim(), email||'', tel||'',
      adresse||'', date_nais||'', lieu_nais||'', situation_fam||'',
      statut||'', prestation||'', projet||'', notes||'',
      cl.bg, cl.txt, initials, req.user.id
    );

    const newClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ client: newClient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── PUT /api/clients/:id ──────────────────────────────────
router.put('/:id', (req, res) => {
  try {
    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client non trouvé.' });

    const fields = ['nom','prenom','email','tel','adresse','date_nais','lieu_nais',
                    'situation_fam','statut','prestation','projet','notes','profil','score'];
    const updates = [];
    const values = [];

    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour.' });
    }

    updates.push('updated_at = datetime(\'now\')');
    values.push(req.params.id);

    db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    res.json({ client: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── DELETE /api/clients/:id ───────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client non trouvé.' });

    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    res.json({ message: `Dossier de ${client.prenom} ${client.nom} supprimé.`, id: client.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── POST /api/clients/:id/entretien ──────────────────────
router.post('/:id/entretien', (req, res) => {
  try {
    const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client non trouvé.' });

    const {
      score_total, score_clarte, score_faisabilite, score_motivation, score_ressources,
      vision, cible, offre, competences, experience, autonomie,
      budget, apport, financement, engagement, urgence, capacite_investir,
      reco_service, reco_prix, notes
    } = req.body;

    // Déterminer le profil automatiquement
    let profil = 'À qualifier';
    if (score_total >= 70) profil = 'Prêt';
    else if (score_total >= 40) profil = 'En cours';
    else if (score_total > 0) profil = 'À filtrer';

    // Sauvegarder l'entretien
    const existing = db.prepare('SELECT id FROM entretiens WHERE client_id = ?').get(req.params.id);
    if (existing) {
      db.prepare(`
        UPDATE entretiens SET
          score_total=?, score_clarte=?, score_faisabilite=?, score_motivation=?, score_ressources=?,
          vision=?, cible=?, offre=?, competences=?, experience=?, autonomie=?,
          budget=?, apport=?, financement=?, engagement=?, urgence=?, capacite_investir=?,
          reco_service=?, reco_prix=?, notes=?, updated_at=datetime('now')
        WHERE client_id=?
      `).run(
        score_total, score_clarte, score_faisabilite, score_motivation, score_ressources,
        vision, cible, offre, competences, experience, autonomie,
        budget, apport, financement, engagement, urgence, capacite_investir,
        reco_service, reco_prix, notes, req.params.id
      );
    } else {
      db.prepare(`
        INSERT INTO entretiens
          (client_id, score_total, score_clarte, score_faisabilite, score_motivation, score_ressources,
           vision, cible, offre, competences, experience, autonomie,
           budget, apport, financement, engagement, urgence, capacite_investir,
           reco_service, reco_prix, notes)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        req.params.id,
        score_total, score_clarte, score_faisabilite, score_motivation, score_ressources,
        vision, cible, offre, competences, experience, autonomie,
        budget, apport, financement, engagement, urgence, capacite_investir,
        reco_service, reco_prix, notes
      );
    }

    // Mettre à jour le score et profil du client
    db.prepare('UPDATE clients SET score=?, profil=?, updated_at=datetime(\'now\') WHERE id=?')
      .run(score_total, profil, req.params.id);

    res.json({ message: 'Entretien sauvegardé.', profil, score: score_total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ── GET /api/clients/stats/dashboard ─────────────────────
router.get('/stats/dashboard', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as n FROM clients').get().n;
    const scored = db.prepare('SELECT AVG(score) as avg FROM clients WHERE score IS NOT NULL').get();
    const profils = db.prepare('SELECT profil, COUNT(*) as n FROM clients GROUP BY profil').all();

    const CA_MAP = {
      'Pack Financement': 2000, 'Pack Global': 2750,
      'Pack Création': 1200, 'Pack Essentiel': 650,
      'Coaching 5 séances': 320, 'Coaching 3 séances': 210,
      'Business plan': 700, 'Entretien initial': 80,
    };
    const allClients = db.prepare('SELECT prestation FROM clients').all();
    let ca = 0;
    allClients.forEach(c => {
      const key = Object.keys(CA_MAP).find(k => c.prestation && c.prestation.includes(k));
      if (key) ca += CA_MAP[key];
    });

    res.json({
      total,
      ca,
      scoreAvg: scored.avg ? Math.round(scored.avg) : null,
      profils: profils.reduce((acc, p) => { acc[p.profil] = p.n; return acc; }, {})
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
