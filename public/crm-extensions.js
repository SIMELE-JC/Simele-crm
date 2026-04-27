/* =============================================================
   CRM SIMELE — Extensions v3
   - Contrat : apercu + sauvegarde dossier
   - Documents : apercu, telechargement, renommer, classifier
   - Programme : selection client + service + impression
   - Coaching : navigation bloc par bloc + brouillon + save
   - Entretien : sauvegarde score corrigee
   ============================================================= */

/* ----------------------------------------------------------------
   UTILITAIRES
   ---------------------------------------------------------------- */
window.fermerModalContrat = function() {
  var m = document.getElementById("modal-contrat-preview");
  if (m) m.remove();
};

/* ----------------------------------------------------------------
   CONTRAT : Apercu dans une modale + Enregistrement dans le dossier
   ---------------------------------------------------------------- */
window.genererContratPrestation = function() {
  var id = window._currentDocsClientId;
  if (!id) {
    var sel = document.getElementById("docs-global-client-select");
    if (sel && sel.value) { window.changerClientDocs(sel.value); id = window._currentDocsClientId; }
  }
  if (!id) { alert("Veuillez selectionner un client."); return; }
  var client = typeof getClientById === "function" ? getClientById(id) : null;
  if (!client) { alert("Client introuvable."); return; }
  var montantEl = document.getElementById("montant_cp");
  var service = window._selectedService || {};
  var seances = service.seances || "3";
  var prix = (montantEl && montantEl.value) ? (montantEl.value + " EUR") : (service.prix || "210 EUR");
  var adresseEl = document.getElementById("adresse_client_cp");
  var adresse = (adresseEl && adresseEl.value) || client.adresse || "_______________";
  var clientData = { prenom: client.prenom, nom: client.nom, adresse: adresse };
  var contratHTML = typeof contratBase === "function" ? contratBase(seances, prix, clientData) : "<p>Erreur: contratBase manquant</p>";
  window._currentContratHTML = contratHTML;
  window._currentContratClient = client;
  window._currentContratClientId = id;
  var old = document.getElementById("modal-contrat-preview");
  if (old) old.remove();
  var modal = document.createElement("div");
  modal.id = "modal-contrat-preview";
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box";
  var box = document.createElement("div");
  box.style.cssText = "background:white;border-radius:12px;width:100%;max-width:860px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4)";
  var hdr = document.createElement("div");
  hdr.style.cssText = "padding:16px 20px;background:#1b2d5b;color:white;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0";
  hdr.innerHTML = '<div><div style="font-size:16px;font-weight:700">Apercu du contrat</div>'
    + '<div style="font-size:12px;opacity:0.8">' + client.prenom + " " + client.nom
    + " &mdash; " + (service.label || "Contrat de prestation") + "</div></div>";
  var bRow = document.createElement("div");
  bRow.style.cssText = "display:flex;gap:10px";
  var bPrint = document.createElement("button");
  bPrint.style.cssText = "background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600";
  bPrint.innerHTML = "&#128196; Imprimer";
  bPrint.onclick = function() { window.printContrat(); };
  var bSave = document.createElement("button");
  bSave.style.cssText = "background:#c9a96e;color:white;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600";
  bSave.innerHTML = "&#128190; Enregistrer dans le dossier";
  bSave.onclick = function() { window.sauvegarderContrat(window._currentContratClientId); };
  var bClose = document.createElement("button");
  bClose.style.cssText = "background:rgba(255,255,255,0.15);color:white;border:none;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:18px;line-height:1";
  bClose.innerHTML = "&#10005;";
  bClose.onclick = function() { window.fermerModalContrat(); };
  bRow.appendChild(bPrint); bRow.appendChild(bSave); bRow.appendChild(bClose);
  hdr.appendChild(bRow); box.appendChild(hdr);
  var body = document.createElement("div");
  body.style.cssText = "flex:1;overflow-y:auto";
  var iframe = document.createElement("iframe");
  iframe.id = "contrat-iframe";
  iframe.style.cssText = "width:100%;height:600px;border:none";
  body.appendChild(iframe); box.appendChild(body); modal.appendChild(box);
  document.body.appendChild(modal);
  iframe.srcdoc = contratHTML;
};

window.printContrat = function() {
  var ifrm = document.getElementById("contrat-iframe");
  if (ifrm && ifrm.contentWindow) { ifrm.contentWindow.print(); }
};

window.sauvegarderContrat = function(clientId) {
  var html = window._currentContratHTML;
  var client = window._currentContratClient || {};
  if (!html) { alert("Aucun contrat genere."); return; }
  var nom = "Contrat_" + (client.nom || "client") + "_" + new Date().toISOString().slice(0, 10) + ".html";
  var blob = new Blob([html], { type: "text/html" });
  var file = new File([blob], nom, { type: "text/html" });
  var fd = new FormData();
  fd.append("fichier", file, nom); fd.append("type", "contrat");
  fd.append("nom", nom); fd.append("visible_client", "1");
  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/documents/client/" + clientId, { method: "POST", headers: { "Authorization": "Bearer " + tok }, body: fd })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        if (typeof showToast === "function") showToast("Contrat enregistre dans le dossier !", true);
        window.fermerModalContrat();
        if (typeof window.chargerDocuments === "function") window.chargerDocuments();
      } else { if (typeof showToast === "function") showToast("Erreur: " + (d.error || ""), false); }
    }).catch(function() { if (typeof showToast === "function") showToast("Erreur reseau.", false); });
};

/* ----------------------------------------------------------------
   DOCUMENTS : Liste avec apercu, download, rename, classify
   ---------------------------------------------------------------- */
window.chargerDocuments = function() {
  var id = window._currentDocsClientId;
  var container = document.getElementById("docs-list-container");
  if (!id || !container) return;
  var tok = localStorage.getItem("simele_token") || "";
  container.innerHTML = "<p style='text-align:center;color:#999;padding:20px'>Chargement...</p>";
  fetch("/api/documents/client/" + id, { headers: { "Authorization": "Bearer " + tok } })
    .then(function(r) { return r.json(); })
    .then(function(docs) {
      if (!Array.isArray(docs) || !docs.length) {
        container.innerHTML = "<div style='text-align:center;padding:30px;color:#999'><div style='font-size:48px;margin-bottom:12px'>&#128193;</div><p style='font-size:14px'>Aucun document pour ce client.</p><p style='font-size:12px'>Utilisez la zone ci-dessus pour ajouter un fichier.</p></div>";
        return;
      }
      var tl = { fiche:"Fiche/CR",devis:"Devis",contrat:"Contrat",identite:"Identite",siege:"Siege social",activite:"Activite",gestion:"Gestion",autre:"Autre",document:"Document",rapport:"Rapport",facture:"Facture" };
      var tc = { fiche:"#9b59b6",devis:"#3498db",contrat:"#2ecc71",identite:"#e67e22",siege:"#1abc9c",activite:"#e74c3c",gestion:"#95a5a6",autre:"#7f8c8d",document:"#95a5a6",rapport:"#8e44ad",facture:"#f39c12" };
      var ei = { pdf:"&#128196;",doc:"&#128196;",docx:"&#128196;",xls:"&#128200;",xlsx:"&#128200;",jpg:"&#128247;",jpeg:"&#128247;",png:"&#128247;",gif:"&#128247;",txt:"&#128196;",html:"&#127760;" };
      var html2 = "<div style='display:flex;flex-direction:column;gap:8px'>";
      docs.forEach(function(doc) {
        var ext = (doc.nom || "").split(".").pop().toLowerCase();
        var icon = ei[ext] || "&#128193;";
        var color = tc[doc.type] || "#95a5a6";
        var label = tl[doc.type] || doc.type || "Document";
        var size = doc.taille > 0 ? (doc.taille > 1048576 ? (doc.taille/1048576).toFixed(1)+"Mo" : Math.round(doc.taille/1024)+"Ko") : "";
        var date = doc.created_at ? doc.created_at.slice(0, 10) : "";
        var canP = ["pdf","jpg","jpeg","png","gif","html"].includes(ext);
        var safeNom = (doc.nom || "").replace(/\\/g,"\\\\").replace(/'/g,"\\'");
        var btnP = canP ? "<button onclick=\"window.previewDoc("+doc.id+")\" title='Apercu' style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px'>&#128269;</button>" : "";
        var btnD = "<a href='/api/documents/"+doc.id+"/download' target='_blank' title='Telecharger' style='background:#e8f4fd;border:1px solid #3498db;border-radius:6px;padding:6px 10px;font-size:12px;color:#3498db;text-decoration:none;display:inline-flex;align-items:center'>&#8659;</a>";
        var btnR = "<button onclick=\"window.renommerDoc("+doc.id+",'"+safeNom+"')\" title='Renommer' style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px'>&#9998;</button>";
        var btnT = "<button onclick=\"window.reclassifierDoc("+doc.id+")\" title='Changer le type' style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px'>&#127991;</button>";
        var btnX = "<button onclick=\"window.supprimerDoc("+doc.id+")\" title='Supprimer' style='background:#fdf0f0;border:1px solid #e74c3c;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;color:#e74c3c'>&#128465;</button>";
        html2 += "<div id='docrow"+doc.id+"' style='background:white;border:1px solid #e8eaed;border-left:4px solid "+color+";border-radius:8px;padding:12px 14px'>"
          + "<div style='display:flex;align-items:center;gap:10px'>"
          + "<span style='font-size:22px'>"+icon+"</span>"
          + "<div style='flex:1;min-width:0'>"
          + "<div style='font-size:13px;font-weight:600;color:#1b2d5b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>"+doc.nom+"</div>"
          + "<div style='display:flex;gap:8px;align-items:center;margin-top:3px'>"
          + "<span style='background:"+color+";color:white;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600'>"+label+"</span>"
          + (size?"<span style='font-size:11px;color:#999'>"+size+"</span>":"")
          + (date?"<span style='font-size:11px;color:#999'>"+date+"</span>":"")
          + "</div></div>"
          + "<div style='display:flex;gap:6px;flex-shrink:0'>"+btnP+btnD+btnR+btnT+btnX+"</div>"
          + "</div></div>";
      });
      html2 += "</div>";
      container.innerHTML = html2;
    }).catch(function(e) { container.innerHTML = "<p style='color:red;text-align:center;padding:20px'>Erreur: "+e.message+"</p>"; });
};

window.previewDoc = function(docId) {
  var url = "/api/documents/" + docId + "/download";
  var w = window.open(url, "_blank");
  if (!w) alert("Autorisez les popups pour visualiser les documents.");
};

window.renommerDoc = function(docId, oldNom) {
  var newNom = prompt("Nouveau nom du document :", oldNom || "");
  if (!newNom || newNom === oldNom) return;
  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/documents/" + docId, { method:"PUT", headers:{"Authorization":"Bearer "+tok,"Content-Type":"application/json"}, body:JSON.stringify({nom:newNom,visible_client:1}) })
    .then(function(r){return r.json();}).then(function(d){
      if(d.success){if(typeof showToast==="function")showToast("Document renomme.",true);window.chargerDocuments();}
      else{if(typeof showToast==="function")showToast("Erreur.",false);}
    });
};

window.reclassifierDoc = function(docId) {
  var types = [["fiche","Fiche / CR / Rapport"],["devis","Devis"],["contrat","Contrat"],["identite","Justificatif d'identite"],["siege","Justificatif de siege social"],["activite","Justificatif d'activite"],["gestion","Document de gestion diverse"],["autre","Autre document"]];
  var msg = "Choisir le nouveau type:\n" + types.map(function(t,i){return (i+1)+". "+t[1];}).join("\n") + "\n\nEntrez le numero :";
  var choice = prompt(msg);
  if (!choice) return;
  var idx = parseInt(choice) - 1;
  if (isNaN(idx)||idx<0||idx>=types.length) { if(typeof showToast==="function")showToast("Choix invalide.",false); return; }
  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/documents/" + docId, { method:"PUT", headers:{"Authorization":"Bearer "+tok,"Content-Type":"application/json"}, body:JSON.stringify({type:types[idx][0],visible_client:1}) })
    .then(function(r){return r.json();}).then(function(d){if(d.success){if(typeof showToast==="function")showToast("Type modifie.",true);window.chargerDocuments();}});
};

window.supprimerDoc = function(docId) {
  if (!confirm("Supprimer ce document ? Cette action est irreversible.")) return;
  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/documents/" + docId, { method:"DELETE", headers:{"Authorization":"Bearer "+tok} })
    .then(function(r){return r.json();}).then(function(d){
      if(d.success){if(typeof showToast==="function")showToast("Supprime.",true);window.chargerDocuments();}
      else{if(typeof showToast==="function")showToast("Erreur suppression.",false);}
    });
};

/* ----------------------------------------------------------------
   PROGRAMME : Selection client + service + impression fiche
   ---------------------------------------------------------------- */
window.updateProgramme = function() {
  var cSel = document.getElementById("prog-client-select");
  var sSel = document.getElementById("prog-service-select");
  var cnt  = document.getElementById("programme-content");
  if (!cnt) return;
  var cId = cSel ? cSel.value : "";
  var sId = sSel ? sSel.value : "";
  if (!cId || !sId) {
    cnt.innerHTML = "<div style='text-align:center;padding:60px;color:#999'><div style='font-size:48px;margin-bottom:16px'>&#127963;</div><div style='font-size:16px;font-weight:600'>Selectionnez un client et un service</div></div>";
    return;
  }
  var client = typeof getClientById === "function" ? getClientById(parseInt(cId)) : null;
  if (!client) return;
  var today = new Date().toLocaleDateString("fr-FR");
  var PROGS = {
    coaching3: { titre:"Coaching Strategique - 3 Seances", prix:"210 EUR", seances:[
      {n:1,t:"Structuration du projet & environnement",d:"2h30-3h",pts:["Analyse du projet et simplification","Identification de la cible client et positionnement de l'offre","Presentation des statuts juridiques (SASU, EURL, micro-entreprise...)","Demarches d'immatriculation et obligations URSSAF","Identification des organismes sociaux et fiscaux"],r:"Projet clair - Orientation juridique - Vision de lancement"},
      {n:2,t:"Strategie & dispositifs d'aide",d:"2h30-3h",pts:["Identification des besoins financiers","Analyse des dispositifs d'aide (ACRE, NACRE, LADOM, ARCE...)","Strategie de lancement progressive","Plan d'action structure avec jalons cles","Conseils pratiques et orientation"],r:"Strategie optimisee - Aides identifiees - Plan d'action"},
      {n:3,t:"Structuration financiere & projection",d:"2h30-3h",pts:["Aides a la creation et conditions d'eligibilite","Introduction au previsionnel financier 3 ans","Structuration des prix et marges","Preparation aux demandes de financement bancaire"],r:"Vision financiere claire - Projet credible et structure"}
    ]},
    coaching5: { titre:"Coaching Strategique - 5 Seances", prix:"320 EUR", seances:[
      {n:1,t:"Structuration du projet",d:"2h30-3h",pts:["Analyse du concept","Cible client et positionnement","Statuts juridiques adaptes"],r:"Projet structure"},
      {n:2,t:"Strategie et aides",d:"2h30-3h",pts:["Dispositifs d'aide mobilisables","Plan de lancement progressif"],r:"Aides identifiees"},
      {n:3,t:"Structuration financiere",d:"2h30-3h",pts:["Previsionnel sur 3 ans","Prix et marges"],r:"Vision financiere"},
      {n:4,t:"Suivi et ajustements",d:"2h30-3h",pts:["Bilan des avancees","Ajustements strategiques"],r:"Projet optimise"},
      {n:5,t:"Finalisation et lancement",d:"2h30-3h",pts:["Revue complete du dossier","Plan de lancement definitif","Mise en reseau"],r:"Pret au lancement"}
    ]},
    diag:{titre:"Diagnostic de Projet",prix:"80 EUR",seances:[{n:1,t:"Diagnostic complet",d:"1h30",pts:["Analyse de viabilite du concept","Etude rapide du marche cible","Identification des forces et faiblesses","Recommandations concretes et prioritaires"],r:"Vision claire des axes d'amelioration"}]},
    bp:{titre:"Business Plan Complet",prix:"450 EUR",seances:[{n:1,t:"Collecte et analyse",d:"2h",pts:["Recueil des informations cles","Analyse du marche et de la concurrence","Validation des hypotheses"],r:"Base solide pour la redaction"},{n:2,t:"Redaction et livraison",d:"Variable",pts:["Redaction complete du business plan","Relecture et ajustements","Livraison du document final"],r:"Business plan professionnel pret a l'emploi"}]},
    prev:{titre:"Previsionnel Financier 3 ans",prix:"350 EUR",seances:[{n:1,t:"Collecte des donnees",d:"1h30",pts:["Hypotheses de chiffre d'affaires","Charges fixes et variables","Estimation du BFR"],r:"Donnees validees"},{n:2,t:"Construction et livraison",d:"Variable",pts:["Compte de resultat previsionnel","Plan de tresorerie","Livraison sous Excel"],r:"Previsionnel financier complet sur 3 ans"}]}
  };
  var prog = PROGS[sId];
  if (!prog) {
    var optTxt = (sSel && sSel.options[sSel.selectedIndex]) ? sSel.options[sSel.selectedIndex].text : "Service sur mesure";
    prog = { titre:optTxt, prix:"Sur devis", seances:[{n:1,t:"Programme sur mesure",d:"Variable",pts:["Programme adapte a vos besoins specifiques","Contenu defini en concertation avec le client"],r:"Programme personnalise"}] };
  }
  var sh = prog.seances.map(function(s) {
    return "<div style='border:1px solid #e0e0e0;border-left:4px solid #1b2d5b;border-radius:8px;padding:16px;margin-bottom:12px'>"
      +"<div style='display:flex;align-items:center;gap:12px;margin-bottom:10px'>"
      +"<div style='background:#1b2d5b;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0'>"+s.n+"</div>"
      +"<div><div style='font-size:15px;font-weight:700;color:#1b2d5b'>"+s.t+"</div><div style='font-size:12px;color:#c9a96e;font-weight:600'>Duree : "+s.d+"</div></div></div>"
      +"<ul style='margin:0 0 10px 20px;padding:0'>"+s.pts.map(function(p){return "<li style='font-size:13px;color:#444;margin-bottom:4px'>"+p+"</li>";}).join("")+"</ul>"
      +"<div style='background:#f0f4f8;border-radius:6px;padding:8px 12px;font-size:12px;color:#1b2d5b'><strong>Resultat attendu :</strong> "+s.r+"</div>"
      +"</div>";
  }).join("");
  cnt.innerHTML = "<div style='background:white;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06)'>"
    +"<div id='prog-print-area'>"
    +"<div style='display:flex;justify-content:space-between;align-items:start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1b2d5b'>"
    +"<div><div style='font-size:11px;color:#c9a96e;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px'>Cabinet de Conseils SIMELE</div>"
    +"<div style='font-size:22px;font-weight:700;color:#1b2d5b'>"+prog.titre+"</div></div>"
    +"<div style='text-align:right'>"
    +"<div style='background:#1b2d5b;color:white;padding:8px 16px;border-radius:8px;font-size:12px;margin-bottom:6px'>&#128100; "+client.prenom+" "+client.nom+"</div>"
    +"<div style='font-size:20px;font-weight:700;color:#c9a96e'>"+prog.prix+"</div>"
    +"<div style='font-size:11px;color:#999'>"+today+"</div></div></div>"
    +sh
    +"<div style='margin-top:16px;padding:16px;background:#f8f9fa;border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:16px'>"
    +"<div><div style='font-size:12px;font-weight:700;color:#c9a96e;margin-bottom:8px'>BENEFICES</div><ul style='margin:0 0 0 16px;font-size:12px;color:#555'><li>Gain de temps sur les demarches</li><li>Eviter les erreurs couteuses</li><li>Bonnes decisions strategiques</li><li>Securiser le lancement</li></ul></div>"
    +"<div><div style='font-size:12px;font-weight:700;color:#c9a96e;margin-bottom:8px'>CABINET</div><div style='font-size:12px;color:#555'>Jean-Christophe Simele<br>SIRET : 92787546800039<br>20 lot. Tolbiac 1<br>97114 Trois-Rivieres</div></div>"
    +"</div></div></div>";
};

window.imprimerProgramme = function() {
  var area = document.getElementById("prog-print-area");
  if (!area) { alert("Selectionnez un client et un service d'abord."); return; }
  var w = window.open("", "_blank");
  w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Programme SIMELE</title><style>body{font-family:Arial,sans-serif;margin:30px;font-size:13px}ul{margin:6px 0 6px 20px}li{margin:3px 0}@media print{body{margin:15px}}</style></head><body>"+area.innerHTML+"</body></html>");
  w.document.close(); setTimeout(function(){w.print();},500);
};

/* Populate client select when programme page opens */
(function() {
  var _sp = window.showPage;
  window.showPage = function(id, clientId) {
    if (typeof _sp === "function") _sp(id, clientId);
    if (id === "programme") {
      setTimeout(function() {
        var sel = document.getElementById("prog-client-select");
        if (sel && typeof clients !== "undefined" && clients.length && sel.options.length <= 1) {
          clients.forEach(function(c) { var o=document.createElement("option"); o.value=c.id; o.textContent=c.prenom+" "+c.nom; sel.appendChild(o); });
        }
        if (sel && typeof currentClientId !== "undefined" && currentClientId) { sel.value=currentClientId; window.updateProgramme(); }
      }, 300);
    }
  };
})();

/* ----------------------------------------------------------------
   COACHING : Navigation bloc par bloc + brouillon + validation
   ---------------------------------------------------------------- */

/* State courant du coaching en cours */
window._coachingBlocCourant = {};  /* clientId -> num seance -> bloc courant (0-indexed) */

/* Override renderCoachingSeance pour navigation bloc par bloc */
window.renderCoachingSeance = function(clientId, num) {
  var client = typeof getClientById === "function" ? getClientById(clientId) : null;
  var si = typeof SEANCE_DATA !== "undefined" ? SEANCE_DATA[num] : null;
  if (!si || !client) return;
  var sessions = (window._coachingData && window._coachingData[clientId]) || {};
  var session = sessions[num] || {};
  var el = document.getElementById("coaching-content");
  if (!el) return;

  /* Quel bloc afficher ? Reprendre au dernier sauvegarde ou debut */
  var key = clientId + "_" + num;
  if (!window._coachingBlocCourant[key]) window._coachingBlocCourant[key] = 0;
  var blocIdx = window._coachingBlocCourant[key];
  var totalBlocs = si.blocs.length;

  function savedBloc(n) { try { return JSON.parse(session["bloc"+n]||"{}"); } catch(e){ return {}; } }

  function renderBloc(bIdx) {
    window._coachingBlocCourant[key] = bIdx;
    var bloc = si.blocs[bIdx];
    var isLast = (bIdx === totalBlocs - 1);
    var statut = session.statut || "en_cours";
    var pct = Math.round(((bIdx+1)/totalBlocs)*100);

    var html = "<div style='max-width:800px;margin:20px auto;padding:0 20px 60px 20px'>";

    /* Header sticky */
    html += "<div style='position:relative;background:white;padding:12px 0 10px;border-bottom:2px solid #1b2d5b;margin-bottom:20px'>";
    html += "<div style='display:flex;align-items:center;gap:10px;margin-bottom:8px'>";
    html += "<button onclick='renderCoachingPage()' style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:12px;color:#666'>&#8592; Retour</button>";
    html += "<div style='flex:1'><div style='font-size:16px;font-weight:700;color:#1b2d5b'>"+si.titre+"</div>";
    html += "<div style='font-size:11px;color:#999'>"+si.duree+" &middot; "+client.prenom+" "+client.nom+"</div></div>";
    html += "<select id='statut-seance' style='padding:6px 10px;border-radius:6px;border:1px solid #ddd;font-size:12px;color:#1b2d5b'>";
    html += "<option value='en_cours'"+(statut==='en_cours'?' selected':'')+">En cours</option>";
    html += "<option value='terminee'"+(statut==='terminee'?' selected':'')+">Terminee</option></select>";
    html += "</div>";
    /* Barre de progression */
    html += "<div style='display:flex;align-items:center;gap:8px'>";
    html += "<div style='flex:1;background:#f0f0f0;border-radius:10px;height:6px'><div style='background:#1b2d5b;width:"+pct+"%;height:6px;border-radius:10px;transition:width 0.3s'></div></div>";
    html += "<span style='font-size:11px;color:#666;white-space:nowrap;font-weight:600'>Bloc "+(bIdx+1)+"/"+totalBlocs+"</span>";
    /* Pastilles blocs */
    html += "<div style='display:flex;gap:4px'>";
    for (var pi=0;pi<totalBlocs;pi++) {
      var isActive=(pi===bIdx), isSaved=!!(session["bloc"+(pi+1)]);
      var bg = isActive?"#1b2d5b":(isSaved?"#c9a96e":"#e0e0e0");
      var txtColor = (isActive||isSaved)?"white":"#999";
      html += "<div onclick='(function(){window._coachingBlocCourant[\""+key+"\"]="+(pi)+";window.renderCoachingSeance("+clientId+","+num+");})()' style='width:22px;height:22px;border-radius:50%;background:"+bg+";color:"+txtColor+";font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s'>"+(pi+1)+"</div>";
    }
    html += "</div></div></div>"; /* end header */

    /* Bloc actif */
    html += "<div style='background:white;border:1px solid #e0e0e0;border-left:4px solid "+si.couleur+";border-radius:10px;padding:20px;margin-bottom:16px'>";
    html += "<div style='font-size:15px;font-weight:700;color:"+si.couleur+";margin-bottom:16px'>"+bloc.t+"</div>";
    var savedData = savedBloc(bIdx+1);
    for (var qi=0;qi<bloc.q.length;qi++) {
      var savedVal = savedData["q"+qi] || "";
      html += "<div style='margin-bottom:16px'>";
      html += "<label style='display:block;font-size:13px;font-weight:600;color:#333;margin-bottom:6px'>"+(qi+1)+". "+bloc.q[qi]+"</label>";
      html += "<textarea id='b"+(bIdx+1)+"_q"+qi+"' rows='2' style='width:100%;padding:7px 10px;border:1px solid #ddd;border-radius:8px;font-size:13px;resize:vertical;font-family:inherit;box-sizing:border-box;line-height:1.5' placeholder='Votre reponse...'>" + savedVal + "</textarea>";
      html += "</div>";
    }
    html += "</div>";

    /* Synthese (dernier bloc uniquement) */
    if (isLast) {
      html += "<div style='background:#f0f4ff;border:1px solid #c5cae9;border-radius:10px;padding:20px;margin-bottom:16px'>";
      html += "<div style='font-size:14px;font-weight:700;color:#1b2d5b;margin-bottom:14px'>&#128203; Synthese coach (usage interne)</div>";
      html += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:12px'>";
      var synths=[["pts_cles","synthese_points_cles","Points cles identifies"],["risques","synthese_risques","Risques identifies"],["opportunites","synthese_opportunites","Opportunites"],["next","synthese_prochaines_etapes","Prochaines etapes"]];
      for(var si2=0;si2<synths.length;si2++){
        var sf=synths[si2];
        html += "<div><label style='display:block;font-size:11px;font-weight:700;color:#1b2d5b;margin-bottom:4px'>"+sf[2]+"</label>";
        html += "<textarea id='synth_"+sf[0]+"' rows='3' style='width:100%;padding:8px;border:1px solid #c5cae9;border-radius:6px;font-size:12px;resize:vertical;font-family:inherit;box-sizing:border-box'>"+(session[sf[1]]||"")+"</textarea></div>";
      }
      html += "</div></div>";
    }

    /* Boutons navigation */
    html += "<div style='display:flex;justify-content:space-between;align-items:center;padding:16px 0'>";
    /* Gauche : Précédent */
    if (bIdx > 0) {
      html += "<button onclick='window._sauvegarderBlocEtNaviguer("+clientId+","+num+","+bIdx+","+(bIdx-1)+")' style='background:#f0f4f8;color:#1b2d5b;border:1px solid #ddd;border-radius:8px;padding:10px 20px;cursor:pointer;font-size:13px;font-weight:600'>&#8592; Precedent</button>";
    } else { html += "<div></div>"; }
    /* Centre : Brouillon */
    html += "<button onclick='window.sauvegarderBrouillonCoaching("+clientId+","+num+","+bIdx+")' style='background:#f8f9fa;color:#666;border:1px solid #ddd;border-radius:8px;padding:10px 20px;cursor:pointer;font-size:13px'>&#128190; Enregistrer brouillon</button>";
    /* Droite : Suivant ou Valider */
    if (!isLast) {
      html += "<button onclick='window._sauvegarderBlocEtNaviguer("+clientId+","+num+","+bIdx+","+(bIdx+1)+")' style='background:#1b2d5b;color:white;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-size:13px;font-weight:700'>Suivant &#8594;</button>";
    } else {
      html += "<button onclick='window.validerSeanceCoaching("+clientId+","+num+")' style='background:#2ecc71;color:white;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-size:13px;font-weight:700'>&#10003; Valider la seance "+num+"</button>";
    }
    html += "</div>";
    html += "</div>"; /* end max-width */
    el.innerHTML = html;
    el.scrollTop = 0;
  var mc = document.querySelector('.content') || document.getElementById('main-content');
  if (mc) mc.scrollTop = 0;
  }

  renderBloc(blocIdx);
};

/* Collecter les reponses du bloc courant */
window._collecterReponsesBloc = function(num, bIdx) {
  var si = typeof SEANCE_DATA !== "undefined" ? SEANCE_DATA[num] : null;
  if (!si) return {};
  var b = {};
  var bloc = si.blocs[bIdx];
  if (!bloc) return b;
  for (var qi=0; qi<bloc.q.length; qi++) {
    var el = document.getElementById("b"+(bIdx+1)+"_q"+qi);
    if (el) b["q"+qi] = el.value;
  }
  return b;
};

/* Collecter la synthese */
window._collecterSynthese = function() {
  var synths = [["pts_cles","synthese_points_cles"],["risques","synthese_risques"],["opportunites","synthese_opportunites"],["next","synthese_prochaines_etapes"]];
  var out = {};
  synths.forEach(function(sf) {
    var el = document.getElementById("synth_"+sf[0]);
    if (el) out[sf[1]] = el.value;
  });
  return out;
};

/* Sauvegarder le bloc courant et naviguer vers un autre */
window._sauvegarderBlocEtNaviguer = function(clientId, num, bIdxFrom, bIdxTo) {
  window.sauvegarderBrouillonCoaching(clientId, num, bIdxFrom, function() {
    window._coachingBlocCourant[clientId+"_"+num] = bIdxTo;
    window.renderCoachingSeance(clientId, num);
  });
};

/* Sauvegarder comme brouillon (statut en_cours) */
window.sauvegarderBrouillonCoaching = function(clientId, num, bIdx, callback) {
  var si = typeof SEANCE_DATA !== "undefined" ? SEANCE_DATA[num] : null;
  if (!si) return;
  var statEl = document.getElementById("statut-seance");
  var statut = statEl ? statEl.value : "en_cours";

  /* Construire le payload avec TOUS les blocs existants + le bloc courant mis a jour */
  var sessions = (window._coachingData && window._coachingData[clientId]) || {};
  var session = sessions[num] || {};
  var payload = { statut: statut };

  /* Recuperer les blocs deja sauvegardes */
  for (var bi=0; bi<si.blocs.length; bi++) {
    try { payload["bloc"+(bi+1)] = JSON.parse(session["bloc"+(bi+1)]||"{}"); }
    catch(e) { payload["bloc"+(bi+1)] = {}; }
  }
  /* Mettre a jour le bloc courant avec les valeurs du DOM */
  payload["bloc"+(bIdx+1)] = window._collecterReponsesBloc(num, bIdx);

  /* Synthese si disponible */
  var synth = window._collecterSynthese();
  Object.assign(payload, synth);

  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/coaching/"+clientId+"/seance/"+num, {
    method:"POST",
    headers:{"Authorization":"Bearer "+tok,"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  }).then(function(r){return r.json();}).then(function(d){
    if (d.session) {
      if (!window._coachingData) window._coachingData = {};
      if (!window._coachingData[clientId]) window._coachingData[clientId] = {};
      window._coachingData[clientId][num] = d.session;
      if (typeof showToast === "function") showToast("Brouillon enregistre !", true);
    } else {
      if (typeof showToast === "function") showToast("Erreur lors de la sauvegarde.", false);
    }
    if (typeof callback === "function") callback();
  }).catch(function() {
    if (typeof showToast === "function") showToast("Erreur reseau.", false);
    if (typeof callback === "function") callback();
  });
};

/* Valider la seance (statut = terminee) */
window.validerSeanceCoaching = function(clientId, num) {
  var si = typeof SEANCE_DATA !== "undefined" ? SEANCE_DATA[num] : null;
  if (!si) return;

  /* Sauvegarder tout avec statut terminee */
  var sessions = (window._coachingData && window._coachingData[clientId]) || {};
  var session = sessions[num] || {};
  var payload = { statut: "terminee" };
  var bIdx = window._coachingBlocCourant[clientId+"_"+num] || (si.blocs.length-1);

  for (var bi=0; bi<si.blocs.length; bi++) {
    try { payload["bloc"+(bi+1)] = JSON.parse(session["bloc"+(bi+1)]||"{}"); }
    catch(e) { payload["bloc"+(bi+1)] = {}; }
  }
  /* Dernier bloc avec donnees DOM */
  payload["bloc"+(bIdx+1)] = window._collecterReponsesBloc(num, bIdx);
  var synth = window._collecterSynthese();
  Object.assign(payload, synth);

  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/coaching/"+clientId+"/seance/"+num, {
    method:"POST",
    headers:{"Authorization":"Bearer "+tok,"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  }).then(function(r){return r.json();}).then(function(d){
    if (d.session) {
      if (!window._coachingData) window._coachingData = {};
      if (!window._coachingData[clientId]) window._coachingData[clientId] = {};
      window._coachingData[clientId][num] = d.session;
      if (typeof showToast === "function") showToast("Seance "+num+" validee !", true);
      /* Retour a la vue principale coaching */
      setTimeout(function() { if(typeof renderCoachingPage==="function") renderCoachingPage(); }, 800);
    } else {
      if (typeof showToast === "function") showToast("Erreur lors de la validation.", false);
    }
  }).catch(function() { if (typeof showToast === "function") showToast("Erreur reseau.", false); });
};

/* ----------------------------------------------------------------
   ENTRETIEN : Sauvegarde du score corrigee
   Les IDs reels dans le DOM sont live-score, big-score, score-card
   ---------------------------------------------------------------- */
window.sauvegarderEntretien = async function() {
  var clientId = window.currentClientId;
  if (!clientId) { alert("Erreur: client non identifie."); return; }

  /* Lire le score depuis les elements reels du DOM */
  var scoreEl = document.getElementById("live-score") || document.getElementById("big-score") || document.getElementById("score-num");
  var score = scoreEl ? parseInt(scoreEl.textContent || scoreEl.value || "0") : 0;
  if (isNaN(score)) score = 0;

  /* Lire les scores par critere */
  var clarteEl = document.getElementById("sl-clarte") || document.getElementById("range-clarte");
  var faisbEl  = document.getElementById("sl-faisab") || document.getElementById("range-faisab");
  var motiEl   = document.getElementById("sl-motiv")  || document.getElementById("range-motiv");
  var budgEl   = document.getElementById("sl-budget") || document.getElementById("range-budget");
  var capEl    = document.getElementById("sl-capac")  || document.getElementById("range-capac");

  /* Calculer le score total si les sliders sont disponibles */
  if (clarteEl || faisbEl) {
    var c = parseInt((clarteEl && clarteEl.value)||"0");
    var f = parseInt((faisbEl  && faisbEl.value) ||"0");
    var m = parseInt((motiEl   && motiEl.value)  ||"0");
    var b = parseInt((budgEl   && budgEl.value)  ||"0");
    var ca= parseInt((capEl    && capEl.value)   ||"0");
    score = c + f + m + b + ca;
  }

  /* Determiner le profil en fonction du score */
  var profil = "A qualifier";
  if (score >= 80) profil = "Profil 4 — Tres motive";
  else if (score >= 60) profil = "Profil 3 — Engage";
  else if (score >= 40) profil = "Profil 2 — En developpement";
  else if (score >= 20) profil = "Profil 1 — A structurer";

  /* Lire le profil selecte manuellement si disponible */
  var profilEl = document.querySelector("[id*='profil'], [id*='Profil'], select[id*='profil']");
  if (profilEl && profilEl.value) profil = profilEl.value;

  /* Lire les notes et autres champs */
  var notesEl = document.querySelector("textarea[id*='note'], textarea[id*='Note'], #notes-coach, #notes-entretien");
  var notes = notesEl ? notesEl.value : "";

  var sitEl = document.querySelector("[id*='situation'], [id*='statut']");
  var situation = sitEl ? (sitEl.value || sitEl.textContent) : "";

  var tok = localStorage.getItem("simele_token") || "";
  try {
    var r = await fetch("/api/clients/" + clientId + "/entretien", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
      body: JSON.stringify({ score: score, profil: profil, notes: notes, situation: situation })
    });
    var data = await r.json();
    if (data.success) {
      if (typeof showToast === "function") showToast("Entretien sauvegarde ! Score: " + score + "/100", true);
      /* Rafraichir la fiche client */
      if (typeof chargerClient === "function") chargerClient(clientId);
      if (typeof loadClient === "function") loadClient(clientId);
      /* Mettre a jour le score visible */
      var scoreCards = document.querySelectorAll(".score-num, #score-num, .big-score");
      scoreCards.forEach(function(el) { el.textContent = score; });
    } else {
      if (typeof showToast === "function") showToast("Erreur: " + (data.error || "Inconnue"), false);
    }
  } catch(e) {
    if (typeof showToast === "function") showToast("Erreur de connexion: " + e.message, false);
  }
};

/* ================================================================
   IA ASSISTANTE OLLAMA — Integration complete
   ================================================================ */

window._iaConfig = {
  url: localStorage.getItem('ollama_url') || 'http://localhost:11434',
  model: localStorage.getItem('ollama_model') || 'llama3',
  connected: false
};
window._iaHistory = [];
window._iaClientContext = null;

/* Restore history from localStorage on load */
try {
  var _savedHist = localStorage.getItem('simele_ia_history');
  if (_savedHist) window._iaHistory = JSON.parse(_savedHist).slice(-50);
} catch(e) {}

/* ----- Initialisation ---- */
window.initIA = function() {
  /* Restaurer config */
  var urlEl = document.getElementById('ollama-url');
  var modelEl = document.getElementById('ollama-model');
  if (urlEl) urlEl.value = window._iaConfig.url;
  if (modelEl) modelEl.value = window._iaConfig.model;
  /* Tester connexion auto */
  window.testerConnexionOllama(true);
  /* Charger contexte si client actif */
  window.chargerContexteClientIA();
  /* Restaurer les messages precedents */
  window._restaurerMessagesIA();
};

window.sauvegarderConfigIA = function() {
  var url = document.getElementById('ollama-url');
  var model = document.getElementById('ollama-model');
  if (url) { window._iaConfig.url = url.value; localStorage.setItem('ollama_url', url.value); }
  if (model) { window._iaConfig.model = model.value; localStorage.setItem('ollama_model', model.value); }
};

/* ----- Test connexion Ollama ---- */
window.testerConnexionOllama = async function(silent) {
  var dot = document.getElementById('ia-dot');
  var txt = document.getElementById('ia-status-txt');
  try {
    var url = window._iaConfig.url;
    var r = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      var data = await r.json();
      var models = data.models ? data.models.map(function(m){return m.name;}) : [];
      window._iaConfig.connected = true;
      if (dot) { dot.classList.remove('ia-status-off'); }
      if (txt) txt.textContent = 'Connecté — ' + models.length + ' modèle(s) disponible(s)';
      if (!silent) {
        window.ajouterMessageIA('assistant', '✅ Connexion Ollama réussie !\n\nModèles disponibles : ' + (models.join(', ') || 'aucun trouvé') + '\n\nModèle actif : ' + window._iaConfig.model);
      }
      /* Mettre à jour le select si on a des modèles */
      return models;
    } else {
      throw new Error('HTTP ' + r.status);
    }
  } catch(e) {
    window._iaConfig.connected = false;
    if (dot) dot.classList.add('ia-status-off');
    if (txt) txt.textContent = 'Ollama non connecté — vérifiez la configuration';
    if (!silent) {
      window.ajouterMessageIA('assistant', '❌ Impossible de contacter Ollama à ' + window._iaConfig.url + '\n\n**Pour activer Ollama avec CORS :**\n\nOuvrez un Terminal et tapez :\n```\nOLLAMA_ORIGINS=* ollama serve\n```\n\nOu configurez via launchctl :\n```\nlaunchctl setenv OLLAMA_ORIGINS "*"\n```\nPuis redémarrez Ollama.');
    }
  }
};

/* ----- Contexte client ---- */
window.chargerContexteClientIA = async function() {
  var display = document.getElementById('ia-context-display');
  var clientId = window.currentClientId || window._currentDocsClientId;
  if (!clientId) {
    window._iaClientContext = null;
    if (display) display.innerHTML = 'Aucun client sélectionné.<br>Ouvrez un dossier client.';
    return;
  }
  var client = typeof getClientById === 'function' ? getClientById(clientId) : null;
  if (!client) { if (display) display.innerHTML = 'Client introuvable.'; return; }

  /* Charger données enrichies */
  var tok = localStorage.getItem('simele_token') || '';
  var ctx = { client: client, entretien: null, coaching: [], documents: [] };

  try {
    var r = await fetch('/api/clients/' + clientId + '/entretien', { headers: {'Authorization':'Bearer '+tok} });
    if (r.ok) ctx.entretien = await r.json();
  } catch(e) {}

  try {
    var r2 = await fetch('/api/coaching/' + clientId, { headers: {'Authorization':'Bearer '+tok} });
    if (r2.ok) ctx.coaching = await r2.json();
  } catch(e) {}

  try {
    var r3 = await fetch('/api/documents/client/' + clientId, { headers: {'Authorization':'Bearer '+tok} });
    if (r3.ok) ctx.documents = await r3.json();
  } catch(e) {}

  window._iaClientContext = ctx;

  if (display) {
    var seancesDone = ctx.coaching.filter(function(s){return s.statut==='terminee';}).length;
    display.innerHTML = '<strong>' + client.prenom + ' ' + client.nom + '</strong><br>'
      + '📋 ' + (client.prestation || 'Prestation non définie') + '<br>'
      + '⭐ Score : ' + (ctx.entretien ? ctx.entretien.score || 0 : 0) + '/100<br>'
      + '🎯 Séances : ' + seancesDone + '/' + ctx.coaching.length + ' terminées<br>'
      + '📁 Documents : ' + (Array.isArray(ctx.documents) ? ctx.documents.length : 0);
  }
};

/* ----- Construire le prompt système ---- */
window._construireSystemPrompt = function() {
  var base = 'Tu es l\'assistante IA du Cabinet de Conseils SIMELE, dirigé par Jean-Christophe Simele, consultant en création d\'entreprise basé à Trois-Rivières, Guadeloupe.\n\nTes rôles :\n- Aider à rédiger des comptes rendus de séances de coaching entrepreneurial\n- Analyser les profils clients et leur progression\n- Générer des fiches d\'accompagnement personnalisées\n- Suggérer une organisation des documents clients\n- Répondre aux questions sur les dispositifs d\'aide à la création d\'entreprise (ACRE, NACRE, LADOM, ARCE, aides région Guadeloupe)\n\nTu communiques toujours en français. Tes réponses sont professionnelles, structurées et orientées action.\nQuand tu rédiges un compte rendu ou une fiche, tu utilises un format clair avec des sections numérotées.';

  var ctx = window._iaClientContext;
  if (!ctx || !ctx.client) return base;

  var c = ctx.client;
  var contextStr = '\n\n--- CONTEXTE CLIENT ACTIF ---\n';
  contextStr += 'Nom : ' + c.prenom + ' ' + c.nom + '\n';
  contextStr += 'Statut : ' + (c.statut || 'Non précisé') + '\n';
  contextStr += 'Prestation : ' + (c.prestation || 'Non définie') + '\n';
  contextStr += 'Projet : ' + (c.projet || 'Non renseigné') + '\n';
  contextStr += 'Notes : ' + (c.notes || 'Aucune') + '\n';

  if (ctx.entretien) {
    contextStr += '\n-- Entretien initial --\n';
    contextStr += 'Score : ' + (ctx.entretien.score || 0) + '/100\n';
    contextStr += 'Profil : ' + (ctx.entretien.profil || 'À qualifier') + '\n';
    if (ctx.entretien.notes) contextStr += 'Notes entretien : ' + ctx.entretien.notes + '\n';
  }

  if (ctx.coaching && ctx.coaching.length > 0) {
    contextStr += '\n-- Séances de coaching --\n';
    ctx.coaching.forEach(function(s) {
      contextStr += 'Séance ' + s.seance_number + ' : ' + (s.statut || 'en_cours') + '\n';
      if (s.synthese_points_cles) contextStr += '  Points clés : ' + s.synthese_points_cles + '\n';
      if (s.synthese_prochaines_etapes) contextStr += '  Prochaines étapes : ' + s.synthese_prochaines_etapes + '\n';
    });
  }

  if (ctx.documents && ctx.documents.length > 0) {
    contextStr += '\n-- Documents dans le dossier --\n';
    ctx.documents.forEach(function(d) {
      contextStr += '- ' + d.nom + ' (' + (d.type || 'document') + ')\n';
    });
  }

  return base + contextStr;
};

/* ----- Envoyer un message ---- */
window.envoyerMessageIA = async function() {
  var input = document.getElementById('ia-input');
  var btn = document.getElementById('ia-send-btn');
  if (!input || !input.value.trim()) return;
  var userMsg = input.value.trim();
  input.value = '';
  input.style.height = 'auto';

  window.ajouterMessageIA('user', userMsg);
  window._iaHistory.push({ role: 'user', content: userMsg });

  if (!window._iaConfig.connected) {
    window.ajouterMessageIA('assistant', '⚠️ Ollama n\'est pas connecté. Cliquez sur "Tester la connexion" dans le panneau de configuration.');
    return;
  }

  /* Indicateur de chargement */
  var loadingId = 'loading-' + Date.now();
  window.ajouterMessageIA('assistant', '⏳ En train de réfléchir...', loadingId, true);
  if (btn) btn.disabled = true;

  try {
    var systemPrompt = window._construireSystemPrompt();
    var messages = [{ role: 'system', content: systemPrompt }]
      .concat(window._iaHistory.slice(-10)); /* Garder les 10 derniers messages */

    var r = await fetch(window._iaConfig.url + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: window._iaConfig.model,
        messages: messages,
        stream: false,
        options: { temperature: 0.7, num_ctx: 4096 }
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!r.ok) throw new Error('Erreur Ollama : HTTP ' + r.status);
    var data = await r.json();
    var reply = data.message ? data.message.content : (data.response || 'Pas de réponse');

    /* Supprimer le message de chargement */
    var loadEl = document.getElementById(loadingId);
    if (loadEl) loadEl.remove();

    window._iaHistory.push({ role: 'assistant', content: reply });
    window.ajouterMessageIA('assistant', reply, null, false, true);

  } catch(e) {
    var loadEl2 = document.getElementById(loadingId);
    if (loadEl2) loadEl2.remove();
    window.ajouterMessageIA('assistant', '❌ Erreur : ' + e.message + '\n\nVérifiez qu\'Ollama est bien lancé avec CORS activé.');
  }

  if (btn) btn.disabled = false;
};

/* ----- Afficher un message dans le chat ---- */
window.ajouterMessageIA = function(role, text, id, thinking, withSave) {
  var msgs = document.getElementById('ia-messages');
  if (!msgs) return;
  var div = document.createElement('div');
  div.className = 'ia-msg ' + (role === 'user' ? 'ia-msg-user' : 'ia-msg-ai') + (thinking ? ' thinking' : '');
  if (id) div.id = id;
  div.textContent = text;
  
  /* Bouton sauvegarder dans dossier */
  if (withSave && window._iaClientContext && window._iaClientContext.client) {
    var saveDiv = document.createElement('div');
    saveDiv.className = 'ia-msg-save';
    var saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 Sauvegarder dans le dossier client';
    var capturedText = text;
    var capturedClientId = window._iaClientContext.client.id;
    saveBtn.onclick = function() { window.sauvegarderReponseIA(capturedText, capturedClientId); };
    saveDiv.appendChild(saveBtn);
    div.appendChild(saveDiv);
  }
  
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  /* Auto-save messages to localStorage */
  window._sauvegarderHistoriqueIA();
};

/* ----- Sauvegarder réponse IA dans le dossier ---- */
window.sauvegarderReponseIA = function(text, clientId) {
  var nom = 'CR_IA_' + new Date().toISOString().slice(0,10) + '.txt';
  var blob = new Blob([text], {type:'text/plain'});
  var file = new File([blob], nom, {type:'text/plain'});
  var fd = new FormData();
  fd.append('fichier', file, nom);
  fd.append('type', 'fiche');
  fd.append('nom', nom);
  fd.append('visible_client', '0');
  var tok = localStorage.getItem('simele_token') || '';
  fetch('/api/documents/client/' + clientId, {method:'POST', headers:{'Authorization':'Bearer '+tok}, body:fd})
    .then(function(r){return r.json();})
    .then(function(d){
      if (d.success) {
        if (typeof showToast==='function') showToast('Sauvegardé dans le dossier !', true);
      } else {
        if (typeof showToast==='function') showToast('Erreur : ' + (d.error||''), false);
      }
    });
};

/* ----- Actions rapides ---- */
window.actionRapideIA = function(action) {
  var ctx = window._iaClientContext;
  var clientNom = ctx && ctx.client ? ctx.client.prenom + ' ' + ctx.client.nom : 'le client actif';
  var seanceNum = 1;
  if (ctx && ctx.coaching) {
    var enCours = ctx.coaching.find(function(s){return s.statut==='en_cours';});
    if (enCours) seanceNum = enCours.seance_number;
  }
  
  var prompts = {
    cr_seance: 'Rédige un compte rendu professionnel de la séance ' + seanceNum + ' de coaching pour ' + clientNom + '. Utilise le contexte disponible. Structure le CR avec : Objectifs de la séance, Points abordés, Décisions prises, Prochaines étapes, Observations du coach.',
    fiche_client: 'Génère une fiche de synthèse complète et professionnelle pour ' + clientNom + '. Inclus : Profil entrepreneur, Projet et son avancement, Points forts, Points de vigilance, Recommandations pour la suite.',
    analyse_profil: 'Analyse en détail le profil entrepreneurial de ' + clientNom + ' sur la base de toutes les données disponibles. Évalue : la solidité du projet, la motivation, les compétences identifiées, les risques, et donne une recommandation sur la suite de l\'accompagnement.',
    plan_accompagnement: 'Propose un plan d\'accompagnement personnalisé et structuré pour ' + clientNom + ' en tenant compte de son profil, son projet, et ses besoins identifiés lors des séances.',
    orga_docs: 'Analyse les documents présents dans le dossier de ' + clientNom + ' et propose une organisation optimale. Identifie les documents manquants importants et suggère un ordre de priorité pour les obtenir.',
    financements: 'Liste et explique tous les dispositifs de financement et d\'aide à la création d\'entreprise disponibles pour ' + clientNom + ' en Guadeloupe (ACRE, NACRE, LADOM, ARCE, aides régionales, microcrédits...). Précise les conditions d\'éligibilité et les démarches.'
  };
  
  var prompt = prompts[action] || 'Comment puis-je aider ' + clientNom + ' ?';
  var input = document.getElementById('ia-input');
  if (input) {
    input.value = prompt;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    input.focus();
  }
};

/* ----- Touche Entrée ---- */
window.iaKeyDown = function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    window.envoyerMessageIA();
  }
};

/* ----- Vider le chat ---- */

/* ----- Sauvegarde auto de l'historique ---- */
window._sauvegarderHistoriqueIA = function() {
  try {
    /* Save history array */
    localStorage.setItem('simele_ia_history', JSON.stringify(window._iaHistory.slice(-50)));
    /* Save rendered messages HTML */
    var msgs = document.getElementById('ia-messages');
    if (msgs) {
      /* Save only text content of messages (not save buttons) */
      var msgData = [];
      msgs.querySelectorAll('.ia-msg').forEach(function(el) {
        msgData.push({
          role: el.classList.contains('ia-msg-user') ? 'user' : 'ai',
          text: el.childNodes[0] ? el.childNodes[0].textContent || el.textContent : el.textContent,
          ts: Date.now()
        });
      });
      localStorage.setItem('simele_ia_messages', JSON.stringify(msgData.slice(-30)));
    }
  } catch(e) {}
};

/* ----- Restaurer les messages affiches au chargement ---- */
window._restaurerMessagesIA = function() {
  var msgs = document.getElementById('ia-messages');
  if (!msgs) return;
  try {
    var saved = localStorage.getItem('simele_ia_messages');
    if (!saved) return;
    var msgData = JSON.parse(saved);
    if (!msgData || !msgData.length) return;
    /* Clear default welcome message and restore saved ones */
    msgs.innerHTML = '';
    msgData.forEach(function(m) {
      var div = document.createElement('div');
      div.className = 'ia-msg ' + (m.role === 'user' ? 'ia-msg-user' : 'ia-msg-ai');
      div.textContent = m.text;
      msgs.appendChild(div);
    });
    msgs.scrollTop = msgs.scrollHeight;
    console.log('IA: ' + msgData.length + ' messages restaures');
  } catch(e) {}
};

window.viderChatIA = function() {
  if (!confirm('Effacer toutes les conversations ? Cette action est irreversible.')) return;
  var msgs = document.getElementById('ia-messages');
  if (msgs) {
    msgs.innerHTML = '<div class="ia-msg ia-msg-ai">Chat effacé. Comment puis-je vous aider ?</div>';
  }
  window._iaHistory = [];
  localStorage.removeItem('simele_ia_history');
  localStorage.removeItem('simele_ia_messages');
};

/* ----- Charger le contexte quand on ouvre l\'onglet IA ---- */
(function() {
  var origShowPage = window.showPage;
  window.showPage = function(id, clientId) {
    if (typeof origShowPage === 'function') origShowPage(id, clientId);
    if (id === 'ia') {
      setTimeout(function() { window.initIA(); }, 200);
    }
  };
})();

/* ================================================================
   ESPACE CLIENT — Envoi accès avec mot de passe provisoire
   ================================================================ */
window.envoyerAccesClient = async function(clientId) {
  if (!clientId) { alert("Veuillez d'abord ouvrir un dossier client."); return; }
  var tok = localStorage.getItem('simele_token') || '';
  var client = typeof getClientById === 'function' ? getClientById(clientId) : null;
  var nom = client ? (client.prenom + ' ' + client.nom) : 'ce client';
  var email = client ? client.email : '';

  /* --- Vérifier statut actuel --- */
  var statut = null;
  try {
    var sr = await fetch('/api/portal/statut-client/' + clientId, {headers:{'Authorization':'Bearer '+tok}});
    statut = await sr.json();
  } catch(e) {}

  /* --- Construire le modal --- */
  var old = document.getElementById('modal-espace-client');
  if (old) old.remove();

  var hasAccess = statut && statut.hasAccess;
  var lastSent = statut && statut.inscription && statut.inscription.mdp_envoi_at
    ? statut.inscription.mdp_envoi_at.slice(0,16).replace('T',' ')
    : null;

  var modal = document.createElement('div');
  modal.id = 'modal-espace-client';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';

  modal.innerHTML = '<div style="background:white;border-radius:12px;width:100%;max-width:480px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3)">'
    + '<div style="background:#1b2d5b;color:white;padding:18px 20px;display:flex;justify-content:space-between;align-items:center">'
    + '<div><div style="font-size:15px;font-weight:700">🔗 Espace client — ' + nom + '</div>'
    + '<div style="font-size:12px;opacity:0.8;margin-top:2px">Envoi des identifiants de connexion</div></div>'
    + '<button onclick="document.getElementById(\'modal-espace-client\').remove()" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;opacity:0.7">✕</button>'
    + '</div>'
    + '<div style="padding:24px">'
    + '<div style="background:#f0f4f8;border-radius:8px;padding:14px;margin-bottom:16px">'
    + '<div style="font-size:12px;color:#666;margin-bottom:4px">📧 Email du client</div>'
    + '<div style="font-size:14px;font-weight:600;color:#1b2d5b">' + (email || '<span style="color:#e74c3c">Non renseigné !</span>') + '</div>'
    + '</div>'
    + (hasAccess
      ? '<div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#2e7d32">'
        + '✅ Cet accès a déjà été créé' + (lastSent ? '<br><span style="font-size:11px;color:#666">Dernier envoi : ' + lastSent + '</span>' : '') + '</div>'
      : '<div style="background:#fff8e1;border:1px solid #ffe082;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#f57f17">'
        + '⚠️ Aucun accès créé pour ce client</div>')
    + '<p style="font-size:13px;color:#444;margin:0 0 20px">'
    + (hasAccess
      ? 'Cliquez sur <strong>"Renvoyer"</strong> pour générer un <strong>nouveau mot de passe provisoire</strong> et l\'envoyer par email à <strong>' + email + '</strong>.'
      : 'Cliquez sur <strong>"Envoyer l\'accès"</strong> pour créer l\'espace client et envoyer les identifiants par email à <strong>' + (email||'...') + '</strong>.')
    + '</p>'
    + '<div id="ec-result"></div>'
    + '<div style="display:flex;gap:10px;justify-content:flex-end">'
    + '<button onclick="document.getElementById(\'modal-espace-client\').remove()" style="background:#f0f4f8;border:1px solid #ddd;border-radius:8px;padding:10px 18px;cursor:pointer;font-size:13px">Annuler</button>'
    + '<button id="btn-envoyer-acces" onclick="window._confirmerEnvoiAcces(' + clientId + ')" style="background:#1b2d5b;color:white;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-size:13px;font-weight:700">'
    + (hasAccess ? '🔄 Renvoyer un nouveau mot de passe' : '📨 Envoyer l\'accès')
    + '</button>'
    + '</div>'
    + '</div></div>';

  document.body.appendChild(modal);
};

window._confirmerEnvoiAcces = async function(clientId) {
  var btn = document.getElementById('btn-envoyer-acces');
  var result = document.getElementById('ec-result');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi en cours...'; }

  var tok = localStorage.getItem('simele_token') || '';
  try {
    var r = await fetch('/api/portal/envoyer-acces/' + clientId, {
      method: 'POST',
      headers: {'Authorization':'Bearer '+tok, 'Content-Type':'application/json'}
    });
    var data = await r.json();

    if (data.success) {
      /* Afficher le succès avec le MDP provisoire pour que JC puisse le noter */
      var bgColor = data.emailSent === false ? '#fff8e1' : '#e8f5e9';
      var bdColor = data.emailSent === false ? '#ffe082' : '#a5d6a7';
      var txtColor = data.emailSent === false ? '#f57f17' : '#2e7d32';
      var icon = data.emailSent === false ? '⚠️' : '✅';
      result.innerHTML = '<div style="background:'+bgColor+';border:1px solid '+bdColor+';border-radius:8px;padding:14px;margin-bottom:16px">'
        + '<div style="font-size:13px;font-weight:700;color:'+txtColor+';margin-bottom:8px">' + icon + ' ' + data.message + '</div>'
        + '<div style="font-size:12px;color:#444;margin-bottom:6px">Identifiants envoyés :</div>'
        + '<div style="background:white;border:1px solid #c8e6c9;border-radius:6px;padding:10px;font-family:monospace">'
        + '<div>📧 Email : <strong>' + data.email + '</strong></div>'
        + '<div style="margin-top:4px">🔐 Mot de passe : <strong style="background:#f0f0f0;padding:2px 8px;border-radius:4px">' + data.mdp_provisoire + '</strong>'
        + ' <button onclick="navigator.clipboard.writeText(\'' + data.mdp_provisoire + '\')" style="background:none;border:none;cursor:pointer;font-size:11px;color:#666">📋 copier</button></div>'
        + '</div>'
        + '<div style="font-size:11px;color:#666;margin-top:8px">Le client peut se connecter sur <strong>ccsguadeloupe.fr</strong> avec ces identifiants.</div>'
        + '</div>';
      if (btn) { btn.disabled = true; btn.textContent = data.emailSent === false ? '⚠️ Accès créé (email non envoyé)' : '✅ Envoyé !'; }
      /* Update main button */
      var mainBtn = document.getElementById('btn-espace-client');
      if (mainBtn) { mainBtn.style.background='rgba(46,204,113,0.15)'; mainBtn.style.borderColor='#2ecc71'; mainBtn.style.color='#27ae60'; mainBtn.textContent='✅ Accès actif'; }
    } else {
      result.innerHTML = '<div style="background:#fdf0f0;border:1px solid #e74c3c;border-radius:8px;padding:12px;margin-bottom:12px;color:#e74c3c;font-size:13px">❌ ' + (data.error||'Erreur inconnue') + '</div>';
      if (btn) { btn.disabled = false; btn.textContent = 'Réessayer'; }
    }
  } catch(e) {
    result.innerHTML = '<div style="background:#fdf0f0;border:1px solid #e74c3c;border-radius:8px;padding:12px;margin-bottom:12px;color:#e74c3c;font-size:13px">❌ Erreur réseau: ' + e.message + '</div>';
    if (btn) { btn.disabled = false; btn.textContent = 'Réessayer'; }
  }
};

/* ================================================================
   ENTRETIEN — Fix complet : ouverture, pré-remplissage, sauvegarde
   ================================================================ */

/* Ouvrir l'entretien depuis un dossier client */
window.ouvrirEntretien = function(clientId) {
  if (!clientId) { alert("Veuillez d'abord ouvrir un dossier client."); return; }
  window._entretienClientId = clientId;
  showPage('entretien', clientId);
};

/* Pré-remplir le formulaire d'entretien avec les données du client */
window._preRemplirEntretien = function(clientId) {
  if (!clientId) return;
  var client = typeof getClientById === 'function' ? getClientById(clientId) : null;
  if (!client) return;

  /* Afficher le nom du client en haut de l'entretien */
  var banner = document.getElementById('entretien-client-banner');
  if (!banner) {
    var entPage = document.getElementById('page-entretien');
    if (entPage) {
      var b = document.createElement('div');
      b.id = 'entretien-client-banner';
      b.style.cssText = 'background:#1b2d5b;color:white;padding:10px 20px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:10px;flex-shrink:0';
      b.innerHTML = '📋 Entretien en cours pour : <strong style="color:#c9a96e">' + client.prenom + ' ' + client.nom + '</strong>'
        + '<span style="margin-left:auto;font-size:11px;opacity:0.7">' + (client.prestation||'') + '</span>';
      entPage.insertBefore(b, entPage.firstChild);
    }
  } else {
    banner.innerHTML = '📋 Entretien en cours pour : <strong style="color:#c9a96e">' + client.prenom + ' ' + client.nom + '</strong>'
      + '<span style="margin-left:auto;font-size:11px;opacity:0.7">' + (client.prestation||'') + '</span>';
  }

  /* Pré-remplir les champs texte de l'entretien */
  var inputs = document.querySelectorAll('#page-entretien input[type="text"], #page-entretien input:not([type])');
  inputs.forEach(function(inp) {
    var ph = inp.placeholder || '';
    if (!inp.value) {
      if (ph.includes('Nom') || ph.includes('nom') || ph.includes('René')) inp.value = client.prenom + ' ' + client.nom;
      else if (ph.includes('email') || ph.includes('Email')) inp.value = client.email || '';
      else if (ph.includes('Téléphone') || ph.includes('tel') || ph.includes('06')) inp.value = client.tel || '';
      else if (ph.includes('projet') || ph.includes('Projet') || ph.includes('coiffure')) inp.value = client.projet || '';
    }
  });

  /* Pré-sélectionner le statut */
  var statuts = document.querySelectorAll('#page-entretien select');
  statuts.forEach(function(sel) {
    if (client.statut) {
      for (var i=0; i<sel.options.length; i++) {
        if (sel.options[i].text.toLowerCase().includes(client.statut.toLowerCase())) {
          sel.selectedIndex = i; break;
        }
      }
    }
  });

  /* Charger entretien existant si déjà fait */
  var tok = localStorage.getItem('simele_token') || '';
  fetch('/api/clients/' + clientId + '/entretien', {headers:{'Authorization':'Bearer '+tok}})
    .then(function(r){return r.json();})
    .then(function(data) {
      if (data && data.score) {
        /* Restaurer le score précédent */
        var liveScore = document.getElementById('live-score');
        if (liveScore) liveScore.textContent = data.score;
        if (typeof window._updateScoreBars === 'function') window._updateScoreBars(data.score);
        if (typeof showToast === 'function') showToast('Entretien existant chargé (score: '+data.score+'/100)', true);
      }
    }).catch(function(){});
};

/* Sauvegarder l'entretien et mettre à jour le dossier client */
window.sauvegarderEntretienComplet = async function(brouillon) {
  var clientId = window._entretienClientId || window.currentClientId;
  if (!clientId) { alert("Client non identifié. Fermez et rouvrez l'entretien depuis un dossier client."); return; }

  /* Lire le score depuis live-score */
  var liveScoreEl = document.getElementById('live-score');
  var score = liveScoreEl ? parseInt(liveScoreEl.textContent || '0') : 0;
  if (isNaN(score) || score === 0) {
    /* Essayer de calculer depuis les barres */
    var vals = ['pv-cl','pv-fa','pv-mo','pv-re'].map(function(id) {
      var el = document.getElementById(id);
      return el ? parseInt(el.textContent||'0') : 0;
    });
    score = vals.reduce(function(a,b){return a+b;}, 0);
  }

  /* Déterminer le profil en fonction du score */
  var profil = 'À qualifier';
  if (score >= 80) profil = 'Profil 4 — Très motivé et structuré';
  else if (score >= 60) profil = 'Profil 3 — Engagé, projet solide';
  else if (score >= 40) profil = 'Profil 2 — En développement';
  else if (score >= 20) profil = 'Profil 1 — À structurer';
  
  /* Lire le badge profil si défini dans l'UI */
  var badgeEl = document.getElementById('profil-badge');
  if (badgeEl && badgeEl.textContent.trim() && badgeEl.textContent.trim() !== '—') {
    profil = badgeEl.textContent.trim();
  }

  /* Lire les notes et données du formulaire */
  var notes = '';
  var textareas = document.querySelectorAll('#page-entretien textarea');
  textareas.forEach(function(ta) { if(ta.value.trim()) notes += ta.value.trim() + '\n'; });
  
  var tok = localStorage.getItem('simele_token') || '';
  try {
    var r = await fetch('/api/clients/' + clientId + '/entretien', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body: JSON.stringify({score: score, profil: profil, notes: notes.trim(), statut: brouillon ? 'brouillon' : 'valide'})
    });
    var data = await r.json();
    if (data.success || data.id || r.ok) {
      if (typeof showToast === 'function') {
        showToast(brouillon ? '💾 Brouillon enregistré (score: '+score+'/100)' : '✅ Entretien validé ! Score: '+score+'/100 → dossier mis à jour', true);
      }
      if (!brouillon) {
        /* Retourner au dossier et le rafraîchir */
        setTimeout(function(){
          showPage('dossier', clientId);
        }, 800);
      }
    } else {
      /* API /api/clients/:id/entretien n'existe peut-être pas — essayer /api/entretien */
      var r2 = await fetch('/api/entretien', {
        method: 'POST',
        headers: {'Content-Type':'application/json','Authorization':'Bearer '+tok},
        body: JSON.stringify({client_id: clientId, score: score, profil: profil, notes: notes.trim()})
      });
      var data2 = await r2.json();
      if (data2.success || data2.id) {
        if (typeof showToast === 'function') showToast(brouillon ? '💾 Brouillon enregistré' : '✅ Entretien validé !', true);
        if (!brouillon) setTimeout(function(){ showPage('dossier', clientId); }, 800);
      } else {
        if (typeof showToast === 'function') showToast('Erreur: ' + (data2.error||data.error||'API introuvable'), false);
      }
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('Erreur réseau: ' + e.message, false);
    else alert('Erreur: ' + e.message);
  }
};

/* ================================================================
   ENTRETIEN & SCORING — Corrections complètes
   ================================================================ */

/* ----- Pré-remplir le formulaire depuis les données client ----- */
window._preRemplirEntretien = function(clientId) {
  if (!clientId) return;
  var client = typeof getClientById === 'function' ? getClientById(clientId) : null;
  if (!client) return;

  /* Stocker le clientId dans le formulaire */
  window._entretienClientId = clientId;

  /* Mettre à jour le titre de la page */
  var titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = 'Entretien — ' + client.prenom + ' ' + client.nom;
  var subEl = document.getElementById('page-sub');
  if (subEl) subEl.textContent = client.prestation || 'Entretien initial';

  /* Pré-remplir les champs texte */
  var nomEl = document.getElementById('ent-nom-prenom');
  if (nomEl && !nomEl.value) nomEl.value = client.prenom + ' ' + client.nom;

  var emailEl = document.getElementById('ent-email');
  if (emailEl && !emailEl.value) emailEl.value = client.email || '';

  var telEl = document.getElementById('ent-tel');
  if (telEl && !telEl.value) telEl.value = client.tel || '';

  var projetEl = document.getElementById('ent-projet');
  if (projetEl && !projetEl.value) projetEl.value = client.projet || '';

  var statutSel = document.getElementById('ent-statut');
  if (statutSel && client.statut) {
    for (var i = 0; i < statutSel.options.length; i++) {
      if (statutSel.options[i].text === client.statut) { statutSel.selectedIndex = i; break; }
    }
  }

  /* Pré-remplir notes si existantes */
  var notesEl = document.getElementById('ent-notes');
  if (notesEl && !notesEl.value && client.notes) notesEl.value = client.notes;

  /* Recalculer le score */
  if (typeof recalc === 'function') setTimeout(recalc, 200);
};

/* ----- Lire la valeur sélectionnée d'un groupe de chips ----- */
window._lireChip = function(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return '';
  var active = el.querySelector('.chip.on');
  return active ? active.textContent.trim() : '';
};

/* ----- Lire tous les chips pour calculer le score ----- */
window._calculerScoreEntretien = function() {
  var score = 0;

  /* Section B — Clarté (max 30) */
  var vision = window._lireChip('ent-vision');
  var cible  = window._lireChip('ent-cible');
  var offre  = window._lireChip('ent-offre');
  if (vision === 'Claire') score += 10; else if (vision === 'Moyenne') score += 5;
  if (cible  === 'Oui')   score += 10; else if (cible  === 'Partielle') score += 5;
  if (offre  === 'Oui')   score += 10;

  /* Section C — Capacité (max 25) */
  var comp  = window._lireChip('ent-competences');
  var exp   = window._lireChip('ent-experience');
  var auto  = window._lireChip('ent-autonomie');
  if (comp === 'Bon')    score += 10; else if (comp === 'Moyen') score += 5;
  if (exp  === 'Oui')   score += 10;
  if (auto === 'Forte') score += 5;  else if (auto === 'Moyenne') score += 2;

  /* Section D — Ressources (max 20) */
  var budget = parseInt(document.getElementById('ent-budget')?.value || '0');
  var fin    = window._lireChip('ent-financement');
  if (budget >= 10000) score += 10; else if (budget >= 3000) score += 5; else if (budget >= 500) score += 2;
  if (fin === 'Oui')     score += 10; else if (fin === 'Possible') score += 5;

  /* Section E — Motivation (max 25) */
  var engagement = window._lireChip('ent-engagement');
  var urgence    = window._lireChip('ent-urgence');
  var capacite   = window._lireChip('ent-capacite');
  var engNum = parseInt(engagement) || 3;
  score += Math.round(engNum * 2); /* max 10 */
  if (urgence  === 'Forte')  score += 8; else if (urgence  === 'Moyenne') score += 4;
  if (capacite === 'Oui')    score += 7; else if (capacite === 'Hésitant') score += 3;

  return Math.min(100, Math.max(0, score));
};

/* ----- Déterminer le profil selon le score ----- */
window._profilDepuisScore = function(score) {
  if (score >= 80) return 'Profil 4 — Prêt à lancer';
  if (score >= 60) return 'Profil 3 — Bien engagé';
  if (score >= 40) return 'Profil 2 — À accompagner';
  return 'Profil 1 — À structurer';
};

/* ----- Générer la fiche d'entretien HTML ----- */
window._genererFicheEntretien = function(client, score, profil, data) {
  var today = new Date().toLocaleDateString('fr-FR');
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fiche entretien — ' + client.prenom + ' ' + client.nom + '</title>'
    + '<style>body{font-family:Arial,sans-serif;max-width:780px;margin:30px auto;padding:0 30px;font-size:13px;color:#1a1a1a;line-height:1.6}'
    + 'h1{font-size:20px;color:#1b2d5b;margin-bottom:4px}h2{font-size:14px;font-weight:700;color:#1b2d5b;border-bottom:2px solid #1b2d5b;padding-bottom:4px;margin-top:20px}'
    + '.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:2px solid #c9a96e;margin-bottom:20px}'
    + '.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#1b2d5b;color:white}'
    + '.score-box{background:#f0f4f8;border-left:4px solid #1b2d5b;padding:12px 16px;border-radius:6px;margin:16px 0}'
    + '.score-num{font-size:36px;font-weight:700;color:#1b2d5b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}'
    + '.field{background:#f8f9fa;border-radius:6px;padding:10px 12px}.field-label{font-size:10px;font-weight:700;text-transform:uppercase;color:#999;margin-bottom:4px}'
    + '.field-val{font-size:13px;color:#1a1a1a;font-weight:500}'
    + '.notes-box{background:#f8f9fa;border-radius:6px;padding:12px;margin:8px 0;white-space:pre-wrap}'
    + '.footer{margin-top:30px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:11px;color:#999;display:flex;justify-content:space-between}'
    + '@media print{body{margin:15px}}</style></head><body>'
    + '<div class="header"><div>'
    + '<div style="font-size:11px;color:#c9a96e;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Cabinet de Conseils SIMELE</div>'
    + '<h1>Fiche d\'entretien initial</h1>'
    + '<div style="font-size:13px;color:#666">' + client.prenom + ' ' + client.nom + ' · ' + today + '</div>'
    + '</div><div style="text-align:right"><div class="score-num">' + score + '</div><div style="font-size:11px;color:#999">/100</div>'
    + '<div class="badge" style="margin-top:6px;background:' + (score>=80?'#2ecc71':score>=60?'#f39c12':score>=40?'#e67e22':'#e74c3c') + '">' + profil + '</div>'
    + '</div></div>'
    + '<h2>Informations client</h2>'
    + '<div class="grid">'
    + '<div class="field"><div class="field-label">Nom / Prénom</div><div class="field-val">' + (data.nomPrenom || client.prenom + ' ' + client.nom) + '</div></div>'
    + '<div class="field"><div class="field-label">Email</div><div class="field-val">' + (data.email || client.email || '—') + '</div></div>'
    + '<div class="field"><div class="field-label">Téléphone</div><div class="field-val">' + (data.tel || client.tel || '—') + '</div></div>'
    + '<div class="field"><div class="field-label">Statut professionnel</div><div class="field-val">' + (data.statut || client.statut || '—') + '</div></div>'
    + '<div class="field"><div class="field-label">Projet</div><div class="field-val">' + (data.projet || client.projet || '—') + '</div></div>'
    + '<div class="field"><div class="field-label">Prestation recommandée</div><div class="field-val">' + (data.prestation || client.prestation || '—') + '</div></div>'
    + '</div>'
    + '<h2>Scoring détaillé</h2>'
    + '<div class="grid">'
    + '<div class="field"><div class="field-label">Clarté du projet</div><div class="field-val">Vision : ' + (data.vision||'—') + ' · Cible : ' + (data.cible||'—') + ' · Offre : ' + (data.offre||'—') + '</div></div>'
    + '<div class="field"><div class="field-label">Capacité du porteur</div><div class="field-val">Compétences : ' + (data.competences||'—') + ' · Autonomie : ' + (data.autonomie||'—') + '</div></div>'
    + '<div class="field"><div class="field-label">Ressources</div><div class="field-val">Budget : ' + (data.budget||'0') + '€ · Financement : ' + (data.financement||'—') + '</div></div>'
    + '<div class="field"><div class="field-label">Motivation</div><div class="field-val">Engagement : ' + (data.engagement||'—') + '/5 · Urgence : ' + (data.urgence||'—') + '</div></div>'
    + '</div>'
    + (data.notes ? '<h2>Observations du coach</h2><div class="notes-box">' + data.notes + '</div>' : '')
    + (data.recommandations ? '<h2>Recommandations</h2><div class="notes-box">' + data.recommandations + '</div>' : '')
    + (data.prochaineEtape ? '<h2>Prochaine étape</h2><div class="notes-box">' + data.prochaineEtape + '</div>' : '')
    + '<div class="footer"><div>Cabinet de Conseils SIMELE · Jean-Christophe Simele · Trois-Rivières, Guadeloupe</div><div>Entretien réalisé le ' + today + '</div></div>'
    + '</body></html>';
};

/* ----- Sauvegarder l'entretien complet ----- */
window.sauvegarderEntretienComplet = async function(brouillon) {
  var clientId = window._entretienClientId || window.currentClientId;
  if (!clientId) { alert('Erreur : aucun client sélectionné.\nRetournez sur le dossier client et cliquez sur "Entretien".'); return; }

  var client = typeof getClientById === 'function' ? getClientById(clientId) : null;
  var score = window._calculerScoreEntretien();
  var profil = window._profilDepuisScore(score);

  /* Collecter toutes les données du formulaire */
  var data = {
    nomPrenom:    document.getElementById('ent-nom-prenom')?.value || '',
    email:        document.getElementById('ent-email')?.value || '',
    tel:          document.getElementById('ent-tel')?.value || '',
    statut:       document.getElementById('ent-statut')?.value || '',
    projet:       document.getElementById('ent-projet')?.value || '',
    budget:       document.getElementById('ent-budget')?.value || '0',
    apport:       document.getElementById('ent-apport')?.value || '0',
    notes:        document.getElementById('ent-notes')?.value || '',
    recommandations: document.getElementById('ent-recommandations')?.value || '',
    prochaineEtape: document.getElementById('ent-prochaine-etape')?.value || '',
    vision:       window._lireChip('ent-vision'),
    cible:        window._lireChip('ent-cible'),
    offre:        window._lireChip('ent-offre'),
    competences:  window._lireChip('ent-competences'),
    experience:   window._lireChip('ent-experience'),
    autonomie:    window._lireChip('ent-autonomie'),
    financement:  window._lireChip('ent-financement'),
    engagement:   window._lireChip('ent-engagement'),
    urgence:      window._lireChip('ent-urgence'),
    capacite:     window._lireChip('ent-capacite'),
    stade:        window._lireChip('ent-stade'),
    prestation:   document.getElementById('reco-mini-name')?.textContent || ''
  };

  var tok = localStorage.getItem('simele_token') || '';

  /* 1. Sauvegarder le score sur le client */
  try {
    var r = await fetch('/api/clients/' + clientId + '/entretien', {
      method: 'POST',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body: JSON.stringify({
        score: score,
        profil: profil,
        notes: data.notes,
        situation: data.statut,
        projet: data.projet,
        besoins: data.recommandations,
        recommandations: data.recommandations,
        prochaine_etape: data.prochaineEtape
      })
    });
    var resp = await r.json();
    if (!resp.success) throw new Error(resp.error || 'Erreur sauvegarde');

    /* Mettre à jour clients[] en mémoire */
    if (typeof clients !== 'undefined') {
      var idx = clients.findIndex(function(c){return c.id==clientId;});
      if (idx>-1) { clients[idx].score=score; clients[idx].profil=profil; }
    }
  } catch(e) {
    alert('Erreur lors de la sauvegarde : ' + e.message); return;
  }

  /* 2. Générer et enregistrer la fiche si validation finale */
  if (!brouillon && client) {
    var ficheHTML = window._genererFicheEntretien(client, score, profil, data);
    var today = new Date().toISOString().slice(0,10);
    var ficheNom = 'Fiche_entretien_' + client.nom + '_' + today + '.html';
    var blob = new Blob([ficheHTML], {type:'text/html'});
    var file = new File([blob], ficheNom, {type:'text/html'});
    var fd = new FormData();
    fd.append('fichier', file, ficheNom);
    fd.append('type', 'fiche');
    fd.append('nom', ficheNom);
    fd.append('visible_client', '0');
    try {
      var r2 = await fetch('/api/documents/client/' + clientId, {
        method:'POST', headers:{'Authorization':'Bearer '+tok}, body: fd
      });
      var dr = await r2.json();
      if (dr.success) {
        if (typeof showToast==='function') showToast('Fiche entretien enregistrée dans le dossier !', true);
      }
    } catch(e2) { console.warn('Fiche non sauvegardée:', e2); }

    /* Retour au dossier client */
    setTimeout(function() {
      if (typeof showPage==='function') showPage('dossier', clientId);
    }, 800);
    if (typeof showToast==='function') {
      showToast('✅ Entretien validé — Score ' + score + '/100 · ' + profil, true);
    } else {
      alert('✅ Entretien validé !\nScore : ' + score + '/100\nProfil : ' + profil + '\nFiche générée et enregistrée dans le dossier.');
    }
  } else if (brouillon) {
    if (typeof showToast==='function') showToast('💾 Brouillon sauvegardé — Score ' + score + '/100', true);
    else alert('💾 Brouillon sauvegardé. Score : ' + score + '/100');
  }
};

/* ================================================================
   ONGLET CONTRAT — Formulaire pré-rempli + génération HTML
   Templates: Coaching 3/5 séances, Mandat d'accompagnement
   ================================================================ */

/* ── Détecter le type de contrat selon la prestation ── */
window._detecterTypeContrat = function(prestation) {
  if (!prestation) return 'coaching3';
  var p = prestation.toLowerCase();
  if (p.includes('5 s')) return 'coaching5';
  if (p.includes('3 s') || p.includes('coaching')) return 'coaching3';
  if (p.includes('mandat') || p.includes('accompagnement')) return 'mandat';
  if (p.includes('business') || p.includes('plan')) return 'mandat';
  if (p.includes('prévisionnel') || p.includes('previsionnel')) return 'mandat';
  if (p.includes('financement') || p.includes('subvention')) return 'mandat';
  if (p.includes('pack')) return 'mandat';
  return 'coaching3';
};

/* ── Extraire le montant depuis la prestation ── */
window._extracterMontant = function(prestation) {
  if (!prestation) return '';
  // Match (210€), (450€), (1500–2500€) etc.
  var m = prestation.match(/\((\d+)/);
  if (m) return m[1];
  // Match standalone numbers
  var m2 = prestation.match(/(\d{3,4})/);
  if (m2) return m2[1];
  return '';
};

/* ── Ouvrir l'onglet Contrat ── */
window.ouvrirContratTab = function(clientId) {
  if (!clientId) { alert("Veuillez d'abord ouvrir un dossier client."); return; }
  var client = typeof getClientById === 'function' ? getClientById(clientId) : null;
  if (!client) { alert("Client introuvable."); return; }

  var typeContrat = window._detecterTypeContrat(client.prestation);
  var montantBase = window._extracterMontant(client.prestation);
  var today = new Date().toLocaleDateString('fr-FR');

  /* Choisir les tabs du bon bloc de contenu */
  var coachingContent = document.getElementById('coaching-content');
  if (coachingContent) {
    // Réutiliser le conteneur coaching pour afficher le formulaire contrat
    document.querySelectorAll('[id^="page-"]').forEach(function(el){ el.style.display='none'; });
    document.getElementById('page-coaching').style.display = 'block';

    /* Changer l'onglet actif visuellement */
    document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('on'); });
    var tabs = document.querySelectorAll('.tab');
    for (var i=0; i<tabs.length; i++) {
      if (tabs[i].textContent.includes('Contrat')) { tabs[i].classList.add('on'); break; }
    }

    /* Render le formulaire */
    window._renderFormulaireContrat(client, typeContrat, montantBase, today);
  }
};

/* ── Rendre le formulaire de contrat ── */
window._renderFormulaireContrat = function(client, typeContrat, montantBase, today) {
  var el = document.getElementById('coaching-content');
  if (!el) return;

  var isCoaching = typeContrat === 'coaching3' || typeContrat === 'coaching5';
  var nbSeances = typeContrat === 'coaching5' ? '5' : '3';
  var montantDefaut = montantBase || (typeContrat === 'coaching5' ? '320' : '210');

  var prixOptions = {
    coaching3: [{l:'Coaching 3 séances – standard',v:'210'},{l:'Coaching 3 séances – réduit',v:'157.5'},{l:'Personnalisé',v:''}],
    coaching5: [{l:'Coaching 5 séances – standard',v:'320'},{l:'Coaching 5 séances – réduit',v:'240'},{l:'Personnalisé',v:''}],
    mandat:    [{l:'Business plan',v:'450'},{l:'Prévisionnel 3 ans',v:'350'},{l:'Dossier financement',v:'Sur devis'},{l:'Dossier subvention',v:'Sur devis'},{l:'Pack Essentiel',v:'590'},{l:'Pack Financement',v:'890'},{l:'Pack Global',v:'1290'},{l:'Personnalisé',v:''}]
  };

  var html = "<div style='max-width:860px;margin:0 auto;padding:0 0 60px'>";

  /* Header */
  html += "<div style='background:#1b2d5b;color:white;padding:14px 20px;border-radius:10px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center'>";
  html += "<div><div style='font-size:16px;font-weight:700'>📄 Génération de contrat</div>";
  html += "<div style='font-size:12px;opacity:0.8;margin-top:2px'>" + client.prenom + " " + client.nom + " — " + (client.prestation||'Prestation non définie') + "</div></div>";
  html += "<button onclick='renderCoachingPage()' style='background:rgba(255,255,255,0.15);border:none;color:white;border-radius:6px;padding:7px 14px;cursor:pointer;font-size:12px'>← Retour coaching</button>";
  html += "</div>";

  /* Type de contrat */
  html += "<div style='background:white;border-radius:10px;padding:20px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,0.05)'>";
  html += "<div style='font-size:13px;font-weight:700;color:#1b2d5b;margin-bottom:14px;border-bottom:1px solid #e0e0e0;padding-bottom:8px'>📋 Type de contrat</div>";
  html += "<div style='display:flex;gap:10px;flex-wrap:wrap'>";
  [['coaching3','🎯 Coaching 3 séances'],['coaching5','🎯 Coaching 5 séances'],['mandat','📝 Mandat d\'accompagnement']].forEach(function(opt){
    var active = typeContrat === opt[0];
    html += "<button onclick='window._changerTypeContrat(\""+opt[0]+"\","+client.id+")' style='padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:2px solid "+(active?"#1b2d5b":"#e0e0e0")+";background:"+(active?"#1b2d5b":"white")+";color:"+(active?"white":"#1b2d5b")+"'>"+opt[1]+"</button>";
  });
  html += "</div></div>";

  /* Informations client */
  html += "<div style='background:white;border-radius:10px;padding:20px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,0.05)'>";
  html += "<div style='font-size:13px;font-weight:700;color:#1b2d5b;margin-bottom:14px;border-bottom:1px solid #e0e0e0;padding-bottom:8px'>👤 Informations client</div>";
  html += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:12px'>";
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>NOM COMPLET</label><input id='ct-nom' value='" + (client.prenom+' '+client.nom).replace(/'/g,"&#39;") + "' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>EMAIL</label><input id='ct-email' value='" + (client.email||'').replace(/'/g,"&#39;") + "' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>ADRESSE LIGNE 1</label><input id='ct-adr1' value='" + (client.adresse||'').split(',')[0].trim().replace(/'/g,"&#39;") + "' placeholder='N°, rue...' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>ADRESSE LIGNE 2 (CP, Ville)</label><input id='ct-adr2' value='" + ((client.adresse||'').split(',').slice(1).join(',').trim()||'').replace(/'/g,"&#39;") + "' placeholder='97xxx Ville' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";
  html += "</div></div>";

  /* Prestation & Prix */
  html += "<div style='background:white;border-radius:10px;padding:20px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,0.05)'>";
  html += "<div style='font-size:13px;font-weight:700;color:#1b2d5b;margin-bottom:14px;border-bottom:1px solid #e0e0e0;padding-bottom:8px'>💶 Prestation & Prix</div>";
  html += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:12px'>";

  /* Quick price select */
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>PRESTATION</label>";
  html += "<select id='ct-prix-sel' onchange='window._majPrix()' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'>";
  (prixOptions[typeContrat]||prixOptions.coaching3).forEach(function(o){
    html += "<option value='"+o.v+"'>"+o.l+"</option>";
  });
  html += "</select></div>";

  /* Montant TTC */
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>MONTANT (€)</label>";
  html += "<input id='ct-montant' type='number' value='" + montantDefaut + "' oninput='window._calcReduction()' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";

  /* Réduction */
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>RÉDUCTION (%)</label>";
  html += "<input id='ct-reduc' type='number' value='0' min='0' max='100' oninput='window._calcReduction()' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";

  /* Montant final */
  html += "<div><label style='font-size:11px;font-weight:700;color:#c9a96e;display:block;margin-bottom:4px'>MONTANT FINAL APRÈS RÉDUCTION</label>";
  html += "<div id='ct-final' style='padding:9px 12px;background:#f8f9fa;border:2px solid #c9a96e;border-radius:7px;font-size:16px;font-weight:700;color:#1b2d5b'>" + montantDefaut + " €</div></div>";

  /* Modalité paiement */
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>MODALITÉ PAIEMENT</label>";
  html += "<select id='ct-modalite' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'>";
  html += "<option>Paiement comptant</option><option>Paiement en 2 fois</option><option>Paiement en 3 fois</option><option>Acompte 30%</option>";
  html += "</select></div>";
  html += "</div>"; /* end grid */

  /* Champs spécifiques mandat */
  if (!isCoaching) {
    html += "<div style='margin-top:14px'>";
    html += "<div style='font-size:12px;font-weight:700;color:#1b2d5b;margin-bottom:8px'>TYPE DE MISSION</div>";
    html += "<div style='display:flex;gap:8px;flex-wrap:wrap'>";
    ['Business plan','Prévisionnel financier','Dossier de financement','Dossier de subvention','Pack','Autre'].forEach(function(t){
      var id = 'ct-chk-'+t.replace(/\s/g,'-').toLowerCase();
      html += "<label style='display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;background:#f0f4f8;padding:6px 12px;border-radius:6px;border:1px solid #e0e0e0'>"
        + "<input type='checkbox' id='"+id+"' value='"+t+"'> "+t+"</label>";
    });
    html += "</div>";
    html += "<div style='margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px'>";
    html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>DATE DÉBUT</label><input id='ct-datedeb' type='date' value='" + new Date().toISOString().slice(0,10) + "' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";
    html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>DURÉE ESTIMÉE</label><input id='ct-duree' value='6 semaines' placeholder='ex: 6 semaines' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";
    html += "</div></div>";
  }
  html += "</div>"; /* end prestation card */

  /* Signature */
  html += "<div style='background:white;border-radius:10px;padding:20px;margin-bottom:14px;box-shadow:0 2px 8px rgba(0,0,0,0.05)'>";
  html += "<div style='font-size:13px;font-weight:700;color:#1b2d5b;margin-bottom:14px;border-bottom:1px solid #e0e0e0;padding-bottom:8px'>✍️ Signature</div>";
  html += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:12px'>";
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>LIEU</label><input id='ct-lieu' value='Trois-Rivières' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";
  html += "<div><label style='font-size:11px;font-weight:700;color:#666;display:block;margin-bottom:4px'>DATE</label><input id='ct-date' type='date' value='" + new Date().toISOString().slice(0,10) + "' style='width:100%;padding:9px 12px;border:1px solid #ddd;border-radius:7px;font-size:13px;box-sizing:border-box'></div>";
  html += "</div></div>";

  /* Boutons action */
  html += "<div style='display:flex;gap:12px;justify-content:center;padding:20px 0'>";
  html += "<button onclick='window._aperçuContrat(\"" + typeContrat + "\"," + client.id + ")' style='background:#1b2d5b;color:white;border:none;border-radius:8px;padding:12px 28px;font-size:14px;font-weight:700;cursor:pointer'>👁️ Aperçu &amp; Impression</button>";
  html += "<button onclick='window._genererEtSauvegarderContrat(\"" + typeContrat + "\"," + client.id + ")' style='background:#c9a96e;color:white;border:none;border-radius:8px;padding:12px 28px;font-size:14px;font-weight:700;cursor:pointer'>💾 Générer &amp; Sauvegarder dans le dossier</button>";
  html += "</div>";
  html += "</div>"; /* end wrapper */

  el.innerHTML = html;

  /* Sélectionner le prix correspondant à la prestation */
  var sel = document.getElementById('ct-prix-sel');
  if (sel && montantDefaut) {
    for (var i=0; i<sel.options.length; i++) {
      if (sel.options[i].value === montantDefaut) { sel.selectedIndex = i; break; }
    }
  }
  window._currentContratType = typeContrat;
  window._currentContratClientId = client.id;
};

/* ── Changer type de contrat ── */
window._changerTypeContrat = function(type, clientId) {
  var client = typeof getClientById === 'function' ? getClientById(clientId) : null;
  if (!client) return;
  window._renderFormulaireContrat(client, type, '', new Date().toLocaleDateString('fr-FR'));
};

/* ── Maj prix depuis le select ── */
window._majPrix = function() {
  var sel = document.getElementById('ct-prix-sel');
  var montantEl = document.getElementById('ct-montant');
  if (sel && montantEl && sel.value) { montantEl.value = sel.value; }
  window._calcReduction();
};

/* ── Calcul montant avec réduction ── */
window._calcReduction = function() {
  var montant = parseFloat(document.getElementById('ct-montant')?.value || 0);
  var reduc = parseFloat(document.getElementById('ct-reduc')?.value || 0);
  if (isNaN(montant)) montant = 0;
  if (isNaN(reduc)) reduc = 0;
  var final = montant * (1 - reduc/100);
  var finalEl = document.getElementById('ct-final');
  if (finalEl) {
    finalEl.textContent = final.toFixed(2).replace('.00','') + ' €';
    finalEl.style.color = reduc > 0 ? '#c9a96e' : '#1b2d5b';
  }
};

/* ── Collecter les données du formulaire ── */
window._collecterDonneesContrat = function() {
  var nom = document.getElementById('ct-nom')?.value || '';
  var adr1 = document.getElementById('ct-adr1')?.value || '';
  var adr2 = document.getElementById('ct-adr2')?.value || '';
  var montantEl = document.getElementById('ct-montant');
  var reducEl = document.getElementById('ct-reduc');
  var montant = parseFloat(montantEl?.value || 0);
  var reduc = parseFloat(reducEl?.value || 0);
  var final = (montant * (1 - reduc/100)).toFixed(2).replace('.00','');
  var modalite = document.getElementById('ct-modalite')?.value || 'Paiement comptant';
  var lieu = document.getElementById('ct-lieu')?.value || 'Trois-Rivières';
  var dateEl = document.getElementById('ct-date');
  var dateVal = dateEl?.value || '';
  var dateFormatted = dateVal ? new Date(dateVal).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');

  /* Mandat specifics */
  var types = [];
  ['business-plan','prévisionnel-financier','dossier-de-financement','dossier-de-subvention','pack','autre'].forEach(function(t){
    var el = document.getElementById('ct-chk-'+t);
    if (el && el.checked) types.push(el.value);
  });
  var dateDeb = document.getElementById('ct-datedeb')?.value || '';
  var dateDebFmt = dateDeb ? new Date(dateDeb).toLocaleDateString('fr-FR') : '';
  var duree = document.getElementById('ct-duree')?.value || '6 semaines';

  return {
    nom_client: nom,
    adresse_client_ligne1: adr1,
    adresse_client_ligne2: adr2,
    montant_prestation: final,
    modalite_paiement: modalite,
    lieu_signature: lieu,
    date_signature: dateFormatted,
    nb_seances: window._currentContratType === 'coaching5' ? '5' : '3',
    /* Mandat */
    type_prestation: types.join(', ') || 'À préciser',
    date_debut_mission: dateDebFmt,
    duree_estimee: duree,
    date_fin_mission: '',
    checkbox_business_plan: types.includes('Business plan') ? '☑' : '☐',
    checkbox_previsionnel: types.includes('Prévisionnel financier') ? '☑' : '☐',
    checkbox_financement: types.includes('Dossier de financement') ? '☑' : '☐',
    checkbox_subvention: types.includes('Dossier de subvention') ? '☑' : '☐',
    checkbox_pack: types.includes('Pack') ? '☑' : '☐',
    checkbox_autre: types.includes('Autre') ? '☑' : '☐',
    checkbox_comptant: modalite === 'Paiement comptant' ? '☑' : '☐',
    checkbox_plusieurs_fois: modalite.includes('fois') ? '☑' : '☐',
    checkbox_acompte: modalite.includes('Acompte') ? '☑' : '☐',
    checkbox_success_fee: '☐',
    qualite_prestataire: 'Le prestataire agit en qualité de conseil uniquement',
    mandat_representation: '☐', mandat_transmission: '☐', mandat_echanges: '☐',
    nb_fois_paiement: modalite.includes('2 fois') ? '2' : modalite.includes('3 fois') ? '3' : '',
    acompte_pct: modalite.includes('Acompte') ? '30' : '',
    acompte_eur: modalite.includes('Acompte') ? (montant*0.3).toFixed(0) : '',
    success_fee_pct: '', detail_pack: '', detail_autre: ''
  };
};

/* ── Générer le HTML du contrat depuis le template ── */
window._genererHTMLContrat = function(type, vars) {
  var today = new Date().toLocaleDateString('fr-FR');

  /* Template coaching */
  var coachingTemplate = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Contrat de prestation</title><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#000;background:#fff}
    .page{width:210mm;min-height:297mm;margin:0 auto;padding:20mm;background:#fff}
    @media print{body{margin:0}.page{width:100%;padding:15mm}}
    .header-block{display:flex;align-items:center;justify-content:center;gap:24px;margin-bottom:16px}
    .logo{width:64px;height:64px;border:2px solid #1F3864;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:7pt;color:#1F3864;font-weight:bold;text-align:center;padding:4px}
    .logo .big{font-size:18pt}
    h1{font-size:22pt;font-weight:bold;color:#1F3864;text-align:center;flex:1}
    hr{border:none;border-top:1.5px solid #ccc;margin:14px 0}
    h2{font-size:13pt;font-weight:bold;color:#1F3864;margin-top:20px;margin-bottom:8px;text-transform:uppercase}
    p{margin-bottom:8px;line-height:1.5}
    ul{margin-left:28px;margin-bottom:8px}
    ul li{margin-bottom:4px;line-height:1.5;list-style-type:disc}
    .sig-block{margin-top:32px;display:flex;justify-content:space-between}
    .sig-col{width:45%}
    .sig-line{border-bottom:1px solid #000;height:40px;margin-top:30px}
    .sig-hint{font-style:italic;font-size:9pt;color:#555;margin-top:4px}
  </style></head><body><div class="page">
    <div class="header-block">
      <div class="logo"><span class="big">CS</span><span>CABINET DE<br>CONSEILS SIMELE</span></div>
      <h1>Contrat de prestation de<br>services</h1>
    </div><hr>
    <p><strong>Entre les soussignés :</strong></p>
    <p><strong>Cabinet de Conseils SIMELE</strong><br>Représenté par Jean-Christophe Simele<br>SIRET : 92787546800039<br>Siège : 20 lotissement Tolbiac 1, 97114 Trois-Rivières</p>
    <p>Ci-après dénommé : <strong>« Le Prestataire »</strong></p>
    <p><strong>Et :</strong></p>
    <p>Nom / Prénom : <strong>{{nom_client}}</strong><br>Adresse : {{adresse_client_ligne1}}<br>{{adresse_client_ligne2}}</p>
    <p>Ci-après dénommé : <strong>« Le Client »</strong></p><hr>
    <h2>Article 1 – Objet du contrat</h2>
    <p>Le présent contrat a pour objet la réalisation d'une prestation d'accompagnement à la création et à la structuration de projet entrepreneurial.</p>
    <p>Le prestataire s'engage à accompagner le client dans le cadre d'un coaching comprenant plusieurs séances, visant à structurer, sécuriser et optimiser son projet.</p>
    <h2>Article 2 – Description de la prestation</h2>
    <ul><li>Un accompagnement en <strong>{{nb_seances}} séances</strong></li><li>Une durée estimée de <strong>2h30 à 3h par séance</strong></li><li>Des échanges personnalisés adaptés au projet du client</li></ul>
    <p>Les thématiques abordées incluent notamment :</p>
    <ul><li>Structuration du projet</li><li>Environnement juridique et administratif</li><li>Dispositifs d'aide</li><li>Structuration financière</li></ul>
    <h2>Article 3 – Engagement du prestataire</h2>
    <ul><li>Fournir un accompagnement professionnel et personnalisé</li><li>Apporter des conseils adaptés à la situation du client</li><li>Mettre en œuvre tous les moyens nécessaires à la bonne réalisation de la prestation</li></ul>
    <p>Le prestataire est tenu à une obligation de moyens et non de résultat.</p>
    <h2>Article 4 – Engagement du client</h2>
    <ul><li>Fournir des informations sincères et complètes</li><li>Être actif et impliqué dans la démarche</li><li>Respecter les rendez-vous fixés</li></ul>
    <h2>Article 5 – Tarifs et modalités de paiement</h2>
    <p>Le montant de la prestation est fixé à : <strong>{{montant_prestation}} €</strong></p>
    <p>Modalité : {{modalite_paiement}}</p>
    <p>Toute prestation commencée est due.</p>
    <h2>Article 6 – Annulation / Report</h2>
    <ul><li>Toute séance annulée moins de 24h à l'avance pourra être considérée comme due</li><li>Un report peut être envisagé d'un commun accord</li></ul>
    <h2>Article 7 – Confidentialité</h2>
    <p>Les parties s'engagent à une stricte confidentialité concernant l'ensemble des informations échangées dans le cadre de la prestation. Cela inclut notamment : les informations personnelles du client, les données liées au projet, les méthodes, outils et documents du prestataire. Aucune information ne pourra être divulguée à un tiers sans accord préalable écrit. Cette obligation reste valable après la fin de la prestation.</p>
    <h2>Article 8 – Propriété intellectuelle</h2>
    <p>Les supports, outils, méthodes et documents transmis restent la propriété exclusive du prestataire. Le client s'engage à ne pas les diffuser, reproduire ou exploiter sans autorisation.</p>
    <h2>Article 9 – Responsabilité</h2>
    <p>Le client reste seul responsable des décisions prises concernant son projet. Le prestataire ne pourra être tenu responsable des résultats obtenus suite à la mise en œuvre des conseils.</p>
    <h2>Article 10 – Acceptation</h2>
    <p>Le présent contrat prend effet à compter de sa signature par les deux parties.</p>
    <p>Fait à : {{lieu_signature}} &nbsp;&nbsp; Le : {{date_signature}}</p>
    <div class="sig-block">
      <div class="sig-col"><p><strong>Signature du client</strong></p><p class="sig-hint">(Précédée de la mention « Lu et approuvé »)</p><div class="sig-line"></div></div>
      <div class="sig-col"><p><strong>Signature du prestataire</strong></p><p class="sig-hint">&nbsp;</p><div class="sig-line"></div></div>
    </div>
  </div></body></html>`;

  /* Template mandat */
  var mandatTemplate = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Contrat mandat</title><style>
    *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#000;background:#fff}
    .page{width:210mm;min-height:297mm;margin:0 auto;padding:20mm;background:#fff}
    @media print{body{margin:0}.page{width:100%;padding:15mm}}
    .header-block{display:flex;align-items:center;justify-content:center;gap:24px;margin-bottom:16px}
    .logo{width:64px;height:64px;border:2px solid #1F3864;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:7pt;color:#1F3864;font-weight:bold;text-align:center;padding:4px}
    .logo .big{font-size:18pt}h1{font-size:22pt;font-weight:bold;color:#1F3864;text-align:center;flex:1}
    hr{border:none;border-top:1.5px solid #ccc;margin:14px 0}
    h2{font-size:13pt;font-weight:bold;color:#1F3864;margin-top:20px;margin-bottom:8px;text-transform:uppercase}
    p{margin-bottom:8px;line-height:1.5}ul{margin-left:28px;margin-bottom:8px}ul li{margin-bottom:4px;line-height:1.5;list-style-type:disc}
    .sig-block{margin-top:32px;display:flex;justify-content:space-between}.sig-col{width:45%}
    .sig-line{border-bottom:1px solid #000;height:40px;margin-top:30px}.sig-hint{font-style:italic;font-size:9pt;color:#555;margin-top:4px}
  </style></head><body><div class="page">
    <div class="header-block">
      <div class="logo"><span class="big">CS</span><span>CABINET DE<br>CONSEILS SIMELE</span></div>
      <h1>Contrat de prestation de<br>services</h1>
    </div><hr>
    <p><strong>Entre les soussignés :</strong></p>
    <p><strong>Cabinet de Conseils SIMELE</strong><br>Représenté par Jean-Christophe Simele<br>SIRET : 92787546800039<br>Siège : 20 lotissement Tolbiac 1, 97114 Trois-Rivières</p>
    <p>Ci-après dénommé : <strong>« Le Prestataire »</strong></p>
    <p><strong>Et :</strong></p>
    <p>Nom / Prénom : <strong>{{nom_client}}</strong><br>Adresse : {{adresse_client_ligne1}}<br>{{adresse_client_ligne2}}</p>
    <p>Ci-après dénommé : <strong>« Le Client »</strong></p><hr>
    <h2>Article 1 – Objet du contrat</h2>
    <p>Le présent contrat a pour objet la réalisation de la prestation suivante : <strong>{{type_prestation}}</strong></p>
    <p>{{checkbox_business_plan}} Business plan &nbsp; {{checkbox_previsionnel}} Prévisionnel financier &nbsp; {{checkbox_financement}} Dossier de financement &nbsp; {{checkbox_subvention}} Dossier de subvention &nbsp; {{checkbox_pack}} Pack : {{detail_pack}} &nbsp; {{checkbox_autre}} Autre : {{detail_autre}}</p>
    <p>Le prestataire est mandaté pour accompagner le client dans la structuration, la préparation et/ou la réalisation de son projet entrepreneurial.</p>
    <h2>Article 2 – Nature de la mission</h2>
    <ul><li>Collecter et analyser les informations du client</li><li>Rédiger des documents (business plan, dossiers de financement, etc.)</li><li>Effectuer des démarches administratives</li><li>Être en relation avec des organismes tiers (banques, partenaires, etc.)</li></ul>
    <p>{{qualite_prestataire}}</p>
    <h2>Article 3 – Durée de la mission</h2>
    <p>La mission débute le : {{date_debut_mission}}</p>
    <p>Durée estimée : {{duree_estimee}}</p>
    <h2>Article 4 – Engagement du prestataire</h2>
    <ul><li>Réaliser la prestation avec diligence et professionnalisme</li><li>Mettre en œuvre les moyens nécessaires à la mission</li><li>Informer le client de l'avancement</li></ul>
    <h2>Article 5 – Engagement du client</h2>
    <ul><li>Fournir des informations exactes, complètes et à jour</li><li>Transmettre les documents nécessaires</li><li>Être disponible pour les échanges</li><li>Valider les éléments transmis</li></ul>
    <h2>Article 6 – Tarifs et modalités de paiement</h2>
    <p>Montant de la prestation : <strong>{{montant_prestation}} €</strong></p>
    <p>{{checkbox_comptant}} Paiement comptant &nbsp; {{checkbox_plusieurs_fois}} Paiement en {{nb_fois_paiement}} fois &nbsp; {{checkbox_acompte}} Acompte {{acompte_pct}}% soit {{acompte_eur}} €</p>
    <h2>Article 7 – Confidentialité</h2>
    <p>Les parties s'engagent à une stricte confidentialité. Cette obligation reste valable après la fin du contrat.</p>
    <h2>Article 8 – Mandat</h2>
    <p>{{mandat_representation}} Représenter le client auprès d'organismes &nbsp; {{mandat_transmission}} Transmettre des documents en son nom &nbsp; {{mandat_echanges}} Échanger avec des partenaires</p>
    <h2>Article 9 – Propriété intellectuelle</h2>
    <p>Les documents produits restent la propriété du prestataire jusqu'au paiement intégral.</p>
    <h2>Article 10 – Responsabilité</h2>
    <p>Le client reste seul responsable des décisions prises. Le prestataire ne garantit pas l'obtention de financements.</p>
    <h2>Article 11 – Annulation / Résiliation</h2>
    <p>En cas d'annulation, l'acompte reste dû et les prestations réalisées sont facturées.</p>
    <h2>Article 12 – Acceptation</h2>
    <p>Le présent contrat prend effet à signature.</p>
    <p>Fait à : {{lieu_signature}} &nbsp;&nbsp; Le : {{date_signature}}</p>
    <div class="sig-block">
      <div class="sig-col"><p><strong>Signature du client</strong></p><p class="sig-hint">(Précédée de la mention « Lu et approuvé »)</p><div class="sig-line"></div></div>
      <div class="sig-col"><p><strong>Signature du prestataire</strong></p><p class="sig-hint">&nbsp;</p><div class="sig-line"></div></div>
    </div>
  </div></body></html>`;

  var template = (type === 'mandat') ? mandatTemplate : coachingTemplate;

  /* Remplacer les variables {{...}} */
  Object.keys(vars).forEach(function(k) {
    var re = new RegExp('\\{\\{' + k + '\\}\\}', 'g');
    template = template.replace(re, vars[k] || '');
  });
  /* Nettoyer les variables non remplacées */
  template = template.replace(/\{\{[^}]+\}\}/g, '');
  return template;
};

/* ── Aperçu du contrat dans une modale ── */
window._aperçuContrat = function(type, clientId) {
  var vars = window._collecterDonneesContrat();
  var html = window._genererHTMLContrat(type || window._currentContratType, vars);
  window._currentContratHTML = html;
  window._currentContratClientId = clientId || window._currentContratClientId;
  window._currentContratClient = typeof getClientById === 'function' ? getClientById(window._currentContratClientId) : {};

  var old = document.getElementById('modal-contrat-preview');
  if (old) old.remove();

  var modal = document.createElement('div');
  modal.id = 'modal-contrat-preview';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box';
  var box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:12px;width:100%;max-width:880px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4)';
  var hdr = document.createElement('div');
  hdr.style.cssText = 'padding:14px 20px;background:#1b2d5b;color:white;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0';
  var client = window._currentContratClient || {};
  hdr.innerHTML = '<div><div style="font-size:15px;font-weight:700">Aperçu du contrat</div><div style="font-size:12px;opacity:0.8">' + (client.prenom||'') + ' ' + (client.nom||'') + ' — ' + (type==='mandat'?'Mandat d\'accompagnement':type==='coaching5'?'Coaching 5 séances':'Coaching 3 séances') + '</div></div>';
  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:10px';
  var bPrint = document.createElement('button');
  bPrint.style.cssText = 'background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600';
  bPrint.innerHTML = '🖨️ Imprimer';
  bPrint.onclick = function(){ window.printContrat(); };
  var bSave = document.createElement('button');
  bSave.style.cssText = 'background:#c9a96e;color:white;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600';
  bSave.innerHTML = '💾 Enregistrer dans le dossier';
  bSave.onclick = function(){ window._genererEtSauvegarderContrat(type, window._currentContratClientId); };
  var bClose = document.createElement('button');
  bClose.style.cssText = 'background:rgba(255,255,255,0.15);color:white;border:none;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:18px;line-height:1';
  bClose.innerHTML = '✕';
  bClose.onclick = function(){ window.fermerModalContrat(); };
  btnRow.appendChild(bPrint); btnRow.appendChild(bSave); btnRow.appendChild(bClose);
  hdr.appendChild(btnRow); box.appendChild(hdr);
  var body = document.createElement('div');
  body.style.cssText = 'flex:1;overflow-y:auto';
  var iframe = document.createElement('iframe');
  iframe.id = 'contrat-iframe';
  iframe.style.cssText = 'width:100%;height:650px;border:none';
  body.appendChild(iframe); box.appendChild(body); modal.appendChild(box);
  document.body.appendChild(modal);
  iframe.srcdoc = html;
};

/* ── Générer et sauvegarder le contrat ── */
window._genererEtSauvegarderContrat = function(type, clientId) {
  var cId = clientId || window._currentContratClientId;
  var vars = window._collecterDonneesContrat();
  var html = window._currentContratHTML || window._genererHTMLContrat(type || window._currentContratType, vars);
  var client = typeof getClientById === 'function' ? getClientById(cId) : {};
  var nom = client ? (client.nom||'client') : 'client';
  var typeLabel = (type==='mandat') ? 'Mandat' : (type==='coaching5' ? 'Coaching5' : 'Coaching3');
  var fname = 'Contrat_' + typeLabel + '_' + nom + '_' + new Date().toISOString().slice(0,10) + '.html';

  var blob = new Blob([html], {type:'text/html'});
  var file = new File([blob], fname, {type:'text/html'});
  var fd = new FormData();
  fd.append('fichier', file, fname);
  fd.append('type', 'contrat');
  fd.append('nom', fname);
  fd.append('visible_client', '1');

  var tok = localStorage.getItem('simele_token') || '';
  fetch('/api/documents/client/' + cId, {method:'POST', headers:{'Authorization':'Bearer '+tok}, body:fd})
    .then(function(r){return r.json();})
    .then(function(d){
      if (d.success) {
        if (typeof showToast === 'function') showToast('✅ Contrat enregistré dans le dossier !', true);
        window.fermerModalContrat();
      } else {
        if (typeof showToast === 'function') showToast('Erreur: ' + (d.error||''), false);
      }
    }).catch(function(e){ if (typeof showToast === 'function') showToast('Erreur réseau: '+e.message, false); });
};
