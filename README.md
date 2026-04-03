# Cabinet SIMELE — CRM Métier

Application web de gestion client pour le Cabinet de Conseils SIMELE.

## Stack technique

- **Backend** : Node.js + Express
- **Base de données** : SQLite (via better-sqlite3)
- **Auth** : JWT (jsonwebtoken) + bcrypt
- **Frontend** : HTML/CSS/JS vanilla (dans `public/`)
- **Hébergement** : Railway

---

## Déploiement Railway (étapes complètes)

### 1. Préparer le dépôt GitHub

```bash
git init
git add .
git commit -m "SIMELE CRM v1.0 — prêt pour Railway"
```

Créer un repo sur github.com (ex: `simele-crm`), puis :

```bash
git remote add origin https://github.com/VOTRE-COMPTE/simele-crm.git
git branch -M main
git push -u origin main
```

### 2. Créer le projet sur Railway

1. Aller sur [railway.app](https://railway.app) → **New Project**
2. Choisir **Deploy from GitHub repo**
3. Sélectionner votre repo `simele-crm`
4. Railway détecte automatiquement Node.js ✅

### 3. Variables d'environnement (OBLIGATOIRE)

Dans Railway → votre service → onglet **Variables** :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Générer : `openssl rand -hex 32` |
| `ADMIN_EMAIL` | `ccs.guadeloupe@outlook.fr` |
| `ADMIN_PASSWORD` | Votre mot de passe sécurisé (min 8 car.) |

### 4. Volume persistant (IMPORTANT pour SQLite)

Sans volume, la base de données est perdue à chaque redémarrage.

Dans Railway → votre service → **Settings** → **Volumes** :
- Mount path : `/app/data`
- Taille : 1 GB (suffisant)

Puis ajouter la variable :
```
DB_PATH=/app/data/simele.db
```

### 5. Domaine personnalisé (optionnel)

Railway → Settings → **Domains** → Generate Domain
Ou connecter votre propre domaine.

---

## Développement local

```bash
# Installer les dépendances
npm install

# Créer le fichier .env
cp .env.example .env
# Éditer .env avec vos valeurs

# Démarrer en mode dev (avec rechargement auto)
npm run dev

# Ou démarrer simplement
npm start
```

L'app sera disponible sur http://localhost:3000

---

## API Endpoints

### Auth
| Méthode | Route | Description |
|---|---|---|
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/me` | Vérifier session |
| POST | `/api/auth/change-password` | Changer mot de passe |

### Clients (authentification requise)
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/clients` | Liste clients (+ `?search=`) |
| GET | `/api/clients/:id` | Dossier complet |
| POST | `/api/clients` | Créer client |
| PUT | `/api/clients/:id` | Modifier client |
| DELETE | `/api/clients/:id` | Supprimer client |
| POST | `/api/clients/:id/entretien` | Sauvegarder entretien/scoring |
| GET | `/api/clients/stats/dashboard` | Stats dashboard |

### Santé
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/health` | Status de l'app |

---

## Structure du projet

```
simele-railway/
├── server/
│   ├── index.js          # Point d'entrée Express
│   ├── db.js             # SQLite + initialisation BDD
│   ├── middleware/
│   │   └── auth.js       # JWT middleware
│   └── routes/
│       ├── auth.js       # Routes authentification
│       └── clients.js    # Routes clients (CRUD)
├── public/
│   └── index.html        # CRM frontend (SPA)
├── data/                 # Base SQLite (gitignorée)
├── .env.example
├── .gitignore
├── package.json
├── railway.toml
└── README.md
```

---

## Sécurité

- Authentification JWT sur toutes les routes `/api/clients`
- Mots de passe hashés avec bcrypt (10 rounds)
- Rate limiting sur les routes auth (20 req/15min)
- Helmet.js pour les headers HTTP
- CORS configuré

---

## Prochaines étapes (site client)

Le backend est prêt pour accueillir les routes de l'espace client :
- `POST /api/client-portal/register` — inscription client
- `GET /api/client-portal/dossier` — voir son propre dossier
- `GET /api/client-portal/documents` — télécharger ses documents

Cabinet de Conseils SIMELE · ccs.guadeloupe@outlook.fr · calendly.com/ccs-guadeloupe
