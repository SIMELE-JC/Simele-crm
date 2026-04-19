const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// POST /api/contrats/prestation — generer le contrat de prestation HTML
router.post('/prestation', requireAuth, function(req, res) {
  try {
    var clientId = req.body.client_id;
    var c = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    if (!c) return res.status(404).json({ error: 'Client introuvable' });

    // Champs du formulaire
    var data = req.body;
    var nomClient = (c.prenom || '') + ' ' + (c.nom || '');
    var adresseClient = data.adresse_client || c.adresse || '';

    // Article 1 — Prestation
    var prestations = data.prestations || [];
    var packDetail = data.pack_detail || '';
    var autreDetail = data.autre_detail || '';

    // Article 2 — Qualite prestataire
    var qualite = data.qualite || 'conseil';

    // Article 3 — Duree
    var dateDebut = data.date_debut || '';
    var dureeEstimee = data.duree_estimee || '';
    var dateFin = data.date_fin || '';

    // Article 6 — Tarifs
    var montant = data.montant || '';
    var modalitePaiement = data.modalite_paiement || 'comptant';
    var nbFois = data.nb_fois || '';
    var acomptePercent = data.acompte_percent || '';
    var acompteEuros = data.acompte_euros || '';
    var successFee = data.success_fee || '';

    // Article 8 — Mandat
    var mandatOptions = data.mandat_options || [];

    // Signatures
    var lieuSignature = data.lieu_signature || 'Trois-Rivieres';
    var dateSignature = data.date_signature || new Date().toLocaleDateString('fr-FR');

    // Generer les lignes de prestation
    var allPrestations = ['Business plan', 'Previsionnel financier', 'Dossier de financement', 'Dossier de subvention'];
    var lignesPrest = allPrestations.map(function(p) {
      var checked = prestations.indexOf(p) >= 0 ? 'checked' : '';
      return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" ' + checked + ' disabled style="width:14px;height:14px"> ' +
        '<span>' + p + '</span></div>';
    }).join('');
    if (prestations.indexOf('Pack') >= 0 || packDetail) {
      lignesPrest += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" checked disabled style="width:14px;height:14px"> ' +
        '<span>Pack (preciser) : <strong>' + (packDetail||'') + '</strong></span></div>';
    } else {
      lignesPrest += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" disabled style="width:14px;height:14px"> ' +
        '<span>Pack (preciser) : _____________________</span></div>';
    }
    if (prestations.indexOf('Autre') >= 0 || autreDetail) {
      lignesPrest += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" checked disabled style="width:14px;height:14px"> ' +
        '<span>Autre : <strong>' + (autreDetail||'') + '</strong></span></div>';
    } else {
      lignesPrest += '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" disabled style="width:14px;height:14px"> ' +
        '<span>Autre : _____________________</span></div>';
    }

    // Lignes qualite prestataire
    var lignesQualite = '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
      '<input type="checkbox" ' + (qualite==='conseil'?'checked':'') + ' disabled style="width:14px;height:14px"> ' +
      '<span>Le prestataire agit en qualite de conseil uniquement</span></div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
      '<input type="checkbox" ' + (qualite==='mandataire'?'checked':'') + ' disabled style="width:14px;height:14px"> ' +
      '<span>Le prestataire agit en qualite de mandataire avec autorisation du client</span></div>';

    // Lignes modalites paiement
    var lignesPaiement = '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
      '<input type="checkbox" ' + (modalitePaiement==='comptant'?'checked':'') + ' disabled style="width:14px;height:14px"> Paiement comptant</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
      '<input type="checkbox" ' + (modalitePaiement==='echelonne'?'checked':'') + ' disabled style="width:14px;height:14px"> Paiement en <strong>' + (nbFois||'___') + '</strong> fois</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
      '<input type="checkbox" ' + (modalitePaiement==='acompte'?'checked':'') + ' disabled style="width:14px;height:14px"> ' +
      'Acompte de <strong>' + (acomptePercent||'___') + ' %</strong> soit <strong>' + (acompteEuros||'______') + ' EUR</strong></div>' +
      (successFee ? '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
      '<input type="checkbox" checked disabled style="width:14px;height:14px"> Success fee : <strong>' + successFee + ' %</strong> du financement obtenu</div>' : '');

    // Lignes mandat
    var mandatItems = [
      'Representer le client aupres d&#39;organismes',
      'Transmettre des documents en son nom',
      'Echanger avec des partenaires'
    ];
    var lignesMandat = mandatItems.map(function(m) {
      var checked = mandatOptions.indexOf(m) >= 0 ? 'checked' : '';
      return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" ' + checked + ' disabled style="width:14px;height:14px"> ' + m + '</div>';
    }).join('');

    var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">' +
      '<title>Contrat de Prestation - ' + nomClient + '</title>' +
      '<style>' +
      'body { font-family: Arial, sans-serif; font-size: 13px; color: #1b2d5b; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.6; }' +
      '.topbar { background: #1b2d5b; color: white; padding: 10px 20px; margin: -40px -40px 30px; display: flex; justify-content: space-between; align-items: center; }' +
      '.topbar button { background: white; color: #1b2d5b; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold; }' +
      '@media print { .topbar { display: none; } body { padding: 20px; } }' +
      'h1 { text-align: center; font-size: 16px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 3px solid #1b2d5b; padding-bottom: 15px; margin-bottom: 25px; }' +
      'h2 { font-size: 13px; text-transform: uppercase; font-weight: bold; margin: 20px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }' +
      '.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }' +
      '.partie { background: #f0f4f8; padding: 15px; border-radius: 6px; }' +
      '.partie-title { font-weight: bold; color: #1b2d5b; margin-bottom: 8px; font-size: 12px; text-transform: uppercase; }' +
      '.article { margin: 15px 0; }' +
      '.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }' +
      '.sig-box { border-top: 1px solid #999; padding-top: 8px; }' +
      '.sig-title { font-weight: bold; margin-bottom: 5px; }' +
      '.sig-space { height: 60px; }' +
      '.gold { color: #c9a96e; }' +
      '</style></head><body>' +
      '<div class="topbar">' +
      '<span>Contrat de Prestation de Services - ' + nomClient + '</span>' +
      '<button onclick="window.print()">&#128424; Imprimer / Sauvegarder PDF</button>' +
      '</div>' +
      '<h1>Contrat de Prestation de Services</h1>' +
      '<p style="text-align:center;font-size:12px;color:#666;margin-bottom:20px">Entre les soussignes :</p>' +
      '<div class="parties">' +
      '<div class="partie">' +
      '<div class="partie-title">Le Prestataire</div>' +
      '<strong>Cabinet de Conseils SIMELE</strong><br>' +
      'Represente par Jean-Christophe Simele<br>' +
      'SIRET : 92787546800039<br>' +
      'Siege : 20 lotissement Tolbiac 1,<br>97114 Trois-Rivieres' +
      '</div>' +
      '<div class="partie">' +
      '<div class="partie-title">Le Client</div>' +
      '<strong>' + nomClient + '</strong><br>' +
      (adresseClient ? adresseClient.split("\n").join(
"<br>") : '<span style="color:#999">Adresse : _______________________</span>') +
      '</div></div>' +
      '<div class="article"><h2>Article 1 - Objet du contrat</h2>' +
      '<p>Le present contrat a pour objet la realisation de la prestation suivante :</p>' +
      lignesPrest + '</div>' +
      '<p style="font-size:12px;color:#444;margin-top:8px">Le prestataire est mandate pour accompagner le client dans la structuration, la preparation et/ou la realisation de son projet entrepreneurial.</p>' +
      '<div class="article"><h2>Article 2 - Nature de la mission</h2>' +
      '<p>Le prestataire pourra etre amene a :</p>' +
      '<ul style="margin:4px 0 8px 20px">' +
      '<li>Collecter et analyser les informations du client</li>' +
      '<li>Rediger des documents (business plan, dossiers de financement, etc.)</li>' +
      '<li>Effectuer des demarches administratives</li>' +
      '<li>Etre en relation avec des organismes tiers (banques, partenaires, etc.)</li></ul>' +
      lignesQualite + '</div>' +
      '<div class="article"><h2>Article 3 - Duree de la mission</h2>' +
      '<p>La mission debute le : <strong>' + (dateDebut||'____ / ____ / ______') + '</strong><br>' +
      'Duree estimee : <strong>' + (dureeEstimee||'__________________________') + '</strong><br>' +
      'Date previsionnelle de fin : <strong>' + (dateFin||'____ / ____ / ______') + '</strong></p></div>' +
      '<div class="article"><h2>Article 4 - Engagement du prestataire</h2>' +
      '<p>Le prestataire s&#39;engage a :</p>' +
      '<ul style="margin:4px 0 8px 20px">' +
      '<li>Realiser la prestation avec diligence et professionnalisme</li>' +
      '<li>Mettre en oeuvre les moyens necessaires a la mission</li>' +
      '<li>Informer le client de l&#39;avancement</li></ul>' +
      '<p><em>Le prestataire est tenu a une obligation de moyens.</em></p></div>' +
      '<div class="article"><h2>Article 5 - Engagement du client</h2>' +
      '<p>Le client s&#39;engage a :</p>' +
      '<ul style="margin:4px 0 8px 20px">' +
      '<li>Fournir des informations exactes, completes et a jour</li>' +
      '<li>Transmettre les documents necessaires</li>' +
      '<li>Etre disponible pour les echanges</li>' +
      '<li>Valider les elements transmis</li></ul>' +
      '<p><em>Tout retard dans la transmission des elements peut impacter la mission.</em></p></div>' +
      '<div class="article"><h2>Article 6 - Tarifs et modalites de paiement</h2>' +
      '<p>Montant de la prestation : <strong style="font-size:15px;color:#1b2d5b">' + (montant?montant+' EUR':'__________________ EUR') + '</strong></p>' +
      '<p>Modalites :</p>' + lignesPaiement + '</div>' +
      '<div class="article"><h2>Article 7 - Confidentialite</h2>' +
      '<p>Les parties s&#39;engagent a une stricte confidentialite concernant :</p>' +
      '<ul style="margin:4px 0 8px 20px">' +
      '<li>Les informations personnelles</li>' +
      '<li>Les donnees financieres</li>' +
      '<li>Les elements du projet</li>' +
      '<li>Les methodes et outils du cabinet</li></ul>' +
      '<p>Aucune information ne pourra etre divulguee sans accord ecrit.<br>' +
      '<em>Cette obligation reste valable apres la fin du contrat.</em></p></div>' +
      '<div class="article"><h2>Article 8 - Mandat (Tres important)</h2>' +
      '<p>Dans le cadre de certaines prestations, le client autorise le prestataire a (cocher si applicable) :</p>' +
      lignesMandat + '</div>' +
      '<div class="article"><h2>Article 9 - Propriete intellectuelle</h2>' +
      '<p>Les documents produits restent la propriete du prestataire jusqu&#39;au paiement integral.<br>' +
      'Le client peut les utiliser uniquement pour son projet.<br>' +
      'Toute reproduction ou diffusion est interdite sans accord.</p></div>' +
      '<div class="article"><h2>Article 10 - Responsabilite</h2>' +
      '<p>Le client reste seul responsable :</p>' +
      '<ul style="margin:4px 0 8px 20px">' +
      '<li>des decisions prises</li>' +
      '<li>des informations transmises</li>' +
      '<li>des resultats du projet</li></ul>' +
      '<p><em>Le prestataire ne garantit pas l&#39;obtention de financements.</em></p></div>' +
      '<div class="article"><h2>Article 11 - Annulation / Resiliation</h2>' +
      '<p>En cas d&#39;annulation :</p>' +
      '<ul style="margin:4px 0 8px 20px">' +
      '<li>L&#39;acompte reste du</li>' +
      '<li>Les prestations realisees sont facturees</li></ul>' +
      '<p>Le contrat peut etre resilie en cas de manquement d&#39;une des parties.</p></div>' +
      '<div class="article"><h2>Article 12 - Acceptation</h2>' +
      '<p>Le present contrat prend effet a signature.</p></div>' +
      '<hr style="margin:30px 0;border-color:#ccc">' +
      '<h2 style="text-align:center">Signatures</h2>' +
      '<p style="text-align:center">Fait a : <strong>' + lieuSignature + '</strong> &nbsp;&nbsp; Le : <strong>' + dateSignature + '</strong></p>' +
      '<div class="signatures">' +
      '<div class="sig-box">' +
      '<div class="sig-title">Le Prestataire</div>' +
      '<div style="font-size:12px;color:#666">Cabinet de Conseils SIMELE<br>Jean-Christophe Simele</div>' +
      '<div class="sig-space"></div>' +
      '<div style="font-size:11px;color:#999;border-top:1px solid #ccc;padding-top:5px">Signature</div>' +
      '</div>' +
      '<div class="sig-box">' +
      '<div class="sig-title">Le Client</div>' +
      '<div style="font-size:12px;color:#666">' + nomClient + '<br><em>Preceded de la mention "Lu et approuve"</em></div>' +
      '<div class="sig-space"></div>' +
      '<div style="font-size:11px;color:#999;border-top:1px solid #ccc;padding-top:5px">Signature</div>' +
      '</div></div>' +
      '</body></html>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) {
    console.error('Contrat prestation error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
