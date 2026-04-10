# 📦 RÉCAPITULATIF COMPLET DE LA MISE À JOUR

Date: 10 avril 2026  
Système: Connexion CRM ↔ Site Vitrine avec Portail Client  

---

## 📂 FICHIERS À TÉLÉCHARGER ET METTRE À JOUR

### Backend CRM (`simele-crm`)

| Fichier | Action | Destination |
|---------|--------|-------------|
| `db.js` | REMPLACER | `server/db.js` |
| `index.js` | REMPLACER | `server/index.js` |
| `portal.js` | CRÉER | `server/routes/portal.js` ← NOUVEAU |

### Frontend CRM

| Fichier | Action | Destination |
|---------|--------|-------------|
| `crm-onglet-nouveaux-clients.html` | COPIER & COLLER | Intégrer dans `public/index.html` |

### Site Vitrine (`simele-site-vitrine`)

| Fichier | Action | Destination |
|---------|--------|-------------|
| `site-vitrine-inscription.html` | COPIER & COLLER | Intégrer dans `public/index.html` |

---

## ✅ ÉTAPES DE DÉPLOIEMENT

### Phase 1: Préparation (5 min)

#### 1A - Télécharger les fichiers
```bash
# Tous les fichiers sont dans /mnt/user-data/outputs/
# Télécharge:
# - db.js
# - index.js
# - portal.js
# - crm-onglet-nouveaux-clients.html
# - site-vitrine-inscription.html
# - GUIDE-INTEGRATION.md (pour référence)
```

#### 1B - Lire le guide
Consulte `GUIDE-INTEGRATION.md` pour comprendre le flux complet

---

### Phase 2: Mise à jour Backend CRM (10 min)

#### 2A - Structure des dossiers
```
ton-repo-simele-crm/
├── server/
│   ├── index.js              ← À REMPLACER
│   ├── db.js                 ← À REMPLACER
│   ├── routes/
│   │   ├── auth.js           (inchangé)
│   │   ├── clients.js        (inchangé)
│   │   └── portal.js         ← À AJOUTER (nouveau fichier)
│   └── middleware/
│       └── auth.js           (inchangé)
├── public/
│   └── index.html            ← À MODIFIER (voir Phase 3)
└── [autres fichiers inchangés]
```

#### 2B - Remplacer les fichiers

**Étape 1:** Clone ton repo (si pas déjà cloné)
```bash
git clone https://github.com/SIMELE-JC/simele-crm.git
cd simele-crm
```

**Étape 2:** Remplace `server/db.js`
- Ouvre le fichier `db.js` fourni
- Copie tout le contenu
- Remplace entièrement le fichier `server/db.js` dans ton repo
- Sauvegarde

**Étape 3:** Remplace `server/index.js`
- Ouvre le fichier `index.js` fourni
- Copie tout le contenu
- Remplace entièrement le fichier `server/index.js` dans ton repo
- Sauvegarde

**Étape 4:** Crée `server/routes/portal.js`
- Crée un nouveau fichier `server/routes/portal.js`
- Ouvre le fichier `portal.js` fourni
- Copie tout le contenu
- Colle dans le nouveau fichier
- Sauvegarde

#### 2C - Push vers GitHub

```bash
git add server/
git commit -m "✨ Ajout portail client v1.0 - inscriptions + documents synchronisés"
git push origin main
```

**Railway se redéploiera automatiquement** (attendre ~2-3 min)

Vérifie que c'est OK:
- Aller sur railway.app
- Voir les logs: Chercher "✅ SIMELE CRM démarré"
- Tester: `curl https://ccs-gc-logi.up.railway.app/api/health`

---

### Phase 3: Mise à jour Frontend CRM (10 min)

#### 3A - Ajouter l'onglet dans la nav

**Ouvre:** `public/index.html` dans ton repo

**Cherche:** Ligne avec `<li><a onclick="showPage('espace-client')`
```html
<!-- Tu vas trouver quelque chose comme: -->
<li><a onclick="showPage('services')" ...>Services</a></li>
<li><a onclick="showPage('documents')" ...>Documents</a></li>
<li><a onclick="showPage('espace-client')" class="nav-espace-client">Mon Espace</a></li>
```

**Ajoute après la dernière ligne `</li>`:**
```html
<li><a onclick="showTab('nouveaux-clients')" style="padding: 0.8rem 1.5rem; border-radius: 4px; cursor: pointer; transition: all 0.2s; background: rgba(46,204,113,0.1); color: #2ecc71; font-weight: 600;" 
        onmouseover="this.style.background='rgba(46,204,113,0.2)'" onmouseout="this.style.background='rgba(46,204,113,0.1)'">
  ➕ Nouveaux Clients
</a></li>
```

#### 3B - Intégrer le contenu complet du formulaire

**Cherche:** La balise `</main>` ou la dernière `</div>` avant `</body>`

**Ajoute:** Tout le contenu du fichier `crm-onglet-nouveaux-clients.html`
- Copie le contenu entier de ce fichier
- Colle-le AVANT `</main>` ou `</body>`

#### 3C - Push vers GitHub

```bash
git add public/index.html
git commit -m "✨ Ajout onglet gestion des nouveaux clients"
git push origin main
```

**Railway se redéploiera automatiquement**

---

### Phase 4: Mise à jour Site Vitrine (10 min)

#### 4A - Modifier la nav

**Ouvre:** `public/index.html` dans le repo du site vitrine

**Cherche:** `<li><a onclick="showPage('espace-client')" class="nav-espace-client">Mon Espace</a></li>`

**Remplace par:**
```html
<li><a onclick="showPage('inscription-client')" class="nav-espace-client">Créer mon dossier</a></li>
```

#### 4B - Intégrer le formulaire d'inscription

**Cherche:** `<div id="espace-client" class="page"`

**Avant cette ligne, ajoute:** Tout le contenu du fichier `site-vitrine-inscription.html`
- Copie le contenu entier
- Colle-le AVANT `<div id="espace-client"`

#### 4C - Modifier l'ID de l'espace-client

**Cherche dans le fichier:** `<div id="espace-client" class="page"`

**Remplace par:**
```html
<div id="mon-espace-client" class="page"
```

**Puis cherche:** Tous les appels `showPage('espace-client')` dans le fichier SAUF celui du formulaire d'inscription

**Remplace ces appels par:** `showPage('mon-espace-client')`

#### 4D - Push vers GitHub

```bash
git add public/index.html
git commit -m "✨ Ajout formulaire d'inscription client"
git push origin main
```

**Railway se redéploiera automatiquement**

---

## 🧪 TESTS DE VÉRIFICATION (20 min)

### Test 1: Backend OK?
```bash
# Depuis n'importe quel navigateur:
https://ccs-gc-logi.up.railway.app/api/health

# Doit répondre:
{"status":"ok","app":"SIMELE CRM","timestamp":"2026-04-10T..."}
```

### Test 2: Inscription OK?
```bash
# Depuis Postman ou curl:
curl -X POST https://ccs-gc-logi.up.railway.app/api/portal/inscription \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "TestNom",
    "prenom": "TestPrenom",
    "email": "test@exemple.com",
    "projet": "Mon projet test"
  }'

# Doit répondre:
{"success":true,"message":"Demande reçue !..."}
```

### Test 3: CRM Nav OK?
- Va sur: `https://ccs-gc-logi.up.railway.app`
- Login avec tes identifiants admin
- Cherche l'onglet **"➕ Nouveaux Clients"** dans la nav
- Clique → Doit afficher une liste vide (ou les tests précédents)

### Test 4: Site Vitrine OK?
- Va sur: `https://www.ccsguadeloupe.fr` (ou l'adresse Railway temporaire)
- Cherche **"Créer mon dossier"** dans la nav
- Clique → Doit afficher le formulaire d'inscription
- Remplis et soumets → Doit afficher "Demande en cours de validation"

### Test 5: Validation Admin
- Retour au CRM
- Onglet **"Nouveaux Clients"** → Doit afficher ta demande de test
- Clique "Voir" → Modal avec les infos
- Clique "Valider" → Génère un identifiant
- Copie l'identifiant et mot de passe temporaire

### Test 6: Login Client
- Va au site vitrine
- Clique **"Mon Espace"** (pas "Créer mon dossier")
- Login avec l'email et mot de passe temporaire
- Doit afficher son dossier client

---

## 🔧 CONFIGURATION RAILWAY (IMPORTANT!)

Si tu n'as pas encore configuré le volume persistent:

### Via Railway Dashboard
1. Va sur `railway.app`
2. Ouvre ton projet CRM
3. Onglet **"Plugins"**
4. Ajouter un volume MongoDB ou File Storage
5. Configure:
   - Mount path: `/app/data`
   - Size: 10GB

### Via CLI (si tu as Railway CLI)
```bash
railway volume create /app/data 10gb
```

---

## 📊 RÉSUMÉ FINAL

### Avant (État actuel)
- ❌ Site vitrine = statique (formulaire de contact EmailJS)
- ❌ CRM = gestion des clients existants
- ❌ Pas de portail client
- ❌ Pas de synchronisation entre les deux

### Après (Nouveau système)
- ✅ Site vitrine = formulaire d'inscription client
- ✅ CRM = Onglet pour valider les nouvelles demandes
- ✅ Portail client = Espace sécurisé pour chaque client
- ✅ Documents synchronisés bidirectionnels
- ✅ Historique des versions des documents
- ✅ Authentification par email du client

---

## 🆘 EN CAS DE PROBLÈME

### Erreur "Module not found: portal"
```bash
# Vérifie que le fichier existe:
# server/routes/portal.js

# S'il existe, redéploie:
git add server/
git commit -m "Fix: portal.js"
git push origin main
```

### Erreur "Table portal_inscriptions not found"
```bash
# Force la réinitialisation de la base de données:
# Dans Railway → Terminal
railway run rm /app/data/simele.db

# Redéploie:
git push origin main
```

### Documents ne s'enregistrent pas
```bash
# Vérifie le volume:
# Railway → Settings → Volumes
# Doit avoir /app/data avec suffisamment d'espace
```

### CORS error sur site vitrine
```bash
# C'est normal: Vérifie que l'URL API est correcte
# Dans site-vitrine-inscription.html, cherche:
// const CRM_API = ...
// Doit être l'URL complète du CRM
```

---

## 📞 QUESTIONS FRÉQUENTES

**Q: Où vont les documents stockés?**  
A: `/app/data/documents/{email}/` sur le volume Railway persistent

**Q: Quelle est la limite de taille des fichiers?**  
A: 50MB par défaut (configurable dans index.js `express.json({limit:'50mb'})`)

**Q: Peut-on télécharger un document depuis le CRM?**  
A: Oui, chaque document a une route de téléchargement `/api/portal/documents/:id/download`

**Q: Les anciennes versions de documents sont-elles gardées?**  
A: Oui, dans la table `document_versions` avec historique complet

**Q: Comment réinitialiser un mot de passe client?**  
A: Pour l'instant, via l'admin qui rejette et valide à nouveau (à améliorer plus tard)

---

## 🎉 RÉSULTAT ATTENDU

Après ces 4 phases (≈ 45 min total):

1. **Site Vitrine**
   - ✅ Formulaire d'inscription "Créer mon dossier"
   - ✅ Messages d'attente de validation

2. **CRM**
   - ✅ Nouvel onglet "Nouveaux Clients"
   - ✅ Voir les demandes en attente
   - ✅ Valider = crée le client + génère identifiants

3. **Portail Client**
   - ✅ Login par email
   - ✅ Voir son dossier
   - ✅ Télécharger documents
   - ✅ Éditer profil

4. **Documents**
   - ✅ Synchronisés entre CRM et client
   - ✅ Historique des versions
   - ✅ Stockage sécurisé

---

## 📋 CHECKLIST FINALE

- [ ] Tous les fichiers téléchargés
- [ ] `db.js` remplacé
- [ ] `index.js` remplacé
- [ ] `portal.js` créé dans `server/routes/`
- [ ] Onglet "Nouveaux Clients" ajouté au CRM
- [ ] Formulaire inscription ajouté au site vitrine
- [ ] ID de l'espace-client modifié
- [ ] Push CRM vers GitHub
- [ ] Push site vitrine vers GitHub
- [ ] Tests d'inscription réussis
- [ ] Tests de validation réussis
- [ ] Tests de login client réussis

**Quand tout est vert ✅, le système est prêt!**

---

**Besoin d'aide?** Contacte-moi ou consulte `GUIDE-INTEGRATION.md` pour plus de détails.

Bonne intégration! 🚀
