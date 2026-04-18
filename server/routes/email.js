const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const bcryptjs = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const { getDB } = require('../db');

// Créer le transporteur SMTP Outlook
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_FROM || 'ccs.espace-client@outlook.fr',
      pass: process.env.EMAIL_PASSWORD
    },
    tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
  });
}

// Générer un mot de passe provisoire lisible
function genPassword() {
  var chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  var pwd = 'CS-';
  for (var i = 0; i < 8; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

// POST /api/email/send-acces — envoyer accès espace client (bouton manuel)
router.post('/send-acces', requireAuth, function(req, res) {
  var db = getDB();
  var clientId = req.body.client_id;
  var client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  if (!client.email) return res.status(400).json({ error: 'Le client n\'a pas d\'adresse email' });

  var password = genPassword();
  var hash = bcryptjs.hashSync(password, 10);
  
  // Sauvegarder le mot de passe dans portal_inscriptions
  var existing = db.prepare('SELECT id FROM portal_inscriptions WHERE email = ?').get(client.email);
  if (existing) {
    db.prepare('UPDATE portal_inscriptions SET mot_de_passe_provisoire=?, mdp_envoi_at=datetime(\'now\'), acces_actif=1, password=? WHERE email=?')
      .run(password, hash, client.email);
  } else {
    db.prepare('INSERT INTO portal_inscriptions (email, nom, prenom, password, mot_de_passe_provisoire, mdp_envoi_at, acces_actif, statut) VALUES (?,?,?,?,?,datetime(\'now\'),1,\'approuve\')')
      .run(client.email, client.nom || '', client.prenom || '', hash, password);
  }

  var nom = (client.prenom || '') + ' ' + (client.nom || '');
  var transporter = createTransporter();
  var mailOptions = {
    from: '"Cabinet SIMELE" <' + (process.env.EMAIL_FROM || 'ccs.espace-client@outlook.fr') + '>',
    to: client.email,
    subject: 'Vos identifiants - Espace Client Cabinet de Conseils SIMELE',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">' +
      '<div style="background:#1b2d5b;padding:20px;text-align:center;border-radius:8px 8px 0 0">' +
      '<h1 style="color:#c9a96e;margin:0;font-size:22px">Cabinet de Conseils SIMELE</h1>' +
      '<p style="color:white;margin:5px 0 0;font-size:13px">Votre espace client est prêt</p></div>' +
      '<div style="background:white;padding:30px;border:1px solid #e0e0e0;border-radius:0 0 8px 8px">' +
      '<p>Bonjour <strong>' + nom.trim() + '</strong>,</p>' +
      '<p>Votre espace client personnel est maintenant accessible. Voici vos identifiants :</p>' +
      '<div style="background:#f8f9fa;border-left:4px solid #c9a96e;padding:15px;margin:20px 0;border-radius:4px">' +
      '<p style="margin:5px 0"><strong>Email :</strong> ' + client.email + '</p>' +
      '<p style="margin:5px 0"><strong>Mot de passe provisoire :</strong> <span style="font-size:18px;font-weight:bold;color:#1b2d5b;letter-spacing:2px">' + password + '</span></p>' +
      '</div>' +
      '<p>Connectez-vous sur : <a href="https://www.ccsguadeloupe.fr" style="color:#1b2d5b;font-weight:bold">www.ccsguadeloupe.fr</a> → Mon Espace</p>' +
      '<p style="color:#e74c3c;font-size:13px">⚠️ Pensez à changer votre mot de passe lors de votre première connexion.</p>' +
      '<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">' +
      '<p style="font-size:12px;color:#666">Cabinet de Conseils SIMELE · Trois-Rivières, Guadeloupe<br>' +
      'Cet email a été envoyé automatiquement, ne pas répondre.</p></div></div>'
  };

  transporter.sendMail(mailOptions, function(err, info) {
    if (err) {
      console.error('Email error:', err);
      return res.status(500).json({ error: 'Erreur envoi email: ' + err.message, password: password });
    }
    res.json({ success: true, message: 'Email envoyé à ' + client.email, password: password });
  });
});

// POST /api/email/send-acces-auto — appelé automatiquement à la création du client
router.post('/send-acces-auto', requireAuth, function(req, res) {
  req.body.client_id = req.body.client_id;
  // Même logique que send-acces
  var db = getDB();
  var clientId = req.body.client_id;
  var client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client || !client.email) return res.json({ success: false, reason: 'pas email' });
  
  var password = genPassword();
  var hash = bcryptjs.hashSync(password, 10);
  var existing = db.prepare('SELECT id FROM portal_inscriptions WHERE email = ?').get(client.email);
  if (existing) {
    db.prepare('UPDATE portal_inscriptions SET mot_de_passe_provisoire=?, mdp_envoi_at=datetime(\'now\'), acces_actif=1, password=? WHERE email=?')
      .run(password, hash, client.email);
  } else {
    db.prepare('INSERT INTO portal_inscriptions (email, nom, prenom, password, mot_de_passe_provisoire, mdp_envoi_at, acces_actif, statut) VALUES (?,?,?,?,?,datetime(\'now\'),1,\'approuve\')')
      .run(client.email, client.nom || '', client.prenom || '', hash, password);
  }

  var nom = (client.prenom || '') + ' ' + (client.nom || '');
  var transporter = createTransporter();
  var mailOptions = {
    from: '"Cabinet SIMELE" <' + (process.env.EMAIL_FROM || 'ccs.espace-client@outlook.fr') + '>',
    to: client.email,
    subject: 'Bienvenue - Votre dossier client est créé · Cabinet SIMELE',
    html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">' +
      '<div style="background:#1b2d5b;padding:20px;text-align:center;border-radius:8px 8px 0 0">' +
      '<h1 style="color:#c9a96e;margin:0;font-size:22px">Cabinet de Conseils SIMELE</h1>' +
      '<p style="color:white;margin:5px 0 0;font-size:13px">Votre projet mérite d\'aboutir</p></div>' +
      '<div style="background:white;padding:30px;border:1px solid #e0e0e0;border-radius:0 0 8px 8px">' +
      '<p>Bonjour <strong>' + nom.trim() + '</strong>,</p>' +
      '<p>Votre dossier client a été créé avec succès. Vous pouvez dès maintenant accéder à votre espace personnel.</p>' +
      '<div style="background:#f8f9fa;border-left:4px solid #c9a96e;padding:15px;margin:20px 0;border-radius:4px">' +
      '<p style="margin:5px 0"><strong>Email :</strong> ' + client.email + '</p>' +
      '<p style="margin:5px 0"><strong>Mot de passe provisoire :</strong> <span style="font-size:18px;font-weight:bold;color:#1b2d5b;letter-spacing:2px">' + password + '</span></p>' +
      '</div>' +
      '<div style="text-align:center;margin:25px 0">' +
      '<a href="https://www.ccsguadeloupe.fr" style="background:#c9a96e;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px">Accéder à mon espace</a></div>' +
      '<p style="color:#e74c3c;font-size:13px">⚠️ Ce mot de passe est provisoire. Changez-le lors de votre première connexion.</p>' +
      '<hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0">' +
      '<p style="font-size:12px;color:#666">Cabinet de Conseils SIMELE · Trois-Rivières, Guadeloupe</p></div></div>'
  };

  transporter.sendMail(mailOptions, function(err) {
    if (err) console.error('Auto-email error:', err.message);
    res.json({ success: !err, message: err ? err.message : 'Email envoyé' });
  });
});

module.exports = router;
