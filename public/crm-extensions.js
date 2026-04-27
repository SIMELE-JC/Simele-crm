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
