/* CRM SIMELE - Extensions v3 - No async */

/* ===== FIX: sauvegarderEntretien ===== */
window.sauvegarderEntretien = function() {
  var clientId = window.currentClientId;
  if (!clientId) { alert("Client non identifie"); return; }
  var scoreEl = document.getElementById("live-score") || document.getElementById("big-score") || document.getElementById("score-num");
  var score = scoreEl ? (parseInt(scoreEl.textContent) || 0) : 0;
  var profilEl = document.getElementById("profil-select") || document.querySelector("select[id*=profil]");
  var profil = profilEl ? profilEl.value : "A qualifier";
  if (!profil) profil = "A qualifier";
  var notesEl = document.querySelector("#entretien-notes, #notes-entretien");
  var notes = notesEl ? notesEl.value : "";
  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/clients/" + clientId + "/entretien", {
    method: "POST",
    headers: {"Content-Type": "application/json", "Authorization": "Bearer " + tok},
    body: JSON.stringify({score: score, profil: profil, notes: notes, situation: "", projet: "", besoins: "", recommandations: "", prochaine_etape: ""})
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.success) {
      if (typeof showToast === "function") showToast("Entretien sauvegarde !", true);
      else alert("Entretien sauvegarde !");
      if (typeof chargerClient === "function") chargerClient(clientId);
    } else { alert("Erreur: " + (data.error || "Inconnue")); }
  }).catch(function(e) { alert("Erreur connexion: " + e.message); });
};

/* ===== COACHING: Navigation bloc par bloc ===== */
window._coachingBlocState = {};

window.renderCoachingSeance = function(clientId, num) {
  var client = typeof getClientById === "function" ? getClientById(clientId) : null;
  var si = typeof SEANCE_DATA !== "undefined" ? SEANCE_DATA[num] : null;
  if (!si || !client) return;
  var sessions = (typeof _coachingData !== "undefined" && _coachingData[clientId]) ? _coachingData[clientId] : {};
  var session = sessions[num] || {};
  var stateKey = clientId + "_" + num;
  if (!window._coachingBlocState[stateKey]) { window._coachingBlocState[stateKey] = {blocIdx: 0, answers: {}}; }
  var state = window._coachingBlocState[stateKey];
  for (var bi = 0; bi < si.blocs.length; bi++) {
    try {
      var saved = JSON.parse(session["bloc" + (bi + 1)] || "{}");
      for (var qi = 0; qi < si.blocs[bi].q.length; qi++) {
        var k = "b" + (bi + 1) + "_q" + qi;
        if (!state.answers[k] && saved["q" + qi]) state.answers[k] = saved["q" + qi];
      }
    } catch(e2) {}
  }
  var synthMap = [["pts_cles","synthese_points_cles"],["risques","synthese_risques"],["opportunites","synthese_opportunites"],["next","synthese_prochaines_etapes"]];
  for (var sm = 0; sm < synthMap.length; sm++) {
    var skk = "synth_" + synthMap[sm][0];
    if (!state.answers[skk] && session[synthMap[sm][1]]) state.answers[skk] = session[synthMap[sm][1]];
  }
  window._renderBlocNav(clientId, num, state.blocIdx);
};

window._renderBlocNav = function(clientId, num, blocIdx) {
  var si = SEANCE_DATA[num];
  var client = getClientById(clientId);
  var sessions = (_coachingData && _coachingData[clientId]) ? _coachingData[clientId] : {};
  var session = sessions[num] || {};
  var el = document.getElementById("coaching-content");
  if (!el) return;
  var stateKey = clientId + "_" + num;
  var state = window._coachingBlocState[stateKey] || {blocIdx: 0, answers: {}};
  var bloc = si.blocs[blocIdx];
  var totalBlocs = si.blocs.length;
  var isLast = blocIdx === totalBlocs - 1;
  var statut = session.statut || "en_cours";
  var pct = Math.round(((blocIdx + 1) / totalBlocs) * 100);
  var cl = clientId; var n = num; var bi2 = blocIdx;

  var html = "<div style='max-width:820px;margin:0 auto;padding-bottom:40px'>";
  // Header
  html += "<div style='background:white;border-radius:12px;padding:16px 20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.08)'>";
  html += "<div style='display:flex;align-items:center;gap:12px;margin-bottom:12px'>";
  html += "<button onclick='renderCoachingPage()' style='background:#f0f4f8;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;color:#1b2d5b;font-weight:600'>&#8592; Retour</button>";
  html += "<div style='flex:1'><div style='font-size:15px;font-weight:700;color:#1b2d5b'>" + si.titre + "</div>";
  html += "<div style='font-size:11px;color:#999'>" + si.duree + " &middot; " + client.prenom + " " + client.nom + "</div></div>";
  html += "<select id='statut-seance' style='padding:6px 10px;border-radius:8px;border:1px solid #e0e0e0;font-size:12px'>";
  html += "<option value='en_cours'" + (statut === "en_cours" ? " selected" : "") + ">En cours</option>";
  html += "<option value='terminee'" + (statut === "terminee" ? " selected" : "") + ">Terminee</option>";
  html += "</select></div>";
  // Progress
  html += "<div style='display:flex;align-items:center;gap:10px;margin-bottom:10px'>";
  html += "<div style='flex:1;background:#f0f4f8;border-radius:10px;height:6px'>";
  html += "<div style='background:#1b2d5b;height:6px;border-radius:10px;width:" + pct + "%'></div></div>";
  html += "<span style='font-size:12px;font-weight:700;color:#1b2d5b;white-space:nowrap'>Bloc " + (blocIdx + 1) + " / " + totalBlocs + "</span></div>";
  // Bloc tabs
  html += "<div style='display:flex;gap:6px;flex-wrap:wrap'>";
  for (var ti = 0; ti < totalBlocs; ti++) {
    var bg2 = ti === blocIdx ? "#1b2d5b" : (ti < blocIdx ? "#2ecc71" : "#f0f4f8");
    var col2 = (ti === blocIdx || ti < blocIdx) ? "white" : "#555";
    html += "<button onclick='window._saveCurrentBloc(" + cl + "," + n + "); window._renderBlocNav(" + cl + "," + n + "," + ti + ")' ";
    html += "style='background:" + bg2 + ";color:" + col2 + ";border:none;border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;cursor:pointer'>";
    html += (ti < blocIdx ? "&#10003; " : "") + "Bloc " + (ti + 1) + "</button>";
  }
  html += "</div></div>";

  // Questions bloc courant
  html += "<div style='background:white;border-radius:12px;padding:24px;margin-bottom:16px;border-left:4px solid " + si.couleur + ";box-shadow:0 2px 8px rgba(0,0,0,0.06)'>";
  html += "<div style='font-size:14px;font-weight:700;color:" + si.couleur + ";margin-bottom:16px'>" + bloc.t + "</div>";
  for (var qi2 = 0; qi2 < bloc.q.length; qi2++) {
    var key2 = "b" + (blocIdx + 1) + "_q" + qi2;
    var savedVal = state.answers[key2] || "";
    savedVal = savedVal.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    html += "<div style='margin-bottom:16px'>";
    html += "<label style='display:block;font-size:13px;font-weight:600;color:#1b2d5b;margin-bottom:6px'>" + (qi2 + 1) + ". " + bloc.q[qi2] + "</label>";
    html += "<textarea id='" + key2 + "' ";
    html += "oninput="window._coachingBlocState['" + stateKey + "'].answers['" + key2 + "']=this.value" ";
    html += "style='width:100%;min-height:80px;padding:10px;border:1.5px solid #e0e0e0;border-radius:8px;font-size:13px;resize:vertical;font-family:inherit;box-sizing:border-box' placeholder='Reponse...'>" + savedVal + "</textarea>";
    html += "</div>";
  }
  html += "</div>";

  // Synthese (dernier bloc)
  if (isLast) {
    var synthF = [["pts_cles","Points cles"],["risques","Risques identifies"],["opportunites","Opportunites"],["next","Prochaines etapes"]];
    html += "<div style='background:#f0f4ff;border-radius:12px;padding:20px;margin-bottom:16px;border:1px solid #c5cae9'>";
    html += "<div style='font-size:14px;font-weight:700;color:#1b2d5b;margin-bottom:14px'>&#128203; Synthese coach</div>";
    html += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:12px'>";
    for (var sf = 0; sf < synthF.length; sf++) {
      var sfKey = synthF[sf][0]; var sfLbl = synthF[sf][1];
      var sfVal = (state.answers["synth_" + sfKey] || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      html += "<div><label style='display:block;font-size:11px;font-weight:700;color:#1b2d5b;margin-bottom:4px'>" + sfLbl + "</label>";
      html += "<textarea id='synth_" + sfKey + "' ";
      html += "oninput="window._coachingBlocState['" + stateKey + "'].answers['synth_" + sfKey + "']=this.value" ";
      html += "style='width:100%;min-height:70px;padding:8px;border:1px solid #c5cae9;border-radius:6px;font-size:12px;resize:vertical;font-family:inherit;box-sizing:border-box'>" + sfVal + "</textarea></div>";
    }
    html += "</div></div>";
  }

  // Boutons navigation
  html += "<div style='display:flex;justify-content:space-between;align-items:center;gap:12px'>";
  if (blocIdx > 0) {
    html += "<button onclick='window._saveCurrentBloc(" + cl + "," + n + "); window._renderBlocNav(" + cl + "," + n + "," + (bi2 - 1) + ")' ";
    html += "style='background:#f0f4f8;color:#1b2d5b;border:none;border-radius:8px;padding:12px 20px;cursor:pointer;font-size:13px;font-weight:600'>&#8592; Precedent</button>";
  } else { html += "<div></div>"; }
  html += "<button onclick='window._saveCurrentBloc(" + cl + "," + n + "); window.saveCoachingSeance(" + cl + "," + n + ")' ";
  html += "style='background:white;color:#1b2d5b;border:2px solid #1b2d5b;border-radius:8px;padding:12px 20px;cursor:pointer;font-size:13px;font-weight:600'>&#128190; Enregistrer brouillon</button>";
  if (!isLast) {
    html += "<button onclick='window._saveCurrentBloc(" + cl + "," + n + "); window._renderBlocNav(" + cl + "," + n + "," + (bi2 + 1) + ")' ";
    html += "style='background:#1b2d5b;color:white;border:none;border-radius:8px;padding:12px 24px;cursor:pointer;font-size:13px;font-weight:700'>Suivant &#8594;</button>";
  } else {
    html += "<button onclick='window._saveCurrentBloc(" + cl + "," + n + "); window.validerSeanceCoaching(" + cl + "," + n + ")' ";
    html += "style='background:#c9a96e;color:white;border:none;border-radius:8px;padding:12px 24px;cursor:pointer;font-size:13px;font-weight:700'>&#10003; Valider la seance</button>";
  }
  html += "</div></div>";

  el.innerHTML = html;
  window._coachingBlocState[stateKey].blocIdx = blocIdx;
  window.scrollTo(0, 0);
};

window._saveCurrentBloc = function(clientId, num) {
  var stateKey = clientId + "_" + num;
  var state = window._coachingBlocState[stateKey];
  if (!state) return;
  var si = SEANCE_DATA[num];
  var blocIdx = state.blocIdx;
  var bloc = si.blocs[blocIdx];
  for (var qi = 0; qi < bloc.q.length; qi++) {
    var key = "b" + (blocIdx + 1) + "_q" + qi;
    var el = document.getElementById(key);
    if (el) state.answers[key] = el.value;
  }
  if (blocIdx === si.blocs.length - 1) {
    ["pts_cles","risques","opportunites","next"].forEach(function(k) {
      var el2 = document.getElementById("synth_" + k);
      if (el2) state.answers["synth_" + k] = el2.value;
    });
  }
};

window.saveCoachingSeance = function(clientId, num) {
  window._saveCurrentBloc(clientId, num);
  var stateKey = clientId + "_" + num;
  var state = window._coachingBlocState[stateKey] || {answers: {}};
  var si = SEANCE_DATA[num];
  var statEl = document.getElementById("statut-seance");
  var payload = {statut: statEl ? statEl.value : "en_cours"};
  for (var bi = 0; bi < si.blocs.length; bi++) {
    var b = {};
    for (var qi2 = 0; qi2 < si.blocs[bi].q.length; qi2++) { b["q" + qi2] = state.answers["b" + (bi + 1) + "_q" + qi2] || ""; }
    payload["bloc" + (bi + 1)] = b;
  }
  payload.synthese_points_cles = state.answers["synth_pts_cles"] || "";
  payload.synthese_risques = state.answers["synth_risques"] || "";
  payload.synthese_opportunites = state.answers["synth_opportunites"] || "";
  payload.synthese_prochaines_etapes = state.answers["synth_next"] || "";
  API.post("/coaching/" + clientId + "/seance/" + num, payload).then(function(resp) {
    if (resp && resp.session) {
      if (!_coachingData[clientId]) _coachingData[clientId] = {};
      _coachingData[clientId][num] = resp.session;
      if (typeof showToast === "function") showToast("Brouillon enregistre !", true);
    } else { if (typeof showToast === "function") showToast("Erreur enregistrement.", false); }
  }).catch(function(e) { if (typeof showToast === "function") showToast("Erreur: " + e.message, false); });
};

window.validerSeanceCoaching = function(clientId, num) {
  window._saveCurrentBloc(clientId, num);
  var stateKey = clientId + "_" + num;
  var state = window._coachingBlocState[stateKey] || {answers: {}};
  var si = SEANCE_DATA[num];
  var payload = {statut: "terminee"};
  for (var bi = 0; bi < si.blocs.length; bi++) {
    var b = {};
    for (var qi2 = 0; qi2 < si.blocs[bi].q.length; qi2++) { b["q" + qi2] = state.answers["b" + (bi + 1) + "_q" + qi2] || ""; }
    payload["bloc" + (bi + 1)] = b;
  }
  payload.synthese_points_cles = state.answers["synth_pts_cles"] || "";
  payload.synthese_risques = state.answers["synth_risques"] || "";
  payload.synthese_opportunites = state.answers["synth_opportunites"] || "";
  payload.synthese_prochaines_etapes = state.answers["synth_next"] || "";
  API.post("/coaching/" + clientId + "/seance/" + num, payload).then(function(resp) {
    if (resp && resp.session) {
      if (!_coachingData[clientId]) _coachingData[clientId] = {};
      _coachingData[clientId][num] = resp.session;
      if (typeof showToast === "function") showToast("Seance " + num + " validee !", true);
      setTimeout(function() { renderCoachingPage(); }, 1200);
    } else { if (typeof showToast === "function") showToast("Erreur validation.", false); }
  }).catch(function(e) { if (typeof showToast === "function") showToast("Erreur: " + e.message, false); });
};

/* ===== CONTRAT ===== */
window.fermerModalContrat = function() {
  var m = document.getElementById("modal-contrat-preview"); if (m) m.remove();
};
window.genererContratPrestation = function() {
  var id = window._currentDocsClientId;
  if (!id) { var sel = document.getElementById("docs-global-client-select"); if (sel && sel.value) { window.changerClientDocs(sel.value); id = window._currentDocsClientId; } }
  if (!id) { alert("Veuillez selectionner un client."); return; }
  var client = typeof getClientById === "function" ? getClientById(id) : null;
  if (!client) { alert("Client introuvable."); return; }
  var montantEl = document.getElementById("montant_cp");
  var service = window._selectedService || {};
  var prix = (montantEl && montantEl.value) ? (montantEl.value + " EUR") : (service.prix || "210 EUR");
  var adresseEl = document.getElementById("adresse_client_cp");
  var adresse = (adresseEl && adresseEl.value) || client.adresse || "_______________";
  var contratHTML = typeof contratBase === "function" ? contratBase(service.seances || "3", prix, {prenom: client.prenom, nom: client.nom, adresse: adresse}) : "<p>Erreur contratBase</p>";
  window._currentContratHTML = contratHTML; window._currentContratClient = client; window._currentContratClientId = id;
  var old = document.getElementById("modal-contrat-preview"); if (old) old.remove();
  var modal = document.createElement("div"); modal.id = "modal-contrat-preview";
  modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box";
  var box = document.createElement("div"); box.style.cssText = "background:white;border-radius:12px;width:100%;max-width:860px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.4)";
  var hdr = document.createElement("div"); hdr.style.cssText = "padding:16px 20px;background:#1b2d5b;color:white;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0";
  hdr.innerHTML = "<div><div style='font-size:16px;font-weight:700'>Apercu du contrat</div><div style='font-size:12px;opacity:0.8'>" + client.prenom + " " + client.nom + " &mdash; " + (service.label || "Contrat") + "</div></div>";
  var bRow = document.createElement("div"); bRow.style.cssText = "display:flex;gap:10px";
  var bPrint = document.createElement("button"); bPrint.style.cssText = "background:rgba(255,255,255,0.2);color:white;border:1px solid rgba(255,255,255,0.4);border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600"; bPrint.innerHTML = "&#128196; Imprimer"; bPrint.onclick = function() { window.printContrat(); };
  var bSave = document.createElement("button"); bSave.style.cssText = "background:#c9a96e;color:white;border:none;border-radius:6px;padding:8px 16px;cursor:pointer;font-size:13px;font-weight:600"; bSave.innerHTML = "&#128190; Enregistrer"; bSave.onclick = function() { window.sauvegarderContrat(window._currentContratClientId); };
  var bClose = document.createElement("button"); bClose.style.cssText = "background:rgba(255,255,255,0.15);color:white;border:none;border-radius:6px;padding:8px 14px;cursor:pointer;font-size:18px"; bClose.innerHTML = "&#10005;"; bClose.onclick = function() { window.fermerModalContrat(); };
  bRow.appendChild(bPrint); bRow.appendChild(bSave); bRow.appendChild(bClose); hdr.appendChild(bRow); box.appendChild(hdr);
  var body = document.createElement("div"); body.style.cssText = "flex:1;overflow-y:auto";
  var iframe = document.createElement("iframe"); iframe.id = "contrat-iframe"; iframe.style.cssText = "width:100%;height:600px;border:none";
  body.appendChild(iframe); box.appendChild(body); modal.appendChild(box); document.body.appendChild(modal); iframe.srcdoc = contratHTML;
};
window.printContrat = function() { var ifrm = document.getElementById("contrat-iframe"); if (ifrm && ifrm.contentWindow) ifrm.contentWindow.print(); };
window.sauvegarderContrat = function(clientId) {
  var html = window._currentContratHTML; var client = window._currentContratClient || {};
  if (!html) { alert("Aucun contrat genere."); return; }
  var nom = "Contrat_" + (client.nom || "client") + "_" + new Date().toISOString().slice(0, 10) + ".html";
  var blob = new Blob([html], {type: "text/html"}); var file = new File([blob], nom, {type: "text/html"});
  var fd = new FormData(); fd.append("fichier", file, nom); fd.append("type", "contrat"); fd.append("nom", nom); fd.append("visible_client", "1");
  var tok = localStorage.getItem("simele_token") || "";
  fetch("/api/documents/client/" + clientId, {method: "POST", headers: {"Authorization": "Bearer " + tok}, body: fd})
    .then(function(r) { return r.json(); }).then(function(d) {
      if (d.success) { if (typeof showToast === "function") showToast("Contrat enregistre !", true); window.fermerModalContrat(); window.chargerDocuments(); }
      else { if (typeof showToast === "function") showToast("Erreur: " + (d.error || ""), false); }
    });
};

/* ===== DOCUMENTS ===== */
window.chargerDocuments = function() {
  var id = window._currentDocsClientId; var container = document.getElementById("docs-list-container");
  if (!id || !container) return;
  var tok = localStorage.getItem("simele_token") || "";
  container.innerHTML = "<p style='text-align:center;color:#999;padding:20px'>Chargement...</p>";
  fetch("/api/documents/client/" + id, {headers: {"Authorization": "Bearer " + tok}})
    .then(function(r) { return r.json(); }).then(function(docs) {
      if (!Array.isArray(docs) || !docs.length) { container.innerHTML = "<div style='text-align:center;padding:30px;color:#999'><div style='font-size:48px'>&#128193;</div><p>Aucun document.</p></div>"; return; }
      var tl = {fiche:"Fiche/CR",devis:"Devis",contrat:"Contrat",identite:"Identite",siege:"Siege",activite:"Activite",gestion:"Gestion",autre:"Autre",document:"Document",rapport:"Rapport",facture:"Facture"};
      var tc2 = {fiche:"#9b59b6",devis:"#3498db",contrat:"#2ecc71",identite:"#e67e22",siege:"#1abc9c",activite:"#e74c3c",gestion:"#95a5a6",autre:"#7f8c8d",document:"#95a5a6",rapport:"#8e44ad",facture:"#f39c12"};
      var ei = {pdf:"&#128196;",doc:"&#128196;",docx:"&#128196;",xls:"&#128200;",xlsx:"&#128200;",jpg:"&#128247;",jpeg:"&#128247;",png:"&#128247;",gif:"&#128247;",txt:"&#128196;",html:"&#127760;"};
      var h2 = "<div style='display:flex;flex-direction:column;gap:8px'>";
      docs.forEach(function(doc) {
        var ext = (doc.nom || "").split(".").pop().toLowerCase();
        var icon = ei[ext] || "&#128193;"; var color = tc2[doc.type] || "#95a5a6"; var label = tl[doc.type] || "Doc";
        var size = doc.taille > 0 ? (doc.taille > 1048576 ? (doc.taille/1048576).toFixed(1)+"Mo" : Math.round(doc.taille/1024)+"Ko") : "";
        var date = doc.created_at ? doc.created_at.slice(0,10) : "";
        var canP = ["pdf","jpg","jpeg","png","gif","html"].includes(ext);
        var did = doc.id;
        var btnP = canP ? "<button onclick='window.previewDoc(" + did + ")' style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px'>&#128269;</button>" : "";
        var btnD = "<a href='/api/documents/" + did + "/download' target='_blank' style='background:#e8f4fd;border:1px solid #3498db;border-radius:6px;padding:6px 10px;font-size:12px;color:#3498db;text-decoration:none;display:inline-flex;align-items:center'>&#8659;</a>";
        var btnR = "<button onclick='window.renommerDoc(" + did + ")' style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px'>&#9998;</button>";
        var btnT = "<button onclick='window.reclassifierDoc(" + did + ")' style='background:#f0f4f8;border:1px solid #ddd;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px'>&#127991;</button>";
        var btnX = "<button onclick='window.supprimerDoc(" + did + ")' style='background:#fdf0f0;border:1px solid #e74c3c;border-radius:6px;padding:6px 10px;cursor:pointer;font-size:12px;color:#e74c3c'>&#128465;</button>";
        h2 += "<div id='docrow"+did+"' style='background:white;border:1px solid #e8eaed;border-left:4px solid "+color+";border-radius:8px;padding:12px 14px'>";
        h2 += "<div style='display:flex;align-items:center;gap:10px'><span style='font-size:22px'>"+icon+"</span>";
        h2 += "<div style='flex:1;min-width:0'><div style='font-size:13px;font-weight:600;color:#1b2d5b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>"+doc.nom+"</div>";
        h2 += "<div style='display:flex;gap:8px;align-items:center;margin-top:3px'><span style='background:"+color+";color:white;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600'>"+label+"</span>"+(size?"<span style='font-size:11px;color:#999'>"+size+"</span>":"")+(date?"<span style='font-size:11px;color:#999'>"+date+"</span>":"")+"</div></div>";
        h2 += "<div style='display:flex;gap:6px;flex-shrink:0'>"+btnP+btnD+btnR+btnT+btnX+"</div></div></div>";
      });
      h2 += "</div>"; container.innerHTML = h2;
    }).catch(function(e) { container.innerHTML = "<p style='color:red;padding:20px'>Erreur: "+e.message+"</p>"; });
};
window.previewDoc = function(docId) { window.open("/api/documents/"+docId+"/download","_blank"); };
window.renommerDoc = function(docId) {
  var row = document.getElementById("docrow"+docId);
  var nomEl = row ? row.querySelector("div[style*='font-weight:600']") : null;
  var old = nomEl ? nomEl.textContent.trim() : "";
  var n = prompt("Nouveau nom:", old); if (!n || n === old) return;
  var tok = localStorage.getItem("simele_token")||"";
  fetch("/api/documents/"+docId,{method:"PUT",headers:{"Authorization":"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({nom:n,visible_client:1})})
    .then(function(r){return r.json();}).then(function(d){if(d.success){if(typeof showToast==="function")showToast("Renomme.",true);window.chargerDocuments();}});
};
window.reclassifierDoc = function(docId) {
  var types=[["fiche","Fiche / CR / Rapport"],["devis","Devis"],["contrat","Contrat"],["identite","Justificatif identite"],["siege","Justificatif siege social"],["activite","Justificatif activite"],["gestion","Document gestion diverse"],["autre","Autre document"]];
  var msg="Type:
"+types.map(function(t,i){return (i+1)+". "+t[1];}).join("
")+"

Numero:";
  var c=prompt(msg); if(!c) return;
  var idx=parseInt(c)-1; if(isNaN(idx)||idx<0||idx>=types.length) return;
  var tok=localStorage.getItem("simele_token")||"";
  fetch("/api/documents/"+docId,{method:"PUT",headers:{"Authorization":"Bearer "+tok,"Content-Type":"application/json"},body:JSON.stringify({type:types[idx][0],visible_client:1})})
    .then(function(r){return r.json();}).then(function(d){if(d.success){if(typeof showToast==="function")showToast("Type modifie.",true);window.chargerDocuments();}});
};
window.supprimerDoc = function(docId) {
  if(!confirm("Supprimer ce document ?")) return;
  var tok=localStorage.getItem("simele_token")||"";
  fetch("/api/documents/"+docId,{method:"DELETE",headers:{"Authorization":"Bearer "+tok}})
    .then(function(r){return r.json();}).then(function(d){if(d.success){if(typeof showToast==="function")showToast("Supprime.",true);window.chargerDocuments();}});
};

/* ===== PROGRAMME ===== */
window.updateProgramme = function() {
  var cSel=document.getElementById("prog-client-select"); var sSel=document.getElementById("prog-service-select"); var cnt=document.getElementById("programme-content");
  if(!cnt) return;
  var cId=cSel?cSel.value:""; var sId=sSel?sSel.value:"";
  if(!cId||!sId){cnt.innerHTML="<div style='text-align:center;padding:60px;color:#999'><div style='font-size:48px;margin-bottom:16px'>&#127963;</div><div style='font-size:16px;font-weight:600'>Selectionnez un client et un service</div></div>";return;}
  var client=typeof getClientById==="function"?getClientById(parseInt(cId)):null; if(!client) return;
  var today=new Date().toLocaleDateString("fr-FR");
  var PROGS={
    coaching3:{titre:"Coaching Strategique - 3 Seances",prix:"210 EUR",seances:[{n:1,t:"Structuration du projet",d:"2h30-3h",pts:["Analyse du projet","Identification cible client","Statuts juridiques","Demarches URSSAF"],r:"Projet clair - Orientation juridique"},{n:2,t:"Strategie et aides",d:"2h30-3h",pts:["Besoins financiers","Aides ACRE NACRE LADOM","Plan d action"],r:"Strategie optimisee - Aides identifiees"},{n:3,t:"Structuration financiere",d:"2h30-3h",pts:["Previsionnel 3 ans","Prix et marges","Preparation financement"],r:"Vision financiere claire"}]},
    coaching5:{titre:"Coaching Strategique - 5 Seances",prix:"320 EUR",seances:[{n:1,t:"Structuration",d:"2h30-3h",pts:["Analyse concept","Positionnement","Statuts"],r:"Projet structure"},{n:2,t:"Strategie",d:"2h30-3h",pts:["Aides","Plan"],r:"Aides identifiees"},{n:3,t:"Finances",d:"2h30-3h",pts:["Previsionnel","Marges"],r:"Vision financiere"},{n:4,t:"Suivi",d:"2h30-3h",pts:["Bilan","Ajustements"],r:"Optimise"},{n:5,t:"Finalisation",d:"2h30-3h",pts:["Revue","Lancement","Reseau"],r:"Pret au lancement"}]},
    diag:{titre:"Diagnostic de Projet",prix:"80 EUR",seances:[{n:1,t:"Diagnostic",d:"1h30",pts:["Viabilite","Marche","Forces faiblesses","Recommandations"],r:"Vision claire"}]},
    bp:{titre:"Business Plan Complet",prix:"450 EUR",seances:[{n:1,t:"Collecte",d:"2h",pts:["Informations","Analyse marche"],r:"Base solide"},{n:2,t:"Redaction",d:"Variable",pts:["Redaction BP","Livraison"],r:"BP professionnel"}]},
    prev:{titre:"Previsionnel Financier 3 ans",prix:"350 EUR",seances:[{n:1,t:"Collecte",d:"1h30",pts:["Hypotheses CA","Charges","BFR"],r:"Donnees validees"},{n:2,t:"Construction",d:"Variable",pts:["Compte resultat","Tresorerie","Livraison Excel"],r:"Previsionnel complet"}]}
  };
  var prog=PROGS[sId]||{titre:(sSel&&sSel.options[sSel.selectedIndex])?sSel.options[sSel.selectedIndex].text:"Service",prix:"Sur devis",seances:[{n:1,t:"Programme sur mesure",d:"Variable",pts:["Adapte a vos besoins"],r:"Programme personnalise"}]};
  var sh=prog.seances.map(function(s){return "<div style='border:1px solid #e0e0e0;border-left:4px solid #1b2d5b;border-radius:8px;padding:16px;margin-bottom:12px'><div style='display:flex;align-items:center;gap:12px;margin-bottom:10px'><div style='background:#1b2d5b;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0'>"+s.n+"</div><div><div style='font-size:14px;font-weight:700;color:#1b2d5b'>"+s.t+"</div><div style='font-size:12px;color:#c9a96e'>Duree: "+s.d+"</div></div></div><ul style='margin:0 0 10px 20px;padding:0'>"+s.pts.map(function(p){return "<li style='font-size:13px;color:#444;margin-bottom:4px'>"+p+"</li>";}).join("")+"</ul><div style='background:#f0f4f8;border-radius:6px;padding:8px 12px;font-size:12px;color:#1b2d5b'><strong>Resultat: </strong>"+s.r+"</div></div>";}).join("");
  cnt.innerHTML="<div style='background:white;border-radius:12px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06)'><div id='prog-print-area'><div style='display:flex;justify-content:space-between;align-items:start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1b2d5b'><div><div style='font-size:11px;color:#c9a96e;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px'>Cabinet de Conseils SIMELE</div><div style='font-size:22px;font-weight:700;color:#1b2d5b'>"+prog.titre+"</div></div><div style='text-align:right'><div style='background:#1b2d5b;color:white;padding:8px 16px;border-radius:8px;font-size:12px;margin-bottom:6px'>&#128100; "+client.prenom+" "+client.nom+"</div><div style='font-size:20px;font-weight:700;color:#c9a96e'>"+prog.prix+"</div><div style='font-size:11px;color:#999'>"+today+"</div></div></div>"+sh+"<div style='margin-top:16px;padding:16px;background:#f8f9fa;border-radius:8px;display:grid;grid-template-columns:1fr 1fr;gap:16px'><div><div style='font-size:12px;font-weight:700;color:#c9a96e;margin-bottom:8px'>BENEFICES</div><ul style='margin:0 0 0 16px;font-size:12px;color:#555'><li>Gain de temps</li><li>Eviter les erreurs couteuses</li><li>Decisions strategiques</li><li>Lancement securise</li></ul></div><div><div style='font-size:12px;font-weight:700;color:#c9a96e;margin-bottom:8px'>CABINET</div><div style='font-size:12px;color:#555'>Jean-Christophe Simele<br>SIRET: 92787546800039<br>20 lot. Tolbiac 1<br>97114 Trois-Rivieres</div></div></div></div></div>";
};
window.imprimerProgramme=function(){var a=document.getElementById("prog-print-area");if(!a){alert("Selectionnez un client et un service.");return;}var w=window.open("","_blank");w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Programme SIMELE</title><style>body{font-family:Arial,sans-serif;margin:30px;font-size:13px}ul{margin:6px 0 6px 20px}li{margin:3px 0}@media print{body{margin:15px}}</style></head><body>"+a.innerHTML+"</body></html>");w.document.close();setTimeout(function(){w.print();},500);};

(function(){var _sp=window.showPage;window.showPage=function(id,clientId){if(typeof _sp==="function")_sp(id,clientId);if(id==="programme"){setTimeout(function(){var sel=document.getElementById("prog-client-select");if(sel&&typeof clients!=="undefined"&&clients.length&&sel.options.length<=1){clients.forEach(function(c){var o=document.createElement("option");o.value=c.id;o.textContent=c.prenom+" "+c.nom;sel.appendChild(o);});}if(sel&&typeof currentClientId!=="undefined"&&currentClientId){sel.value=currentClientId;window.updateProgramme();}},300);}};})();
