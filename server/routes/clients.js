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
router.post('/:id/entretien', auth, (req, res) => {
  try {
    const { score, profil, notes, situation, projet, besoins, recommandations, prochaine_etape } = req.body;
    const id = req.params.id;
    const dateEnt = new Date().toLocaleDateString('fr-FR');
    const fiche = JSON.stringify({ date: dateEnt, score: score||0, profil: profil||'À qualifier', situation: situation||'', projet: projet||'', besoins: besoins||'', recommandations: recommandations||'', prochaine_etape: prochaine_etape||'', notes: notes||'' });
    let color = '#D6EAF8', tc = '#1a5f8a';
    if (profil === 'À accompagner') { color = '#FDEBD0'; tc = '#784212'; }
    if (profil === 'Prêt à investir') { color = '#D5F5E3'; tc = '#1e8449'; }
    try {
      db.prepare('UPDATE clients SET score=?,profil=?,color=?,text_color=?,notes=?,notes_entretien=? WHERE id=?').run(score||0,profil||'À qualifier',color,tc,notes||'',fiche,id);
    } catch(e2) {
      db.prepare('UPDATE clients SET score=?,profil=?,color=?,text_color=?,notes=? WHERE id=?').run(score||0,profil||'À qualifier',color,tc,notes||'',id);
    }
    const updated = db.prepare('SELECT * FROM clients WHERE id=?').get(id);
    res.json({ success: true, client: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
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


// Route aperçu Devis
router.get('/:id/devis', auth, (req, res) => {
  try {
    const c = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Client introuvable' });
    const date = new Date().toLocaleDateString('fr-FR');
    const num = 'DEV-' + new Date().getFullYear() + '-' + String(req.params.id).padStart(4,'0');
    const tarifs = {'Diagnostic de projet':'80,00','Coaching 3 séances':'240,00','Coaching 5 séances':'380,00','Business Plan':'450,00','Prévisionnel financier':'350,00','Pack Essentiel Création':'590,00','Pack Financement':'890,00','Pack Global':'1 290,00'};
    const p = c.prestation || '';
    const montant = tarifs[p] ? tarifs[p] + ' €' : (p ? 'Sur devis' : 'À définir');
    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Devis ' + num + '</title>' +
      '<style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1b2d5b}' +
      '.bar{background:#1b2d5b;color:white;padding:12px 20px;margin:-40px -40px 30px;display:flex;justify-content:space-between;align-items:center}' +
      '.bar button{background:white;color:#1b2d5b;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:bold}' +
      '.hd{display:flex;justify-content:space-between;border-bottom:3px solid #1b2d5b;padding-bottom:20px;margin-bottom:25px}' +
      '.cs{background:#f0f4f8;padding:18px;border-radius:8px;margin-bottom:22px}' +
      'table{width:100%;border-collapse:collapse;margin-bottom:25px}' +
      'th{background:#1b2d5b;color:white;padding:11px;text-align:left;font-size:13px}' +
      'td{padding:11px;border-bottom:1px solid #e0e0e0;font-size:14px}' +
      '.tot{font-weight:bold;background:#f0f4f8}.ft{margin-top:35px;padding-top:18px;border-top:1px solid #e0e0e0;font-size:12px;color:#666}' +
      '@media print{.bar{display:none}}</style></head><body>' +
      '<div class="bar"><span>Aperçu Devis ' + num + '</span><button onclick="window.print()">🖨️ Imprimer / PDF</button></div>' +
      '<div class="hd"><div><h2 style="margin:0;font-size:20px">Cabinet de Conseils SIMELE</h2>' +
      '<p style="margin:3px 0;color:#666;font-size:13px">Expert en Création & Structuration — Guadeloupe</p>' +
      '<p style="margin:3px 0;color:#666;font-size:13px">ccs.guadeloupe@outlook.fr</p></div>' +
      '<div style="text-align:right"><div style="font-size:28px;font-weight:bold;color:#1b2d5b">DEVIS</div>' +
      '<p style="margin:3px 0;font-size:13px">N° ' + num + '</p>' +
      '<p style="margin:3px 0;font-size:13px">Date : ' + date + '</p>' +
      '<p style="margin:3px 0;font-size:13px">Valable 30 jours</p></div></div>' +
      '<div class="cs"><h3 style="margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#666">Client</h3>' +
      '<p style="margin:3px 0"><strong>' + c.prenom + ' ' + c.nom + '</strong></p>' +
      (c.email ? '<p style="margin:3px 0">' + c.email + '</p>' : '') +
      (c.tel ? '<p style="margin:3px 0">' + c.tel + '</p>' : '') + '</div>' +
      '<table><thead><tr><th>Prestation</th><th>Description</th><th style="text-align:right">Montant</th></tr></thead><tbody>' +
      (p ? '<tr><td>' + p + '</td><td>Accompagnement personnalisé - Cabinet SIMELE</td><td style="text-align:right">' + montant + '</td></tr>' :
           '<tr><td colspan="3" style="text-align:center;color:#666">Prestations à définir</td></tr>') +
      '<tr class="tot"><td colspan="2">TOTAL (TVA non applicable — art. 293 B du CGI)</td><td style="text-align:right">' + montant + '</td></tr>' +
      '</tbody></table>' +
      '<div class="ft"><p><strong>Paiement :</strong> 50% à la signature, 50% à la livraison. Virement bancaire, chèque ou espèces.</p><br>' +
      '<p>Signature du client (précédée de "Bon pour accord") :</p>' +
      '<div style="border-top:1px solid #999;margin-top:50px;width:280px;padding-top:4px;font-size:11px;color:#666">Date et signature</div></div>' +
      '</body></html>';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Route aperçu Contrat
router.get('/:id/contrat', auth, (req, res) => {
  try {
    const c = db.prepare('SELECT * FROM clients WHERE id=?').get(req.params.id);
    if (!c) return res.status(404).json({ error: 'Client introuvable' });
    const date = new Date().toLocaleDateString('fr-FR');
    const num = 'CTR-' + new Date().getFullYear() + '-' + String(req.params.id).padStart(4,'0');
    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Contrat ' + num + '</title>' +
      '<style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1b2d5b;line-height:1.65}' +
      'h1{text-align:center;font-size:20px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #1b2d5b;padding-bottom:12px}' +
      'h2{font-size:14px;text-transform:uppercase;border-left:4px solid #1b2d5b;padding-left:10px;margin-top:22px}' +
      '.pt{background:#f0f4f8;padding:18px;border-radius:8px;margin:18px 0}' +
      '.sb{display:flex;justify-content:space-between;margin-top:55px}' +
      '.sl{width:44%;border-top:1px solid #999;padding-top:5px;font-size:12px;color:#555}' +
      '.bar{background:#1b2d5b;color:white;padding:12px 20px;margin:-40px -40px 30px;display:flex;justify-content:space-between;align-items:center}' +
      '.bar button{background:white;color:#1b2d5b;border:none;padding:8px 16px;border-radius:4px;cursor:pointer;font-weight:bold}' +
      '@media print{.bar{display:none}}</style></head><body>' +
      '<div class="bar"><span>Aperçu Contrat ' + num + '</span><button onclick="window.print()">🖨️ Imprimer / PDF</button></div>' +
      '<h1>Contrat de Prestation de Services</h1>' +
      '<p style="text-align:center;color:#666;font-size:13px">N° ' + num + ' — Établi le ' + date + '</p>' +
      '<div class="pt"><h2>Parties</h2>' +
      '<p><strong>Prestataire :</strong> Cabinet de Conseils SIMELE — Expert en Création & Structuration — Guadeloupe<br>ccs.guadeloupe@outlook.fr</p><br>' +
      '<p><strong>Client :</strong> ' + c.prenom + ' ' + c.nom +
      (c.email ? ' — ' + c.email : '') + (c.tel ? ' — ' + c.tel : '') +
      (c.adresse ? '<br>' + c.adresse : '') + '</p></div>' +
      '<h2>Article 1 — Objet</h2>' +
      '<p>Le Cabinet de Conseils SIMELE s'engage à fournir : <strong>' + (c.prestation || 'Prestations à définir') + '</strong>' +
      (c.projet ? ' dans le cadre du projet : ' + c.projet : '') + '.</p>' +
      '<h2>Article 2 — Modalités</h2>' +
      '<p>La prestation débute à la date convenue et se déroule selon un planning établi d'un commun accord, en présentiel ou visioconférence.</p>' +
      '<h2>Article 3 — Tarifs et paiement</h2>' +
      '<p>Tarification selon devis joint. Règlement : 50% à la signature, 50% à la livraison. TVA non applicable, art. 293 B du CGI.</p>' +
      '<h2>Article 4 — Obligations du prestataire</h2>' +
      '<p>Fourniture des prestations avec sérieux et professionnalisme. Confidentialité stricte des informations communiquées par le Client.</p>' +
      '<h2>Article 5 — Obligations du client</h2>' +
      '<p>Fournir toutes les informations nécessaires, respecter les rendez-vous convenus, régler les honoraires aux échéances prévues.</p>' +
      '<h2>Article 6 — Confidentialité</h2>' +
      '<p>Les deux parties s'engagent à traiter de façon strictement confidentielle toutes les informations échangées dans le cadre de ce contrat.</p>' +
      '<h2>Article 7 — Droit applicable</h2>' +
      '<p>Droit français. Tout litige sera soumis aux tribunaux compétents de Guadeloupe.</p>' +
      '<div class="sb">' +
      '<div class="sl"><strong>Le Prestataire</strong><br>Cabinet de Conseils SIMELE<br><br><br>Date : ___________<br>Signature :</div>' +
      '<div class="sl"><strong>Le Client</strong><br>' + c.prenom + ' ' + c.nom + '<br><em>(Lu et approuvé)</em><br>Date : ___________<br>Signature :</div>' +
      '</div></body></html>';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
