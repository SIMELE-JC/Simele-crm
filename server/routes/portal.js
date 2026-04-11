// ============================================================
// CLIENT PORTAIL — SIMELE CRM
// server/routes/portal.js
// ============================================================
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const chemin = require('chemin');
const fs = require('fs');

// ✅ CORRECTION BUG CRITIQUE : db.js exporte { db, initDB } — pas db directement
const { db } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'simele_secret_dev_changeme';

// ───────────────────────────────────────────────────────
// INTERMÉDIAIRE : admin (jeton CRM standard, sans champ type:'portail')
// ───────────────────────────────────────────────────────
fonction requireAdmin(req, res, next) {
  const en-tête = req.headers.authorization;
  si (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token administrateur manquant' });
  }
  essayer {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.type === 'portal') return res.status(403).json({ error: 'Accès réservé à l\'administration' });
    req.adminUser = charge utile;
    suivant();
  } attraper (e) {
    return res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
  }
}

// ───────────────────────────────────────────────────────
// MIDDLEWARE : portail client (token avec type:'portal')
// ───────────────────────────────────────────────────────
fonction requirePortal(req, res, next) {
  const en-tête = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autorisé' });
  essayer {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.type !== 'portal') return res.status(403).json({ error: 'Token client requis' });
    req.portalUser = charge utile;
    suivant();
  } attraper (e) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// ============================================================
// ROUTES PUBLIQUES
// ============================================================

// POST /api/portal/inscription
router.post('/inscription', (req, res) => {
  essayer {
    const { nom, prenom, email, tel, adresse, date_nais, lieu_nais, situation_fam, projet, prestation } = req.body;
    if (!nom || !prenom || !email) return res.status(400).json({ error: 'Nom, prénom et email obligatoires' });

    const existing = db.prepare('SELECT id FROM portal_inscriptions WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) return res.status(409).json({ error: 'Un compte avec cet email existe déjà' });

    const résultat = db.prepare(`
      INSERT INTO portal_inscriptions (nom,prenom,email,tel,adresse,date_nais,lieu_nais,situation_fam,projet,prestation,statut)
      VALEURS (?,?,?,?,?,?,?,?,?,?,'en_attente')
    `).run(nom.trim(), prenom.trim(), email.trim().toLowerCase(), tel||'', adresse||'', date_nais||'', lieu_nais||'', situation_fam||'', projet||'', prestation||'');

    res.json({ success: true, message: 'Demande reçue. Le cabinet vous contactera sous 48h.', id: result.lastInsertRowid });
  } attraper (e) {
    console.error('[portail/inscription]', e.message);
    res.status(500).json({ erreur: e.message });
  }
});

// POST /api/portal/login
router.post('/login', async (req, res) => {
  essayer {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

    const insc = db.prepare("SELECT * FROM portal_inscriptions WHERE email=? AND statut='validé'").get(email.trim().toLowerCase());
    if (!insc) return res.status(401).json({ error: 'Compte introuvable ou pas encore validé' });

    const ok = await bcrypt.compare(password, insc.password_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });

    const token = jwt.sign({ id : insc.id, email : insc.email, identifiant : insc.identifiant, type : 'portal' }, JWT_SECRET, { expiresIn : '7d' });
    res.json({ token, identifiant : insc.identifiant, prenom : insc.prenom, nom : insc.nom });
  } attraper (e) {
    console.error('[portal/login]', e.message);
    res.status(500).json({ erreur: e.message });
  }
});

// ============================================================
// ADMINISTRATION DES ROUTES — Inscriptions
// ============================================================

router.get('/inscriptions', requireAdmin, (req, res) => {
  essayer {
    const { statut } = req.query;
    soit q = 'SELECT * FROM portal_inscriptions';
    const p = [];
    if (statut) { q += ' OÙ statut=?'; p.push(statut); }
    q += ' ORDER BY created_at DESC';
    const list = db.prepare(q).all(...p);
    res.json({ inscriptions: liste, total: liste.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/inscriptions/:id', requireAdmin, (req, res) => {
  essayer {
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.params.id);
    if (!insc) return res.status(404).json({ error: 'Introuvable' });
    const client = insc.client_id ? db.prepare('SELECT * FROM clients WHERE id=?').get(insc.client_id) : null;
    res.json({ inscription : insc, client });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/valider/:id', requireAdmin, async (req, res) => {
  essayer {
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.params.id);
    if (!insc) return res.status(404).json({ error: 'Inscription introuvable' });
    if (insc.statut === 'validé') return res.status(400).json({ error: 'Déjà validé' });

    const année = new Date().getFullYear();
    const n = db.prepare("SELECT COUNT(*) as n FROM portal_inscriptions WHERE statut='validé'").get().n;
    const identifiant = `CCS-${année}-${String(n + 1).padStart(4, '0')}`;

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    soit tempPassword = '';
    pour (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];
    const hash = await bcrypt.hash(tempPassword, 10);

    soit clientId = insc.client_id;
    si (!clientId) {
      const initiales = ((insc.prenom[0]||'')+(insc.nom[0]||'')).toUpperCase();
      const COLORS = ['#D6EAF8','#D4EDDA','#FDEBD0','#E8D5F5','#FADBD8'];
      const TXTS = ['#1a5f8a','#1e8449','#8a5e05','#6c3483','#C0392B'];
      const ci = n % COLORS.length;
      const r = db.prepare(`INSERT INTO clients (nom,prenom,email,tel,adresse,date_nais,lieu_nais,situation_fam,projet,statut,profil,initials,color,text_color) VALEURS (?,?,?,?,?,?,?,?,?,'Prospect','À qualifier',?,?,?)`)
        .run(insc.nom,insc.prenom,insc.email,insc.tel,insc.adresse,insc.date_nais,insc.lieu_nais,insc.situation_fam,insc.projet,initials,COLORS[ci],TXTS[ci]);
      clientId = r.lastInsertRowid;
    }

    db.prepare(`UPDATE portal_inscriptions SET statut='validé',identifiant=?,password_hash=?,client_id=?,validated_at=datetime('now') WHERE id=?`)
      .run (identifiant, hachage, clientId, req.params.id);

    res.json({ success : true, identifiant, tempPassword, client_id : clientId, message : `Espace client créé — ${identifiant}` });
  } attraper (e) {
    console.error('[portal/valider]', e.message);
    res.status(500).json({ erreur: e.message });
  }
});

router.post('/rejeter/:id', requireAdmin, (req, res) => {
  essayer {
    const { motif } = req.body;
    db.prepare(`UPDATE portal_inscriptions SET statut='rejeté',notes_admin=?,rejected_at=datetime('now') WHERE id=?`).run(motif||'', req.params.id);
    res.json({ succès: vrai });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/inscriptions/:id/notes', requireAdmin, (req, res) => {
  essayer {
    db.prepare('UPDATE portal_inscriptions SET notes_admin=? WHERE id=?').run(req.body.notes||'', req.params.id);
    res.json({ succès: vrai });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ADMINISTRATION DES ROUTES — Documents clients
// ============================================================

router.get('/clients/:clientId/documents', requireAdmin, (req, res) => {
  essayer {
    const docs = db.prepare(`
      SELECT cd.*, u1.prenom||' '||u1.nom comme cree_par, u2.prenom||' '||u2.nom comme modifier_par
      FROM client_documents cd
      LEFT JOIN users u1 ON cd.created_by=u1.id
      LEFT JOIN users u2 ON cd.updated_by=u2.id
      WHERE cd.client_id=? TRIER PAR cd.updated_at DESC
    `).all(req.params.clientId);
    res.json({ documents: docs, total: docs.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/clients/:clientId/documents', requireAdmin, (req, res) => {
  essayer {
    const { nom, type, description, contenu_base64, visible_client } = req.body;
    if (!nom) return res.status(400).json({ error: 'Nom requis' });

    const clientId = req.params.clientId;
    const client = db.prepare('SELECT id FROM clients WHERE id=?').get(clientId);
    if (!client) return res.status(404).json({ error: 'Client inaccessible' });
    const insc = db.prepare('SELECT id FROM portal_inscriptions WHERE client_id=?').get(clientId);

    soit cheminStockage = '', taille = 0;
    si (contenu_base64) {
      const DOCS_PATH = process.env.DOCS_PATH || path.join(__dirname, '../../data/documents');
      const dir = path.join(DOCS_PATH, String(clientId));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `${Date.now()}_${nom.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const buf = Buffer.from(contenu_base64, 'base64');
      cheminStockage = chemin.join(dir, nom_de_fichier);
      fs.writeFileSync(cheminStockage, buf);
      taille = buf.longueur;
    }

    const r = db.prepare(`INSERT INTO client_documents (client_id,inscription_id,nom,type,description,chemin_stockage,taille,version,visible_client,created_by,updated_by) VALUES (?,?,?,?,?,?,?,1,?,?,?)`)
      .run(clientId, insc?insc.id:null, nom, type||'document', description||'', cheminStockage, taille, visible_client!==false?1:0, req.adminUser.id, req.adminUser.id);

    const doc = db.prepare('SELECT * FROM client_documents WHERE id=?').get(r.lastInsertRowid);
    res.status(201).json({ success: true, document: doc });
  } attraper (e) {
    console.error('[portal/documents/add]', e.message);
    res.status(500).json({ erreur: e.message });
  }
});

router.put('/documents/:id', requireAdmin, (req, res) => {
  essayer {
    const { nom, description, contenu_base64, visible_client } = req.body;
    const doc = db.prepare('SELECT * FROM client_documents WHERE id=?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });

    // Archiver la version précédente
    db.prepare('INSERT INTO document_versions (document_id,version,chemin_stockage,created_by) VALUES (?,?,?,?)')
      .run(doc.id, doc.version, doc.chemin_stockage, req.adminUser.id);

    const newVer = doc.version + 1;
    soit cheminStockage = doc.chemin_stockage, taille = doc.taille;

    si (contenu_base64) {
      const DOCS_PATH = process.env.DOCS_PATH || path.join(__dirname, '../../data/documents');
      const dir = path.join(DOCS_PATH, String(doc.client_id));
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const filename = `${Date.now()}_v${newVer}_${(nom||doc.nom).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const buf = Buffer.from(contenu_base64, 'base64');
      cheminStockage = chemin.join(dir, nom_de_fichier);
      fs.writeFileSync(cheminStockage, buf);
      taille = buf.longueur;
    }

    db.prepare(`UPDATE client_documents SET nom=?,description=?,chemin_stockage=?,taille=?,version=?,visible_client=?,updated_at=datetime('now'),updated_by=? WHERE id=?`)
      .run(nom||doc.nom, description!==undefined?description:doc.description, cheminStockage, taille, newVer, visible_client!==undefined?(visible_client?1:0):doc.visible_client, req.adminUser.id, doc.id);

    res.json({ success: true, document: db.prepare('SELECT * FROM client_documents WHERE id=?').get(doc.id), version: newVer });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/documents/:id', requireAdmin, (req, res) => {
  essayer {
    const doc = db.prepare('SELECT id FROM client_documents WHERE id=?').get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document introuvable' });
    db.prepare('DELETE FROM client_documents WHERE id=?').run(req.params.id);
    res.json({ succès: vrai });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/documents/:id/versions', requireAdmin, (req, res) => {
  essayer {
    const versions = db.prepare(`SELECT dv.*,u.prenom||' '||u.nom as cree_par FROM document_versions dv LEFT JOIN users u ON dv.created_by=u.id WHERE dv.document_id=? ORDER BY dv.version DESC`).all(req.params.id);
    res.json({ versions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/documents/:id/download', requireAdmin, (req, res) => {
  essayer {
    const doc = db.prepare('SELECT * FROM client_documents WHERE id=?').get(req.params.id);
    if (!doc || !doc.chemin_stockage || !fs.existsSync(doc.chemin_stockage)) return res.status(404).json({ error: 'Fichier introuvable' });
    res.download(doc.chemin_stockage, doc.nom);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', requireAdmin, (req, res) => {
  essayer {
    const total = db.prepare('SELECT COUNT(*) as n FROM portal_inscriptions').get().n;
    const enAttente = db.prepare("SELECT COUNT(*) as n FROM portal_inscriptions WHERE statut='en_attente'").get().n;
    const valides = db.prepare("SELECT COUNT(*) as n FROM portal_inscriptions WHERE statut='validé'").get().n;
    const rejetes = db.prepare("SELECT COUNT(*) as n FROM portal_inscriptions WHERE statut='rejeté'").get().n;
    res.json({ total, en_attente: enAttente, valides, rejetées });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// PORTAIL CLIENT DES ROUTES
// ============================================================

router.get('/mon-dossier', requirePortal, (req, res) => {
  essayer {
    const insc = db.prepare('SELECT * FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc) return res.status(404).json({ error: 'Dossier introuvable' });
    const client = insc.client_id ? db.prepare('SELECT id,nom,prenom,email,tel,projet,prestation,score,profil,statut FROM clients WHERE id=?').get(insc.client_id) : null;
    const { password_hash, ...safeInsc } = insc;
    res.json({ inscription : safeInsc, client });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/mes-documents', requirePortal, (req, res) => {
  essayer {
    const insc = db.prepare('SELECT client_id FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc || !insc.client_id) return res.json({ documents: [] });
    const docs = db.prepare('SELECT id,nom,type,description,taille,version,created_at,updated_at FROM client_documents WHERE client_id=? AND visible_client=1 ORDER BY updated_at DESC').all(insc.client_id);
    res.json({ documents: docs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/mes-documents/:id/download', requirePortal, (req, res) => {
  essayer {
    const insc = db.prepare('SELECT client_id FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (!insc || !insc.client_id) return res.status(403).json({ error: 'Accès refusé' });
    const doc = db.prepare('SELECT * FROM client_documents WHERE id=? AND client_id=? AND visible_client=1').get(req.params.id, insc.client_id);
    if (!doc || !doc.chemin_stockage || !fs.existsSync(doc.chemin_stockage)) return res.status(404).json({ erreur : 'Fichier indisponible' });
    res.download(doc.chemin_stockage, doc.nom);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/quiz', requirePortal, (req, res) => {
  essayer {
    const { réponses, score, profil, recommandations } = req.body;
    db.prepare('INSÉRER OU REMPLACER DANS quiz_resultats (inscription_id,réponses,score,profil,recommandations) VALEURS (?,?,?,?,?)')
      .run(req.portalUser.id, JSON.stringify(reponses||{}), score||0, profil||'', recommandations||'');
    const insc = db.prepare('SELECT client_id FROM portal_inscriptions WHERE id=?').get(req.portalUser.id);
    if (insc && insc.client_id) db.prepare('UPDATE clients SET score=?,profil=? WHERE id=?').run(score||0, profil||'À qualifier', insc.client_id);
    res.json({ succès : vrai, score, profil, recommandations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/commande', requirePortal, (req, res) => {
  essayer {
    const { offres, total, méthode_paiement } = req.body;
    db.prepare("INSERT INTO commandes (inscription_id,offres,total,methode_paiement,statut) VALUES (?,?,?,?,'en_attente')")
      .run(req.portalUser.id, JSON.stringify(offres||[]), total||0, methode_paiement||'');
    res.json({ success: true, message: 'Commande enregistrée. Nous vous contacterons sous 24h.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = routeur;
