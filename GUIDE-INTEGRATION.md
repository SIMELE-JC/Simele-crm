# 📖 GUIDE D'INTÉGRATION COMPLET
## Connexion CRM ↔ Site Vitrine avec Portail Client

---

## 🎯 Ce qui va changer

✅ **Backend CRM** - Nouvelles routes API pour le portail client  
✅ **Base de données** - Nouvelles tables pour inscriptions et documents  
✅ **CRM Frontend** - Nouvel onglet "Gestion des nouveaux clients"  
✅ **Site Vitrine** - Section "Créer mon dossier" (inscription)  

---

## 📋 FICHIERS À METTRE À JOUR

### **BACKEND CRM (simele-crm repo)**

#### 1️⃣ `server/db.js` ← À REMPLACER
- **Fichier fourni:** `/mnt/user-data/outputs/db.js`
- **Action:** Copier/remplacer entièrement
- **Raison:** Ajoute les tables `portal_inscriptions`, `client_documents`, `document_versions`

#### 2️⃣ `server/routes/portal.js` ← À CRÉER (NOUVEAU)
- **Fichier fourni:** `/mnt/user-data/outputs/portal.js`
- **Action:** Créer ce nouveau fichier dans `server/routes/`
- **Raison:** Toutes les routes du portail client

#### 3️⃣ `server/index.js` ← À REMPLACER
- **Fichier fourni:** `/mnt/user-data/outputs/index.js`
- **Action:** Copier/remplacer entièrement
- **Raison:** Ajoute l'import et la route `/api/portal`

**Structure après modification:**
```
simele-crm/
├── server/
│   ├── index.js                    ✏️ MODIFIÉ
│   ├── db.js                       ✏️ MODIFIÉ
│   ├── middleware/
│   │   └── auth.js                 (inchangé)
│   └── routes/
│       ├── auth.js                 (inchangé)
│       ├── clients.js              (inchangé)
│       └── portal.js               ➕ NOUVEAU
├── public/
│   └── index.html                  ✏️ À MODIFIER (voir ci-dessous)
└── [autres fichiers]
```

---

### **CRM FRONTEND (public/index.html)**

#### 4️⃣ Ajouter l'onglet "Gestion des nouveaux clients"
- **Fichier fourni:** `/mnt/user-data/outputs/crm-onglet-nouveaux-clients.html`
- **Action:** Copier/coller dans `public/index.html`
- **Où?** Avant la balise `</body>`

**Étapes détaillées:**

**A) Dans la nav (chercher la liste `<ul class="nav-links">`):**
```html
<!-- TROUVER CETTE LIGNE: -->
<li><a onclick="showPage('documents')" ...>Documents</a></li>

<!-- AJOUTER APRÈS: -->
<li><a onclick="showPage('espace-client')" ...>Espace Client</a></li>

<!-- AJOUTER CECI: -->
<li><a onclick="showTab('nouveaux-clients')" style="padding: 0.8rem 1.5rem; border-radius: 4px; cursor: pointer; transition: all 0.2s; background: rgba(46,204,113,0.1); color: #2ecc71; font-weight: 600;" 
        onmouseover="this.style.background='rgba(46,204,113,0.2)'" onmouseout="this.style.background='rgba(46,204,113,0.1)'">
  ➕ Nouveaux Clients
</a></li>
```

**B) Dans les pages (chercher `<div id="tab-espace-client"`):**
```html
<!-- AJOUTER AVANT </main> OU AVANT LA DERNIÈRE PAGE: -->
[Copier le contenu du fichier crm-onglet-nouveaux-clients.html]
```

---

### **SITE VITRINE (simele-site-vitrine repo)**

#### 5️⃣ Ajouter la section d'inscription
- **Fichier fourni:** `/mnt/user-data/outputs/site-vitrine-inscription.html`
- **Action:** Copier/coller dans `public/index.html` du site vitrine

**Étapes détaillées:**

**A) Dans la nav (chercher `class="nav-links"`):**
```html
<!-- CHERCHER: -->
<li><a onclick="showPage('espace-client')" class="nav-espace-client">Mon Espace</a></li>

<!-- REMPLACER PAR: -->
<li><a onclick="showPage('inscription-client')" class="nav-espace-client">Créer mon dossier</a></li>
```

**B) Avant l'espace-client (chercher `<div id="espace-client"`):**
```html
<!-- AJOUTER AVANT:
[Copier le contenu du fichier site-vitrine-inscription.html]
-->
```

**C) Modifier l'ID de l'espace-client:**
```html
<!-- CHERCHER: -->
<div id="espace-client" class="page" ...>

<!-- AJOUTER UN ID UNIQUE: -->
<div id="mon-espace-client" class="page" ...>

<!-- ET METTRE À JOUR LE LIEN NAV: -->
<a onclick="showPage('mon-espace-client')" ...>Mon Espace</a>
```

---

## 🔧 VARIABLES D'ENVIRONNEMENT RAILWAY

Dans Railway → Settings → Variables → Ajouter:

| Clé | Valeur | Exemple |
|-----|--------|---------|
| `DOCS_PATH` | Chemin du stockage docs | `/app/data/documents` |

**Optionnel (déjà présent):**
- `NODE_ENV`: `production`
- `JWT_SECRET`: `[générer avec: openssl rand -hex 32]`
- `ADMIN_EMAIL`: `ccs.guadeloupe@outlook.fr`
- `ADMIN_PASSWORD`: `[votre mot de passe sécurisé]`
- `DB_PATH`: `/app/data/simele.db`

---

## 📁 VOLUME PERSISTANT RAILWAY

**Important:** Sans volume, les documents se perdent à chaque redémarrage!

### Configuration
1. Va sur Railway → Ton projet CRM
2. Onglet **Plugins** → Ajouter **Volume**
3. Configure:
   - **Mount path:** `/app/data`
   - **Size:** 10GB (suffisant pour plusieurs clients)

### Ou via CLI
```bash
railway volume create /app/data
```

---

## 🚀 DÉPLOIEMENT

### 1️⃣ Mettre à jour le backend CRM

```bash
# Clone ton repo
git clone https://github.com/SIMELE-JC/simele-crm.git
cd simele-crm

# Remplace les fichiers:
# - server/db.js (de outputs/)
# - server/index.js (de outputs/)
# - Crée server/routes/portal.js (de outputs/)

# Push vers GitHub
git add .
git commit -m "✨ Ajout portail client avec gestion des inscriptions et documents"
git push origin main
```

Railway se redéploiera **automatiquement** (max 2-3 min)

### 2️⃣ Mettre à jour le site vitrine

```bash
# Clone ton repo
git clone https://github.com/SIMELE-JC/simele-site-vitrine.git
cd simele-site-vitrine

# Modifie public/index.html:
# - Ajoute l'onglet nav "Créer mon dossier"
# - Intègre la section d'inscription
# - Modifie l'ID de l'espace-client

# Push vers GitHub
git add .
git commit -m "✨ Ajout formulaire d'inscription client"
git push origin main
```

Railway se redéploiera **automatiquement**

---

## ✅ CHECKLIST DE VÉRIFICATION

Après déploiement, teste:

### Backend
- [ ] `GET /api/health` → OK
- [ ] `POST /api/portal/inscription` → Reçoit les données
- [ ] `GET /api/portal/inscriptions` → Affiche liste (avec token admin)

### CRM Frontend
- [ ] Nouvel onglet "Nouveaux Clients" visible dans la nav
- [ ] Clic → affiche formulaire avec liste des inscriptions
- [ ] Bouton "Valider" → crée le client + génère identifiant

### Site Vitrine
- [ ] "Créer mon dossier" visible dans la nav
- [ ] Clic → affiche formulaire d'inscription
- [ ] Submit → envoie les données à `/api/portal/inscription`
- [ ] Après → affiche message "Demande en cours de validation"

---

## 🔍 FLUX COMPLET

### 1️⃣ **Client remplit formulaire sur site vitrine**
```
Site vitrine → POST /api/portal/inscription
→ Données sauvegardées dans table `portal_inscriptions`
→ Statut: "en_attente"
```

### 2️⃣ **Admin approuve dans le CRM**
```
CRM → Onglet "Nouveaux Clients" → Liste des demandes
→ Clique "Voir" → Modal avec infos
→ Clique "Valider" → POST /api/portal/valider/:id
→ Génère identifiant unique (CCS-2025-0001)
→ Génère mot de passe temporaire
→ Crée client dans table `clients`
→ Statut: "validé"
```

### 3️⃣ **Client reçoit identifiants (email manuel)**
```
Admin copie l'identifiant et mot de passe temporaire
Envoie par email au client
Client va sur site vitrine → "Mon Espace" → Login
```

### 4️⃣ **Client accède à son espace**
```
Mon Espace → Login avec email + password temporaire
→ POST /api/portal/login → Reçoit token JWT
→ Voit son dossier, documents, peut éditer profil
```

### 5️⃣ **Admin gère les documents**
```
CRM → Client → Documents
→ Upload/Modifie document
→ Auto-synced dans l'espace client via /api/portal/documents
```

---

## 🆘 DÉPANNAGE

### Erreur: "Module 'portal.js' not found"
→ Vérifier que `server/routes/portal.js` existe

### Erreur: "Table portal_inscriptions not found"
→ Supprimer la base de données (force réinitialisation)
```bash
railway run rm /app/data/simele.db
```

### Documents ne s'enregistrent pas
→ Vérifier que le volume `/app/data` existe
→ Vérifier les permissions d'écriture

### Site vitrine envoie les données mais aucune réponse
→ Vérifier que `/api/portal/inscription` est accessible
→ Vérifier CORS dans `server/index.js` (déjà configuré)

---

## 📞 SUPPORT

**En cas de problème:**
1. Vérifier les logs Railway
2. Vérifier que tous les fichiers sont en place
3. Vérifier que les variables d'env sont configurées
4. Redéployer depuis GitHub

---

## 📊 SCHÉMA DE LA BD

```sql
-- Inscriptions en attente
portal_inscriptions
├── id, nom, prenom, email (UNIQUE), tel, adresse
├── date_nais, lieu_nais, situation_fam
├── projet, prestation
├── statut (en_attente, validé, rejeté)
├── identifiant (CCS-YYYY-XXXX)
├── password_hash, client_id, notes_admin
└── created_at, validated_at, rejected_at

-- Documents clients
client_documents
├── id, client_id
├── type (entretien, contrat, accompagnement, compte_rendu, feuille_route)
├── nom, chemin_stockage, taille, version
├── created_at, updated_at, created_by, updated_by
└── [FK vers users pour audit]

-- Historique des versions
document_versions
├── id, document_id, version
├── chemin_stockage, created_at, created_by
└── [Archive des versions anciennes]
```

---

## 🎉 RÉSULTAT FINAL

✅ **Clients** peuvent demander un dossier via le site  
✅ **Admin** valide les demandes dans le CRM  
✅ **Documents** synchronisés entre CRM et espace client  
✅ **Historique** des modifications des documents  
✅ **Sécurité** - JWT tokens, authentification par email  

**Prêt à déployer?** 🚀
