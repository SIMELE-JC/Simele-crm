const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');

const { db } = require('../db');

const nodemailer = require('nodemailer');
const multer = require('multer');
const JWT_SECRET = process.env.JWT_SECRET || 'simele_secret_dev_changeme';

async function sendEmailClient(destinataire, prenom, email, tempPassword) {
  // Auto-detect email provider from env vars
  const smtpUser = process.env.EMAIL_FROM || process.env.SMTP_USER || '';
  const smtpPass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS || '';
  const smtpHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || '';
  const smtpPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');
  const apiKey   = process.env.BREVO_API_KEY || process.env.SENDGRID_API_KEY || '';

  console.log('[EMAIL] Provider:', apiKey ? 'API (Brevo/SendGrid)' : 'SMTP', '| to:', destinataire);

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#1a365d;padding:20px;border-radius:8px 8px 0 0;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:1.4rem">Cabinet de Conseils SIMELE</h1>
    </div>
    <div style="background:#fff;padding:30px;border:1px solid #e8ecf4;border-top:none;border-radius:0 0 8px 8px">
      <p style="font-size:1rem;color:#374151">Bonjour <strong>${prenom}</strong>,</p>
      <p style="color:#374151">Votre espace client a bien été activé sur <strong>ccsguadeloupe.fr</strong>.</p>
      <p style="color:#374151">Accédez-y avec vos identifiants provisoires :</p>
      <div style="background:#f0f4ff;border-left:4px solid #1a365d;padding:16px 20px;border-radius:4px;margin:20px 0">
        <p style="margin:0 0 8px;color:#374151">🔐 <strong>Identifiant :</strong> ${email}</p>
        <p style="margin:0;color:#374151">🔐 <strong>Mot de passe :</strong> <span style="font-family:monospace;background:#e8ecf4;padding:2px 8px;border-radius:4px">${tempPassword}</span></p>
      </div>
      <p style="color:#374151">Pour votre sécurité, changez ce mot de passe dès votre première connexion.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="https://www.ccsguadeloupe.fr" style="background:#1a365d;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">Accéder à mon espace client</a>
      </div>
      <p style="color:#6b7280;font-size:.9rem">Cabinet de Conseils SIMELE · Trois-Rivières, Guadeloupe</p>
    </div>
  </div>`;

  // === OPTION A: Brevo/SendGrid HTTP API (no SMTP auth needed) ===
  if (apiKey) {
    const isBrevo = !!process.env.BREVO_API_KEY;
    const endpoint = isBrevo
      ? 'https://api.brevo.com/v3/smtp/email'
      : 'https://api.sendgrid.com/v3/mail/send';
    const headers = isBrevo
      ? { 'api-key': apiKey, 'Content-Type': 'application/json' }
      : { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' };
    const body = isBrevo ? JSON.stringify({
      sender: { name: 'Cabinet SIMELE', email: smtpUser || 'no-reply@ccsguadeloupe.fr' },
      to: [{ email: destinataire, name: prenom }],
      subject: 'Activation de votre espace client sécurisé — Cabinet SIMELE',
      htmlContent: html
    }) : JSON.stringify({
      personalizations: [{ to: [{ email: destinataire }] }],
      from: { email: smtpUser || 'no-reply@ccsguadeloupe.fr', name: 'Cabinet SIMELE' },
      subject: 'Activation de votre espace client sécurisé — Cabinet SIMELE',
      content: [{ type: 'text/html', value: html }]
    });
    const res = await fetch(endpoint, { method: 'POST', headers, body });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('API email error ' + res.status + ': ' + err.slice(0, 200));
    }
    console.log('[EMAIL] ✅ Envoyé via API à', destinataire);
    return { success: true };
  }

  // === OPTION B: SMTP classique (Gmail app password, OVH, etc.) ===
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('Email non configuré. Ajoutez BREVO_API_KEY ou EMAIL_HOST/EMAIL_FROM/EMAIL_PASSWORD dans Railway.');
  }
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false }
  });
  await transporter.sendMail({
    from: '"Cabinet SIMELE" <' + smtpUser + '>',
    to: destinataire,
    subject: 'Activation de votre espace client sécurisé — Cabinet SIMELE',
    html: html
  });
  console.log('[EMAIL] ✅ Envoyé via SMTP à', destinataire);
  return { success: true };
}



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
    await sendEmailClient(insc.email, insc.prenom, insc.email, tempPassword);
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


/* ---------------------------------------------------------------
   POST /api/portal/envoyer-acces/:clientId
   Crée ou réinitialise l'accès espace client et envoie l'email
   ---------------------------------------------------------------*/
router.post('/envoyer-acces/:clientId', requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    // Load client data
    const client = db.prepare('SELECT * FROM clients WHERE id=?').get(clientId);
    if (!client) return res.status(404).json({ error: 'Client introuvable' });
    if (!client.email) return res.status(400).json({ error: 'Ce client n\'a pas d\'email renseigné. Ajoutez-le d\'abord dans sa fiche.' });

    // Generate a secure temp password (8 chars: letters + digits)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPassword = '';
    for (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];
    const hash = await bcrypt.hash(tempPassword, 10);
    const emailLower = client.email.trim().toLowerCase();

    // Check if inscription already exists for this client
    let insc = db.prepare('SELECT * FROM portal_inscriptions WHERE client_id=?').get(clientId)
              || db.prepare('SELECT * FROM portal_inscriptions WHERE email=?').get(emailLower);

    if (insc) {
      // Update existing: reset password, set actif
      db.prepare(`UPDATE portal_inscriptions
        SET password_hash=?, mot_de_passe_provisoire=?, statut='valide', acces_actif=1,
            client_id=?, validated_at=datetime('now'), mdp_envoi_at=datetime('now')
        WHERE id=?`).run(hash, tempPassword, clientId, insc.id);
    } else {
      // Create new inscription from client data
      const result = db.prepare(`INSERT INTO portal_inscriptions
        (nom, prenom, email, tel, situation_fam, projet, prestation,
         statut, identifiant, password_hash, mot_de_passe_provisoire,
         client_id, acces_actif, validated_at, mdp_envoi_at)
        VALUES (?,?,?,?,?,?,?,'valide',?,?,?,?,1,datetime('now'),datetime('now'))`)
        .run(
          client.nom||'', client.prenom||'', emailLower,
          client.tel||'', client.statut||'', client.projet||'', client.prestation||'',
          emailLower, hash, tempPassword, clientId
        );
      insc = { id: result.lastInsertRowid };
    }

    // Send the email - catch failure separately to report it
    let emailOk = false, emailErr = '';
    try {
      await sendEmailClient(client.email, client.prenom, client.email, tempPassword);
      emailOk = true;
    } catch(emailError) {
      emailErr = emailError.message;
      console.error('[PORTAL] Email non envoyé:', emailErr);
    }

    res.json({
      emailSent: emailOk,
      emailError: emailErr || null,
      success: true,
      message: emailOk
        ? 'Accès créé et email envoyé à ' + client.email
        : 'Accès créé mais email non envoyé (' + emailErr + '). Transmettez le mot de passe manuellement.',
      email: client.email,
      mdp_provisoire: tempPassword
    });
  } catch(e) {
    console.error('envoyer-acces:', e);
    res.status(500).json({ error: e.message });
  }
});

/* ---------------------------------------------------------------
   GET /api/portal/statut-client/:clientId
   Vérifie si un client a déjà un accès espace client
   ---------------------------------------------------------------*/
router.get('/statut-client/:clientId', requireAdmin, (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const insc = db.prepare('SELECT id, statut, email, acces_actif, validated_at, mdp_envoi_at FROM portal_inscriptions WHERE client_id=?').get(clientId);
    res.json({ hasAccess: !!insc, inscription: insc || null });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
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


// Changer mot de passe client
router.post('/changer-mot-de-passe', requirePortal, async (req, res) => {
  const { ancien_mdp, nouveau_mdp } = req.body;
  if (!ancien_mdp || !nouveau_mdp) {
    return res.status(400).json({ error: 'Les deux mots de passe sont requis.' });
  }
  if (nouveau_mdp.length < 6) {
    return res.status(400).json({ error: 'Minimum 6 caracteres requis.' });
  }
  try {
    const client = db.prepare('SELECT * FROM portal_inscriptions WHERE id = ?').get(req.portalUser.id);
    if (!client) return res.status(404).json({ error: 'Client introuvable.' });
    const ok = await bcrypt.compare(ancien_mdp, client.password_hash);
    if (!ok) return res.status(401).json({ error: 'Ancien mot de passe incorrect.' });
    const hash = await bcrypt.hash(nouveau_mdp, 10);
    db.prepare('UPDATE portal_inscriptions SET password_hash = ? WHERE id = ?').run(hash, req.portalUser.id);
    res.json({ success: true, message: 'Mot de passe mis a jour.' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


/* =====================================================================
   PORTAIL CLIENT — Nouvelles routes
   ===================================================================== */

/* ─── GET /api/portal/services — Liste des services disponibles ─── */
router.get('/services', (req, res) => {
  const services = [
    { id:'coaching3',  label:'Coaching Stratégique — 3 séances',      prix:210,  desc:'Accompagnement intensif en 3 séances pour structurer votre projet.' },
    { id:'coaching5',  label:'Coaching Stratégique — 5 séances',      prix:320,  desc:'Accompagnement renforcé en 5 séances.' },
    { id:'diag',       label:'Diagnostic de projet',                   prix:80,   desc:'Analyse approfondie de votre projet en 1h30.' },
    { id:'bp',         label:'Business Plan complet',                  prix:450,  desc:'Rédaction complète de votre business plan.' },
    { id:'prev',       label:'Prévisionnel financier 3 ans',           prix:350,  desc:'Élaboration de votre prévisionnel financier.' },
    { id:'fin',        label:'Dossier de financement',                 prix:null, desc:'Montage de votre dossier de financement bancaire.' },
    { id:'sub',        label:'Dossier de subvention',                  prix:null, desc:'Recherche et montage de vos dossiers de subvention.' },
    { id:'mandat',     label:"Mandat d'accompagnement",                prix:null, desc:"Accompagnement global avec mandat." },
    { id:'pack_ess',   label:'Pack Essentiel Création',                prix:590,  desc:'Pack complet pour créer votre entreprise.' },
    { id:'pack_fin',   label:'Pack Financement',                       prix:890,  desc:'Pack dédié au financement de votre projet.' },
    { id:'pack_glob',  label:'Pack Global',                            prix:1290, desc:'Accompagnement complet de A à Z.' }
  ];
  res.json({ services });
});

/* ─── POST /api/portal/choisir-prestation — Client choisit sa prestation ─── */
router.post('/choisir-prestation', requirePortal, (req, res) => {
  try {
    const { service_id, service_label, prix, message } = req.body;
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.status(404).json({ error: 'Inscription introuvable' });

    // Update prestation on inscription
    db.prepare("UPDATE portal_inscriptions SET prestation_choisie=?, total_prestations=? WHERE id=?")
      .run(service_label || '', prix || 0, insc.id);

    // Also update client if linked
    if (insc.client_id) {
      db.prepare("UPDATE clients SET prestation=? WHERE id=?")
        .run(service_label || '', insc.client_id);
    }

    // Create notification for admin
    const notifTitre = '📋 Nouvelle demande de prestation : ' + (service_label || '');
    const notifContenu = 'Le client ' + insc.prenom + ' ' + insc.nom
      + ' a choisi : ' + (service_label || '')
      + (prix ? ' (' + prix + ' €)' : ' (sur devis)')
      + (message ? ' | Message : ' + message : '');
    db.prepare("INSERT INTO notifications_client (inscription_id, client_id, type, titre, contenu) VALUES (?,?,?,?,?)")
      .run(insc.id, insc.client_id || null, 'prestation', notifTitre, notifContenu);

    res.json({ success: true, message: 'Demande envoyée ! Le cabinet reviendra vers vous rapidement.' });
  } catch(e) {
    console.error('choisir-prestation:', e);
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/portal/mes-documents — Documents du dossier visibles par le client ─── */
router.get('/mes-documents-dossier', requirePortal, (req, res) => {
  try {
    const insc = db.prepare('SELECT client_id FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc || !insc.client_id) return res.json({ documents: [] });
    const docs = db.prepare(
      "SELECT id, nom, type, description, taille, created_at FROM client_documents WHERE client_id=? AND visible_client=1 ORDER BY created_at DESC"
    ).all(insc.client_id);
    res.json({ documents: docs });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ─── POST /api/portal/envoyer-document — Client envoie un document ─── */
const uploadPortal = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      const dir = process.env.DB_PATH
        ? require('path').join(require('path').dirname(process.env.DB_PATH), 'portal_uploads')
        : '/app/data/portal_uploads';
      if (!require('fs').existsSync(dir)) require('fs').mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: function(req, file, cb) {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, Date.now() + '_' + safe);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    const ok = ['.pdf','.doc','.docx','.xls','.xlsx','.jpg','.jpeg','.png','.gif','.txt','.zip','.html'];
    const ext = require('path').extname(file.originalname).toLowerCase();
    ok.includes(ext) ? cb(null, true) : cb(new Error('Type non autorisé: ' + ext));
  }
});

router.post('/envoyer-document', requirePortal, uploadPortal.single('fichier'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
    const { commentaire } = req.body;
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.status(404).json({ error: 'Inscription introuvable' });

    const result = db.prepare(
      "INSERT INTO portal_uploads (inscription_id, client_id, nom_original, chemin_stockage, taille, statut, commentaire) VALUES (?,?,?,?,?,'en_attente',?)"
    ).run(insc.id, insc.client_id || null, req.file.originalname, req.file.path, req.file.size, commentaire || '');

    // Notification pour admin
    db.prepare("INSERT INTO notifications_client (inscription_id, client_id, type, titre, contenu) VALUES (?,?,?,?,?)")
      .run(insc.id, insc.client_id || null, 'document',
        '📎 Nouveau document reçu de ' + insc.prenom + ' ' + insc.nom,
        'Fichier : ' + req.file.originalname + (commentaire ? ' | Commentaire : ' + commentaire : ''));

    res.json({ success: true, upload_id: result.lastInsertRowid, message: 'Document envoyé ! Il sera examiné et ajouté à votre dossier.' });
  } catch(e) {
    console.error('envoyer-document:', e);
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/portal/dashboard — Tableau de bord complet du client ─── */
router.get('/dashboard', requirePortal, (req, res) => {
  try {
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.status(404).json({ error: 'Introuvable' });
    const client = insc.client_id
      ? db.prepare('SELECT id,nom,prenom,email,tel,projet,prestation,score,profil,statut,notes FROM clients WHERE id=?').get(insc.client_id)
      : null;
    const docs = insc.client_id
      ? db.prepare("SELECT id,nom,type,taille,created_at FROM client_documents WHERE client_id=? AND visible_client=1 ORDER BY created_at DESC").all(insc.client_id)
      : [];
    const myUploads = db.prepare("SELECT id,nom_original,nom_final,statut,commentaire,created_at FROM portal_uploads WHERE inscription_id=? ORDER BY created_at DESC").all(insc.id);
    const notifs = db.prepare("SELECT * FROM notifications_client WHERE inscription_id=? ORDER BY created_at DESC LIMIT 10").all(insc.id);
    const commandes = db.prepare("SELECT * FROM commandes WHERE inscription_id=? ORDER BY created_at DESC").all(insc.id);

    res.json({
      client: { nom:insc.nom, prenom:insc.prenom, email:insc.email, prestation: client?.prestation || insc.prestation_choisie || insc.prestation || '', score: client?.score || 0 },
      documents: docs,
      mes_uploads: myUploads,
      notifications: notifs,
      commandes,
      total_prestations: insc.total_prestations || 0,
      prestation_choisie: insc.prestation_choisie || ''
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ─── ADMIN: GET uploads en attente ─── */
router.get('/uploads-en-attente', requireAdmin, (req, res) => {
  try {
    const uploads = db.prepare(
      "SELECT pu.*, pi.nom, pi.prenom, pi.email FROM portal_uploads pu JOIN portal_inscriptions pi ON pu.inscription_id=pi.id WHERE pu.statut='en_attente' ORDER BY pu.created_at DESC"
    ).all();
    res.json({ uploads });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ─── ADMIN: GET toutes les notifications ─── */
router.get('/notifications', requireAdmin, (req, res) => {
  try {
    const notifs = db.prepare(
      "SELECT nc.*, pi.nom, pi.prenom, c.id as client_id FROM notifications_client nc LEFT JOIN portal_inscriptions pi ON nc.inscription_id=pi.id LEFT JOIN clients c ON nc.client_id=c.id ORDER BY nc.created_at DESC LIMIT 50"
    ).all();
    const unread = db.prepare("SELECT COUNT(*) as n FROM notifications_client WHERE lu=0").get();
    res.json({ notifications: notifs, unread: unread.n });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ─── ADMIN: Marquer notification lue ─── */
router.put('/notifications/:id/lu', requireAdmin, (req, res) => {
  try {
    db.prepare("UPDATE notifications_client SET lu=1 WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ─── ADMIN: Valider un upload et l'ajouter au dossier ─── */
router.post('/uploads/:id/valider', requireAdmin, (req, res) => {
  try {
    const { nom_final, type, description, date_doc } = req.body;
    const upload = db.prepare('SELECT * FROM portal_uploads WHERE id=?').get(req.params.id);
    if (!upload) return res.status(404).json({ error: 'Upload introuvable' });
    if (!upload.client_id) return res.status(400).json({ error: 'Pas de client associé à cet upload' });

    // Add to client_documents
    const date = date_doc || new Date().toISOString().slice(0,10);
    db.prepare(
      "INSERT INTO client_documents (client_id, type, nom, description, chemin_stockage, taille, visible_client, created_at) VALUES (?,?,?,?,?,?,1,?)"
    ).run(upload.client_id, type || 'document', nom_final || upload.nom_original, description || '', upload.chemin_stockage, upload.taille, date + 'T00:00:00');

    // Mark upload as validated
    db.prepare("UPDATE portal_uploads SET statut='valide', nom_final=?, validated_at=datetime('now') WHERE id=?")
      .run(nom_final || upload.nom_original, upload.id);

    res.json({ success: true, message: 'Document ajouté au dossier client.' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ─── ADMIN: Rejeter un upload ─── */
router.post('/uploads/:id/rejeter', requireAdmin, (req, res) => {
  try {
    db.prepare("UPDATE portal_uploads SET statut='rejete' WHERE id=?").run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ─── ADMIN: Télécharger un upload ─── */
router.get('/uploads/:id/download', requireAdmin, (req, res) => {
  try {
    const upload = db.prepare('SELECT * FROM portal_uploads WHERE id=?').get(req.params.id);
    if (!upload || !upload.chemin_stockage) return res.status(404).json({ error: 'Fichier introuvable' });
    res.download(upload.chemin_stockage, upload.nom_original || 'document');
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ─── ADMIN: Notifications non lues count ─── */
router.get('/notifications-count', requireAdmin, (req, res) => {
  try {
    const r = db.prepare("SELECT COUNT(*) as n FROM notifications_client WHERE lu=0").get();
    res.json({ count: r.n });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


/* ================================================================
   CHAT EN DIRECT — Messages client ↔ cabinet
   ================================================================ */

/* POST /api/portal/chat — Client envoie un message */
router.post('/chat', requirePortal, (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message vide' });
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.status(404).json({ error: 'Inscription introuvable' });
    const result = db.prepare(
      "INSERT INTO chat_messages (inscription_id, client_id, expediteur, message) VALUES (?,?,'client',?)"
    ).run(insc.id, insc.client_id || null, message.trim());
    // Notification admin
    db.prepare("INSERT INTO notifications_client (inscription_id, client_id, type, titre, contenu) VALUES (?,?,?,?,?)")
      .run(insc.id, insc.client_id || null, 'chat',
        '💬 Nouveau message de ' + insc.prenom + ' ' + insc.nom,
        message.trim().slice(0, 120));
    res.json({ success: true, id: result.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* GET /api/portal/chat — Client récupère l'historique */
router.get('/chat', requirePortal, (req, res) => {
  try {
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.json({ messages: [] });
    // Mark admin messages as read by client
    db.prepare("UPDATE chat_messages SET lu=1 WHERE inscription_id=? AND expediteur='cabinet'")
      .run(insc.id);
    const messages = db.prepare(
      "SELECT * FROM chat_messages WHERE inscription_id=? ORDER BY created_at ASC LIMIT 200"
    ).all(insc.id);
    res.json({ messages });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* GET /api/portal/chat/unread — Nb messages non lus par le client */
router.get('/chat/unread', requirePortal, (req, res) => {
  try {
    const insc = db.prepare('SELECT id FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.json({ count: 0 });
    const r = db.prepare("SELECT COUNT(*) as n FROM chat_messages WHERE inscription_id=? AND expediteur='cabinet' AND lu=0").get(insc.id);
    res.json({ count: r.n });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: lire tous les chats d'un client ── */
router.get('/chat/client/:clientId', requireAdmin, (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const insc = db.prepare('SELECT id FROM portal_inscriptions WHERE client_id=?').get(clientId);
    if (!insc) return res.json({ messages: [], hasPortal: false });
    const messages = db.prepare(
      "SELECT * FROM chat_messages WHERE inscription_id=? ORDER BY created_at ASC LIMIT 200"
    ).all(insc.id);
    // Mark client messages as read
    db.prepare("UPDATE chat_messages SET lu=1 WHERE inscription_id=? AND expediteur='client' AND lu=0")
      .run(insc.id);
    res.json({ messages, hasPortal: true, inscription_id: insc.id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: répondre à un client ── */
router.post('/chat/reply/:inscriptionId', requireAdmin, (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message vide' });
    const inscId = parseInt(req.params.inscriptionId);
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(inscId);
    if (!insc) return res.status(404).json({ error: 'Inscription introuvable' });
    db.prepare("INSERT INTO chat_messages (inscription_id, client_id, expediteur, message) VALUES (?,?,'cabinet',?)")
      .run(inscId, insc.client_id || null, message.trim());
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ── ADMIN: messages non lus (toutes conversations) ── */
router.get('/chat/unread-admin', requireAdmin, (req, res) => {
  try {
    const r = db.prepare("SELECT COUNT(*) as n FROM chat_messages WHERE expediteur='client' AND lu=0").get();
    res.json({ count: r.n });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ================================================================
   DEMANDES DE DEVIS depuis l'espace client
   ================================================================ */

/* POST /api/portal/demande-devis */
router.post('/demande-devis', requirePortal, (req, res) => {
  try {
    const { service_id, service_label, description } = req.body;
    if (!service_id) return res.status(400).json({ error: 'Service manquant' });
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.status(404).json({ error: 'Inscription introuvable' });
    const result = db.prepare(
      "INSERT INTO demandes_devis (inscription_id, client_id, service_id, service_label, description) VALUES (?,?,?,?,?)"
    ).run(insc.id, insc.client_id || null, service_id, service_label, description || '');
    // Notification
    db.prepare("INSERT INTO notifications_client (inscription_id, client_id, type, titre, contenu) VALUES (?,?,?,?,?)")
      .run(insc.id, insc.client_id || null, 'devis',
        '📋 Demande de devis : ' + service_label,
        (description || '').slice(0, 200));
    // Also update prestation if has price
    res.json({ success: true, id: result.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* GET /api/portal/demandes-devis — admin: liste des demandes */
router.get('/demandes-devis', requireAdmin, (req, res) => {
  try {
    const demandes = db.prepare(
      "SELECT dd.*, pi.nom, pi.prenom, pi.email FROM demandes_devis dd JOIN portal_inscriptions pi ON dd.inscription_id=pi.id ORDER BY dd.created_at DESC LIMIT 50"
    ).all();
    res.json({ demandes });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

/* ─── POST /api/portal/soumettre-pij — Client soumet son dossier PIJ directement ─── */
router.post('/soumettre-pij', requirePortal, (req, res) => {
  try {
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.status(404).json({ error: 'Inscription introuvable' });

    const { donnees } = req.body;
    if (!donnees) return res.status(400).json({ error: 'Données PIJ manquantes' });

    // Vérifier si un PIJ existe déjà pour ce client (mise à jour ou création)
    const existing = db.prepare('SELECT id FROM pij_dossiers WHERE inscription_id=?').get(insc.id);
    
    if (existing) {
      db.prepare("UPDATE pij_dossiers SET donnees_json=?, statut='recu', updated_at=datetime('now') WHERE id=?")
        .run(JSON.stringify(donnees), existing.id);
    } else {
      db.prepare("INSERT INTO pij_dossiers (inscription_id, client_id, donnees_json, statut) VALUES (?,?,?,'recu')")
        .run(insc.id, insc.client_id || null, JSON.stringify(donnees));
    }

    // Notification admin
    db.prepare("INSERT INTO notifications_client (inscription_id, client_id, type, titre, contenu) VALUES (?,?,?,?,?)")
      .run(insc.id, insc.client_id || null, 'pij',
        'Dossier PIJ reçu — ' + insc.prenom + ' ' + insc.nom,
        (donnees.raison_sociale || 'Projet') + ' · PIJ demandé : ' + (donnees.montant_pij_demande || '?') + ' EUR');

    res.json({ success: true, message: 'Dossier PIJ enregistré dans votre dossier.' });
  } catch(e) {
    console.error('soumettre-pij error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/portal/mon-pij — Client consulte son dossier PIJ ─── */
router.get('/mon-pij', requirePortal, (req, res) => {
  try {
    const insc = db.prepare('SELECT id FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.status(404).json({ error: 'Introuvable' });
    const pij = db.prepare('SELECT * FROM pij_dossiers WHERE inscription_id=? ORDER BY updated_at DESC LIMIT 1').get(insc.id);
    if (!pij) return res.json({ pij: null });
    res.json({ pij: { ...pij, donnees: JSON.parse(pij.donnees_json) } });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── GET /api/portal/pij-client/:inscriptionId — Admin consulte le PIJ d'un client ─── */
router.get('/pij-client/:inscriptionId', (req, res) => {
  try {
    const pij = db.prepare('SELECT * FROM pij_dossiers WHERE inscription_id=? ORDER BY updated_at DESC LIMIT 1').get(req.params.inscriptionId);
    if (!pij) return res.json({ pij: null });
    res.json({ pij: { ...pij, donnees: JSON.parse(pij.donnees_json) } });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;