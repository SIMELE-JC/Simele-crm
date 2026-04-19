const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Catalogue complet des services SIMELE avec tarifs
var SERVICES = {
  coaching: [
    { id: 'coaching3', label: 'Coaching entrepreneurial - 3 seances', tarif: '240,00 EUR', duree: '3 seances de 1h30' },
    { id: 'coaching5', label: 'Coaching entrepreneurial - 5 seances', tarif: '380,00 EUR', duree: '5 seances de 1h30' }
  ],
  conseil: [
    { id: 'diag', label: 'Diagnostic de projet', tarif: '80,00 EUR', duree: '1h30' },
    { id: 'bp', label: 'Business plan', tarif: '450,00 EUR', duree: 'Variable selon complexite' },
    { id: 'prev', label: 'Previsionnel financier', tarif: '350,00 EUR', duree: 'Variable selon complexite' },
    { id: 'fin', label: 'Dossier de financement', tarif: 'Sur devis', duree: 'Variable' },
    { id: 'sub', label: 'Dossier de subvention', tarif: 'Sur devis', duree: 'Variable' },
    { id: 'mandat', label: 'Mandat d\'accompagnement', tarif: 'Sur devis', duree: 'Variable' }
  ],
  packs: [
    { id: 'pack_essentiel', label: 'Pack Essentiel Creation', tarif: '590,00 EUR', contenu: 'Diagnostic + Business Plan' },
    { id: 'pack_financement', label: 'Pack Financement', tarif: '890,00 EUR', contenu: 'Business Plan + Previsionnel + Dossier financement' },
    { id: 'pack_global', label: 'Pack Global', tarif: '1 290,00 EUR', contenu: 'Pack complet - tous les services' }
  ]
};

// POST /api/contrats/prestation
router.post('/prestation', requireAuth, function(req, res) {
  try {
    var clientId = req.body.client_id;
    var c = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
    if (!c) return res.status(404).json({ error: 'Client introuvable' });

    var data = req.body;
    var nomClient = ((c.prenom || '') + ' ' + (c.nom || '')).trim();
    var adresseClient = data.adresse_client || c.adresse || '';

    // Service selectionne
    var serviceId = data.service_id || '';
    var serviceLabel = data.service_label || '';
    var serviceTarif = data.service_tarif || '';
    var serviceCategorie = data.service_categorie || '';
    var packDetail = data.pack_detail || '';

    // Complementaires
    var qualite = data.qualite || 'conseil';
    var dateDebut = data.date_debut || '';
    var dureeEstimee = data.duree_estimee || '';
    var dateFin = data.date_fin || '';
    var montant = data.montant || serviceTarif || '';
    var modalitePaiement = data.modalite_paiement || 'comptant';
    var nbFois = data.nb_fois || '';
    var acomptePercent = data.acompte_percent || '';
    var acompteEuros = data.acompte_euros || '';
    var successFee = data.success_fee || '';
    var mandatOptions = data.mandat_options || [];
    var lieuSignature = data.lieu_signature || 'Trois-Rivieres';
    var dateSignature = data.date_signature || new Date().toLocaleDateString('fr-FR');

    // --- Construire la description de la prestation selon la categorie ---
    var descPrestation = serviceLabel;
    var descContenu = '';
    if (serviceCategorie === 'coaching') {
      descContenu = '<ul style="margin:6px 0 6px 20px">' +
        '<li>Accompagnement personnalise en entrepreneuriat</li>' +
        '<li>Seances individuelles de 1h30 en presentiel ou visioconference</li>' +
        '<li>Bilan et plan d&#39;action apres chaque seance</li>' +
        '<li>Support entre les seances par email</li>' +
        '</ul>';
    } else if (serviceCategorie === 'pack') {
      var packObj = SERVICES.packs.find(function(p){ return p.id === serviceId; });
      descContenu = packObj ? '<p style="color:#666;font-size:12px">Contenu : ' + packObj.contenu + '</p>' : '';
    } else if (serviceCategorie === 'conseil') {
      descContenu = '<p style="color:#666;font-size:12px">Le prestataire est mandate pour accompagner le client dans la structuration, la preparation et/ou la realisation de son projet entrepreneurial.</p>';
    }

    // Lignes qualite prestataire
    var lignesQualite = [
      { val: 'conseil', label: 'Le prestataire agit en qualite de conseil uniquement' },
      { val: 'mandataire', label: 'Le prestataire agit en qualite de mandataire avec autorisation du client' }
    ].map(function(opt) {
      return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" ' + (qualite===opt.val?'checked':'') + ' disabled style="width:14px;height:14px"> ' + opt.label + '</div>';
    }).join('');

    // Lignes modalites paiement
    var lignesPaiement = '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" ' + (modalitePaiement==='comptant'?'checked':'') + ' disabled style="width:14px;height:14px"> Paiement comptant</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" ' + (modalitePaiement==='echelonne'?'checked':'') + ' disabled style="width:14px;height:14px"> Paiement en <strong>' + (nbFois||'___') + '</strong> fois</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" ' + (modalitePaiement==='acompte'?'checked':'') + ' disabled style="width:14px;height:14px"> Acompte de <strong>' + (acomptePercent||'___') + ' %</strong> soit <strong>' + (acompteEuros||'______') + ' EUR</strong></div>' +
      (successFee ? '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" checked disabled style="width:14px;height:14px"> Success fee : <strong>' + successFee + ' %</strong> du financement obtenu</div>' : '');

    // Lignes mandat
    var mandatItems = ['Representer le client aupres d&#39;organismes', 'Transmettre des documents en son nom', 'Echanger avec des partenaires'];
    var lignesMandat = mandatItems.map(function(m) {
      var checked = mandatOptions.indexOf(m) >= 0 ? 'checked' : '';
      return '<div style="display:flex;align-items:center;gap:8px;margin:4px 0">' +
        '<input type="checkbox" ' + checked + ' disabled style="width:14px;height:14px"> ' + m + '</div>';
    }).join('');

    var html = '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">' +
      '<title>Contrat de Prestation - ' + nomClient + '</title>' +
      '<style>' +
      'body{font-family:Arial,sans-serif;font-size:13px;color:#1b2d5b;max-width:800px;margin:0 auto;padding:40px;line-height:1.6}' +
      '.topbar{background:#1b2d5b;color:white;padding:10px 20px;margin:-40px -40px 30px;display:flex;justify-content:space-between;align-items:center}' +
      '.topbar button{background:#c9a96e;color:white;border:none;padding:8px 18px;border-radius:4px;cursor:pointer;font-weight:bold;font-size:13px}' +
      '@media print{.topbar{display:none}body{padding:20px}}' +
      'h1{text-align:center;font-size:16px;text-transform:uppercase;letter-spacing:2px;border-bottom:3px solid #1b2d5b;padding-bottom:15px;margin-bottom:25px}' +
      'h2{font-size:12px;text-transform:uppercase;font-weight:bold;margin:18px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px;color:#1b2d5b}' +
      '.parties{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:20px 0}' +
      '.partie{background:#f0f4f8;padding:15px;border-radius:6px}' +
      '.partie-title{font-weight:bold;color:#1b2d5b;margin-bottom:8px;font-size:11px;text-transform:uppercase;border-bottom:1px solid #c9a96e;padding-bottom:4px}' +
      '.service-box{background:#1b2d5b;color:white;padding:15px 20px;border-radius:8px;margin:15px 0}' +
      '.service-box .label{font-size:11px;color:#c9a96e;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}' +
      '.service-box .name{font-size:16px;font-weight:bold}' +
      '.service-box .tarif{font-size:20px;color:#c9a96e;font-weight:bold;margin-top:6px}' +
      '.signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:50px}' +
      '.sig-box{border-top:2px solid #1b2d5b;padding-top:8px}' +
      '.sig-space{height:70px}' +
      '</style></head><body>' +
      '<div class="topbar">' +
      '<div><strong>Cabinet de Conseils SIMELE</strong> &nbsp;|&nbsp; Contrat de Prestation</div>' +
      '<button onclick="window.print()">&#128424; Imprimer / PDF</button>' +
      '</div>' +
      '<h1>Contrat de Prestation de Services</h1>' +
      '<p style="text-align:center;font-size:12px;color:#888;margin-bottom:20px">Entre les soussignes :</p>' +
      '<div class="parties">' +
      '<div class="partie"><div class="partie-title">Le Prestataire</div>' +
      '<strong>Cabinet de Conseils SIMELE</strong><br>' +
      'Represente par Jean-Christophe Simele<br>' +
      '<span style="font-size:12px;color:#666">SIRET : 92787546800039<br>' +
      '20 lotissement Tolbiac 1<br>97114 Trois-Rivieres, Guadeloupe</span></div>' +
      '<div class="partie"><div class="partie-title">Le Client</div>' +
      '<strong>' + nomClient + '</strong><br>' +
      (adresseClient ? '<span style="font-size:12px;color:#444">' + adresseClient.split("\n").join('<br>') + '</span>' : '<span style="font-size:12px;color:#999">Adresse non renseignee</span>') +
      (c.email ? '<br><span style="font-size:12px;color:#666">' + c.email + '</span>' : '') +
      (c.tel ? '<br><span style="font-size:12px;color:#666">' + c.tel + '</span>' : '') +
      '</div></div>' +
      '<h2>Article 1 - Objet du contrat</h2>' +
      '<div class="service-box">' +
      '<div class="label">Prestation commandee</div>' +
      '<div class="name">' + descPrestation + '</div>' +
      (packDetail ? '<div style="font-size:12px;color:#ddd;margin-top:4px">Details : ' + packDetail + '</div>' : '') +
      '<div class="tarif">' + montant + '</div>' +
      '</div>' +
      descContenu +
      '<p>Le prestataire est mandate pour accompagner le client dans la structuration, la preparation et/ou la realisation de son projet entrepreneurial.</p>' +
      '<h2>Article 2 - Nature de la mission</h2>' +
      '<p>Le prestataire pourra etre amene a collecter et analyser les informations du client, rediger des documents, effectuer des demarches administratives, et etre en relation avec des organismes tiers.</p>' +
      lignesQualite +
      '<h2>Article 3 - Duree de la mission</h2>' +
      '<p>La mission debute le : <strong>' + (dateDebut||'____ / ____ / ______') + '</strong><br>' +
      'Duree estimee : <strong>' + (dureeEstimee||'__________________________') + '</strong><br>' +
      'Date previsionnelle de fin : <strong>' + (dateFin||'____ / ____ / ______') + '</strong></p>' +
      '<h2>Article 4 - Engagement du prestataire</h2>' +
      '<p>Le prestataire s'engage a realiser la prestation avec diligence et professionnalisme, mettre en oeuvre les moyens necessaires, et informer le client de l'avancement. <em>Obligation de moyens.</em></p>' +
      '<h2>Article 5 - Engagement du client</h2>' +
      '<p>Le client s'engage a fournir des informations exactes et completes, transmettre les documents necessaires, etre disponible pour les echanges et valider les elements transmis. <em>Tout retard peut impacter la mission.</em></p>' +
      '<h2>Article 6 - Tarifs et modalites de paiement</h2>' +
      '<p>Montant de la prestation : <strong style="font-size:16px;color:#1b2d5b">' + montant + '</strong></p>' +
      '<p>Modalites :</p>' + lignesPaiement +
      '<h2>Article 7 - Confidentialite</h2>' +
      '<p>Les parties s'engagent a une stricte confidentialite concernant les informations personnelles, donnees financieres, elements du projet et methodes du cabinet. Aucune information ne pourra etre divulguee sans accord ecrit. Cette obligation reste valable apres la fin du contrat.</p>' +
      '<h2>Article 8 - Mandat</h2>' +
      '<p>Dans le cadre de certaines prestations, le client autorise le prestataire a (si applicable) :</p>' +
      lignesMandat +
      '<h2>Article 9 - Propriete intellectuelle</h2>' +
      '<p>Les documents produits restent la propriete du prestataire jusqu'au paiement integral. Le client peut les utiliser uniquement pour son projet. Toute reproduction ou diffusion est interdite sans accord.</p>' +
      '<h2>Article 10 - Responsabilite</h2>' +
      '<p>Le client reste seul responsable des decisions prises, des informations transmises et des resultats du projet. Le prestataire ne garantit pas l'obtention de financements.</p>' +
      '<h2>Article 11 - Annulation / Resiliation</h2>' +
      '<p>En cas d'annulation : l'acompte reste du et les prestations realisees sont facturees. Le contrat peut etre resilie en cas de manquement d'une des parties.</p>' +
      '<h2>Article 12 - Acceptation</h2>' +
      '<p>Le present contrat prend effet a signature des deux parties.</p>' +
      '<hr style="margin:30px 0;border-color:#ddd">' +
      '<h2 style="text-align:center;border:none;font-size:14px">Signatures</h2>' +
      '<p style="text-align:center;margin-bottom:25px">Fait a : <strong>' + lieuSignature + '</strong> &nbsp;&nbsp; Le : <strong>' + dateSignature + '</strong></p>' +
      '<div class="signatures">' +
      '<div class="sig-box"><strong>Le Prestataire</strong><br>' +
      '<span style="font-size:12px;color:#666">Cabinet de Conseils SIMELE<br>Jean-Christophe Simele</span>' +
      '<div class="sig-space"></div>' +
      '<span style="font-size:11px;color:#999">Signature</span></div>' +
      '<div class="sig-box"><strong>Le Client</strong><br>' +
      '<span style="font-size:12px;color:#666">' + nomClient + '<br><em>Precede de "Lu et approuve"</em></span>' +
      '<div class="sig-space"></div>' +
      '<span style="font-size:11px;color:#999">Signature</span></div>' +
      '</div></body></html>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch(e) {
    console.error('Contrat error:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
