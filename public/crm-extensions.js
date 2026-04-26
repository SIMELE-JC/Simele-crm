
/* CRM SIMELE - Extensions v2 */
/* Contrat, Documents, Programme */

/* ===== CONTRAT : Apercu + Sauvegarde ===== */
window.fermerModalContrat = function() {
  var m = document.getElementById("modal-contrat-preview");
  if (m) m.remove();
};

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
  bRow.appendChild(bPrint);
  bRow.appendChild(bSave);
  bRow.appendChild(bClose);
  hdr.appendChild(bRow);
  box.appendChild(hdr);
  var body = document.createElement("div");
  body.style.cssText = "flex:1;overflow-y:auto";
  var iframe = document.createElement("iframe");
  iframe.id = "contrat-iframe";
  iframe.style.cssText = "width:100%;height:600px;border:none";
  body.appendChild(iframe);
  box.appendChild(body);
  modal.appendChild(box);
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
  fd.append("fichier", file, nom);
  fd.append("type", "contrat");
  fd.append("nom", nom);
  fd.append("visible_client", "1");
  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/documents/client/" + clientId, { method: "POST", headers: { "Authorization": "Bearer " + tok }, body: fd })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        if (typeof showToast === "function") showToast("Contrat enregistre dans le dossier !", true);
        window.fermerModalContrat();
        if (typeof window.chargerDocuments === "function") window.chargerDocuments();
      } else {
        if (typeof showToast === "function") showToast("Erreur: " + (d.error || ""), false);
      }
    })
    .catch(function() { if (typeof showToast === "function") showToast("Erreur reseau.", false); });
};

/* ===== DOCUMENTS : Liste avec apercu, download, rename, classify ===== */
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
        container.innerHTML = "<div style='text-align:center;padding:30px;color:#999'>"
          + "<div style='font-size:48px;margin-bottom:12px'>&#128193;</div>"
          + "<p style='font-size:14px'>Aucun document pour ce client.</p>"
          + "<p style='font-size:12px'>Utilisez la zone ci-dessus pour ajouter un fichier.</p></div>";
        return;
      }
      var tl = { fiche:"Fiche/CR", devis:"Devis", contrat:"Contrat", identite:"Identite",
                 siege:"Siege social", activite:"Activite", gestion:"Gestion", autre:"Autre",
                 document:"Document", rapport:"Rapport", facture:"Facture" };
      var tc = { fiche:"#9b59b6", devis:"#3498db", contrat:"#2ecc71", identite:"#e67e22",
                 siege:"#1abc9c", activite:"#e74c3c", gestion:"#95a5a6", autre:"#7f8c8d",
                 document:"#95a5a6", rapport:"#8e44ad", facture:"#f39c12" };
      var ei = { pdf:"&#128196;", doc:"&#128196;", docx:"&#128196;", xls:"&#128200;",
                 xlsx:"&#128200;", jpg:"&#128247;", jpeg:"&#128247;", png:"&#128247;",
                 gif:"&#128247;", txt:"&#128196;", html:"&#127760;" };
      var html2 = "<div style='display:flex;flex-direction:column;gap:8px'>";
      docs.forEach(function(doc) {
        var ext = (doc.nom || "").split(".").pop().toLowerCase();
        var icon = ei[ext] || "&#128193;";
        var color = tc[doc.type] || "#95a5a6";
        var label = tl[doc.type] || doc.type || "Document";
        var size = doc.taille > 0
          ? (doc.taille > 1048576 ? (doc.taille / 1048576).toFixed(1) + "Mo" : Math.round(doc.taille / 1024) + "Ko")
          : "";
        var date = doc.created_at ? doc.created_at.slice(0, 10) : "";
        var canP = ["pdf","jpg","jpeg","png","gif","html"].includes(ext);
        var safeNom = (doc.nom || "").replace(/\/g, "\\").replace(/'/g, "\'");
        var btnP = canP
          ? "<button onclick="window.previewDoc(" + doc.id + ")" title='Apercu' style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px'>&#128269;</button>"
          : "";
        var btnD = "<a href='/api/documents/" + doc.id + "/download' target='_blank' title='Telecharger'"
          + " style='background:#e8f4fd;border:1px solid #3498db;border-radius:6px;padding:6px 10px;"
          + "font-size:12px;color:#3498db;text-decoration:none;display:inline-flex;align-items:center'>&#8659;</a>";
        var btnR = "<button onclick="window.renommerDoc(" + doc.id + ",'" + safeNom + "')" title='Renommer'"
          + " style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px'>&#9998;</button>";
        var btnT = "<button onclick="window.reclassifierDoc(" + doc.id + ")" title='Changer le type'"
          + " style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px'>&#127991;</button>";
        var btnX = "<button onclick="window.supprimerDoc(" + doc.id + ")" title='Supprimer'"
          + " style='background:#fdf0f0;border:1px solid #e74c3c;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;color:#e74c3c'>&#128465;</button>";
        html2 += "<div id='docrow" + doc.id + "' style='background:white;border:1px solid #e8eaed;"
          + "border-left:4px solid " + color + ";border-radius:8px;padding:12px 14px'>"
          + "<div style='display:flex;align-items:center;gap:10px'>"
          + "<span style='font-size:22px'>" + icon + "</span>"
          + "<div style='flex:1;min-width:0'>"
          + "<div style='font-size:13px;font-weight:600;color:#1b2d5b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>" + doc.nom + "</div>"
          + "<div style='display:flex;gap:8px;align-items:center;margin-top:3px'>"
          + "<span style='background:" + color + ";color:white;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600'>" + label + "</span>"
          + (size ? "<span style='font-size:11px;color:#999'>" + size + "</span>" : "")
          + (date ? "<span style='font-size:11px;color:#999'>" + date + "</span>" : "")
          + "</div></div>"
          + "<div style='display:flex;gap:6px;flex-shrink:0'>" + btnP + btnD + btnR + btnT + btnX + "</div>"
          + "</div></div>";
      });
      html2 += "</div>";
      container.innerHTML = html2;
    })
    .catch(function(e) {
      container.innerHTML = "<p style='color:red;text-align:center;padding:20px'>Erreur: " + e.message + "</p>";
    });
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
  fetch("/api/documents/" + docId, {
    method: "PUT",
    headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/json" },
    body: JSON.stringify({ nom: newNom, visible_client: 1 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      if (typeof showToast === "function") showToast("Document renomme.", true);
      window.chargerDocuments();
    } else {
      if (typeof showToast === "function") showToast("Erreur.", false);
    }
  });
};

window.reclassifierDoc = function(docId) {
  var types = [
    ["fiche",    "Fiche / CR / Rapport"],
    ["devis",    "Devis"],
    ["contrat",  "Contrat"],
    ["identite", "Justificatif d'identite"],
    ["siege",    "Justificatif de siege social"],
    ["activite", "Justificatif d'activite"],
    ["gestion",  "Document de gestion diverse"],
    ["autre",    "Autre document"]
  ];
  var msg = "Choisir le nouveau type:
" + types.map(function(t, i) { return (i + 1) + ". " + t[1]; }).join("
") + "

Entrez le numero :";
  var choice = prompt(msg);
  if (!choice) return;
  var idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= types.length) {
    if (typeof showToast === "function") showToast("Choix invalide.", false);
    return;
  }
  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/documents/" + docId, {
    method: "PUT",
    headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/json" },
    body: JSON.stringify({ type: types[idx][0], visible_client: 1 })
  }).then(function(r) { return r.json(); }).then(function(d) {
    if (d.success) {
      if (typeof showToast === "function") showToast("Type modifie.", true);
      window.chargerDocuments();
    }
  });
};

window.supprimerDoc = function(docId) {
  if (!confirm("Supprimer ce document ? Cette action est irreversible.")) return;
  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/documents/" + docId, { method: "DELETE", headers: { "Authorization": "Bearer " + tok } })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.success) {
        if (typeof showToast === "function") showToast("Document supprime.", true);
        window.chargerDocuments();
      } else {
        if (typeof showToast === "function") showToast("Erreur suppression.", false);
      }
    });
};

/* ===== PROGRAMME : Selection client + service + impression ===== */
window.updateProgramme = function() {
  var cSel = document.getElementById("prog-client-select");
  var sSel = document.getElementById("prog-service-select");
  var cnt  = document.getElementById("programme-content");
  if (!cnt) return;
  var cId = cSel ? cSel.value : "";
  var sId = sSel ? sSel.value : "";
  if (!cId || !sId) {
    cnt.innerHTML = "<div style='text-align:center;padding:60px;color:#999'>"
      + "<div style='font-size:48px;margin-bottom:16px'>&#127963;</div>"
      + "<div style='font-size:16px;font-weight:600'>Selectionnez un client et un service</div></div>";
    return;
  }
  var client = typeof getClientById === "function" ? getClientById(parseInt(cId)) : null;
  if (!client) return;
  var today = new Date().toLocaleDateString("fr-FR");
  var PROGS = {
    coaching3: { titre: "Coaching Strategique - 3 Seances", prix: "210 EUR", seances: [
      { n:1, t:"Structuration du projet & environnement", d:"2h30-3h",
        pts:["Analyse du projet et simplification","Identification de la cible client et positionnement de l'offre",
             "Presentation des statuts juridiques (SASU, EURL, micro-entreprise...)",
             "Demarches d'immatriculation et obligations URSSAF","Identification des organismes sociaux et fiscaux"],
        r:"Projet clair - Orientation juridique - Vision de lancement" },
      { n:2, t:"Strategie & dispositifs d'aide", d:"2h30-3h",
        pts:["Identification des besoins financiers","Analyse des dispositifs d'aide (ACRE, NACRE, LADOM, ARCE...)",
             "Strategie de lancement progressive","Plan d'action structure avec jalons cles","Conseils pratiques et orientation"],
        r:"Strategie optimisee - Aides identifiees - Plan d'action" },
      { n:3, t:"Structuration financiere & projection", d:"2h30-3h",
        pts:["Aides a la creation et conditions d'eligibilite","Introduction au previsionnel financier 3 ans",
             "Structuration des prix et marges","Preparation aux demandes de financement bancaire"],
        r:"Vision financiere claire - Projet credible et structure" }
    ]},
    coaching5: { titre: "Coaching Strategique - 5 Seances", prix: "320 EUR", seances: [
      { n:1, t:"Structuration du projet", d:"2h30-3h", pts:["Analyse du concept","Cible client et positionnement","Statuts juridiques adaptes"], r:"Projet structure" },
      { n:2, t:"Strategie et aides", d:"2h30-3h", pts:["Dispositifs d'aide mobilisables","Plan de lancement progressif"], r:"Aides identifiees" },
      { n:3, t:"Structuration financiere", d:"2h30-3h", pts:["Previsionnel sur 3 ans","Prix et marges"], r:"Vision financiere" },
      { n:4, t:"Suivi et ajustements", d:"2h30-3h", pts:["Bilan des avancees","Ajustements strategiques"], r:"Projet optimise" },
      { n:5, t:"Finalisation et lancement", d:"2h30-3h", pts:["Revue complete du dossier","Plan de lancement definitif","Mise en reseau"], r:"Pret au lancement" }
    ]},
    diag: { titre: "Diagnostic de Projet", prix: "80 EUR", seances: [
      { n:1, t:"Diagnostic complet", d:"1h30",
        pts:["Analyse de viabilite du concept","Etude rapide du marche cible","Identification des forces et faiblesses","Recommandations concretes et prioritaires"],
        r:"Vision claire des axes d'amelioration" }
    ]},
    bp: { titre: "Business Plan Complet", prix: "450 EUR", seances: [
      { n:1, t:"Collecte et analyse", d:"2h", pts:["Recueil des informations cles","Analyse du marche et de la concurrence","Validation des hypotheses"], r:"Base solide pour la redaction" },
      { n:2, t:"Redaction et livraison", d:"Variable", pts:["Redaction complete du business plan","Relecture et ajustements","Livraison du document final"], r:"Business plan professionnel pret a l'emploi" }
    ]},
    prev: { titre: "Previsionnel Financier 3 ans", prix: "350 EUR", seances: [
      { n:1, t:"Collecte des donnees", d:"1h30", pts:["Hypotheses de chiffre d'affaires","Charges fixes et variables","Estimation du BFR"], r:"Donnees validees" },
      { n:2, t:"Construction et livraison", d:"Variable", pts:["Compte de resultat previsionnel","Plan de tresorerie","Livraison sous Excel"], r:"Previsionnel financier complet sur 3 ans" }
    ]}
  };
  var prog = PROGS[sId];
  if (!prog) {
    var optTxt = (sSel && sSel.options[sSel.selectedIndex]) ? sSel.options[sSel.selectedIndex].text : "Service sur mesure";
    prog = { titre: optTxt, prix: "Sur devis", seances: [
      { n:1, t:"Programme sur mesure", d:"Variable", pts:["Programme adapte a vos besoins specifiques","Contenu defini en concertation avec le client"], r:"Programme personnalise" }
    ]};
  }
  var seancesHTML = prog.seances.map(function(s) {
    return "<div style='border:1px solid #e0e0e0;border-left:4px solid #1b2d5b;border-radius:8px;padding:16px;margin-bottom:12px'>"
      + "<div style='display:flex;align-items:center;gap:12px;margin-bottom:10px'>"
      + "<div style='background:#1b2d5b;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0'>" + s.n + "</div>"
      + "<div><div style='font-size:15px;font-weight:700;color:#1b2d5b'>" + s.t + "</div>"
      + "<div style='font-size:12px;color:#c9a96e;font-weight:600'>Duree : " + s.d + "</div></div></div>"
      + "<ul style='margin:0 0 10px 20px;padding:0'>" + s.pts.map(function(p) { return "<li style='font-size:13px;color:#444;margin-bottom:4px'>" + p + "</li>"; }).join("") + "</ul>"
      + "<div style='background:#f0f4f8;border-radius:6px;padding:8px 12px;font-size:12px;color:#1b2d5b'><strong>Resultat attendu :</strong> " + s.r + "</div>"
      + "</div>";
  }).join("");
  cnt.innerHTML = "<div style='background:white;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06)'>"
    + "<div id='prog-print-area'>"
    + "<div style='display:flex;justify-content:space-between;align-items:start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1b2d5b'>"
    + "<div><div style='font-size:11px;color:#c9a96e;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px'>Cabinet de Conseils SIMELE</div>"
    + "<div style='font-size:22px;font-weight:700;color:#1b2d5b'>" + prog.titre + "</div></div>"
    + "<div style='text-align:right'>"
    + "<div style='background:#1b2d5b;color:white;padding:8px 16px;border-radius:8px;font-size:12px;margin-bottom:6px'>&#128100; " + client.prenom + " " + client.nom + "</div>"
    + "<div style='font-size:20px;font-weight:700;color:#c9a96e'>" + prog.prix + "</div>"
    + "<div style='font-size:11px;color:#999'>" + today + "</div></div></div>"
    + seancesHTML
    + "<div style='margin-top:16px;padding:16px;background:#f8f9fa;border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:16px'>"
    + "<div><div style='font-size:12px;font-weight:700;color:#c9a96e;margin-bottom:8px'>BENEFICES</div>"
    + "<ul style='margin:0 0 0 16px;font-size:12px;color:#555'>"
    + "<li>Gain de temps sur les demarches</li><li>Eviter les erreurs couteuses</li>"
    + "<li>Bonnes decisions strategiques</li><li>Securiser le lancement</li></ul></div>"
    + "<div><div style='font-size:12px;font-weight:700;color:#c9a96e;margin-bottom:8px'>CABINET</div>"
    + "<div style='font-size:12px;color:#555'>Jean-Christophe Simele<br>SIRET : 92787546800039<br>20 lot. Tolbiac 1<br>97114 Trois-Rivieres</div></div>"
    + "</div></div></div>";
};

window.imprimerProgramme = function() {
  var area = document.getElementById("prog-print-area");
  if (!area) { alert("Selectionnez un client et un service d'abord."); return; }
  var w = window.open("", "_blank");
  w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Programme SIMELE</title>"
    + "<style>body{font-family:Arial,sans-serif;margin:30px;font-size:13px}ul{margin:6px 0 6px 20px}li{margin:3px 0}@media print{body{margin:15px}}</style></head><body>"
    + area.innerHTML + "</body></html>");
  w.document.close();
  setTimeout(function() { w.print(); }, 500);
};

/* Populate client select when programme page opens */
document.addEventListener("DOMContentLoaded", function() {
  var orig = window.showPage;
  window.showPage = function(id, clientId) {
    if (typeof orig === "function") orig(id, clientId);
    if (id === "programme") {
      setTimeout(function() {
        var sel = document.getElementById("prog-client-select");
        if (sel && typeof clients !== "undefined" && clients.length && sel.options.length <= 1) {
          clients.forEach(function(c) {
            var o = document.createElement("option");
            o.value = c.id;
            o.textContent = c.prenom + " " + c.nom;
            sel.appendChild(o);
          });
        }
        if (sel && typeof currentClientId !== "undefined" && currentClientId) {
          sel.value = currentClientId;
          window.updateProgramme();
        }
      }, 300);
    }
  };
});
