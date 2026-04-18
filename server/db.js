const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/simele.db');

const fs = require('fs');
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      nom         TEXT    NOT NULL,
      prenom      TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'admin',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS clients (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nom         TEXT    NOT NULL,
      prenom      TEXT    NOT NULL,
      email       TEXT,
      tel         TEXT,
      adresse     TEXT,
      date_nais   TEXT,
      lieu_nais   TEXT,
      situation_fam TEXT,
      statut      TEXT,
      prestation  TEXT,
      projet      TEXT,
      notes       TEXT,
      notes_entretien TEXT,
      score       INTEGER,
      profil      TEXT    DEFAULT 'A qualifier',
      color       TEXT    DEFAULT '#D6EAF8',
      text_color  TEXT    DEFAULT '#1a5f8a',
      initials    TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      created_by  INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS entretiens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      score_total INTEGER,
      score_clarte INTEGER,
      score_faisabilite INTEGER,
      score_motivation INTEGER,
      score_ressources INTEGER,
      vision      TEXT,
      cible       TEXT,
      offre       TEXT,
      competences TEXT,
      experience  TEXT,
      autonomie   TEXT,
      budget      INTEGER,
      apport      INTEGER,
      financement TEXT,
      engagement  INTEGER,
      urgence     TEXT,
      capacite_investir TEXT,
      reco_service TEXT,
      reco_prix   TEXT,
      notes       TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS documents (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      type        TEXT    NOT NULL,
      nom         TEXT    NOT NULL,
      contenu     TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS portal_inscriptions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      nom             TEXT    NOT NULL,
      prenom          TEXT    NOT NULL,
      email           TEXT    NOT NULL UNIQUE,
      tel             TEXT    DEFAULT '',
      adresse         TEXT    DEFAULT '',
      date_nais       TEXT    DEFAULT '',
      lieu_nais       TEXT    DEFAULT '',
      situation_fam   TEXT    DEFAULT '',
      projet          TEXT    DEFAULT '',
      prestation      TEXT    DEFAULT '',
      statut          TEXT    NOT NULL DEFAULT 'en_attente',
      identifiant     TEXT    DEFAULT NULL,
      password_hash   TEXT    DEFAULT NULL,
      client_id       INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      notes_admin     TEXT    DEFAULT '',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      validated_at    TEXT    DEFAULT NULL,
      rejected_at     TEXT    DEFAULT NULL
    );
    CREATE TABLE IF NOT EXISTS client_documents (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      inscription_id  INTEGER REFERENCES portal_inscriptions(id) ON DELETE SET NULL,
      type            TEXT    NOT NULL DEFAULT 'document',
      nom             TEXT    NOT NULL,
      description     TEXT    DEFAULT '',
      chemin_stockage TEXT    DEFAULT '',
      taille          INTEGER DEFAULT 0,
      version         INTEGER NOT NULL DEFAULT 1,
      visible_client  INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      created_by      INTEGER REFERENCES users(id),
      updated_by      INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS document_versions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id     INTEGER NOT NULL REFERENCES client_documents(id) ON DELETE CASCADE,
      version         INTEGER NOT NULL,
      chemin_stockage TEXT    DEFAULT '',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      created_by      INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS quiz_resultats (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      inscription_id  INTEGER NOT NULL REFERENCES portal_inscriptions(id) ON DELETE CASCADE,
      reponses        TEXT    DEFAULT '{}',
      score           INTEGER DEFAULT 0,
      profil          TEXT    DEFAULT '',
      recommandations TEXT    DEFAULT '',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(inscription_id)
    );
    CREATE TABLE IF NOT EXISTS commandes (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      inscription_id  INTEGER NOT NULL REFERENCES portal_inscriptions(id) ON DELETE CASCADE,
      offres          TEXT    DEFAULT '[]',
      total           REAL    DEFAULT 0,
      methode_paiement TEXT   DEFAULT '',
      statut          TEXT    NOT NULL DEFAULT 'en_attente',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get();
  if (userCount.n === 0) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'simele2024!', 10);
    db.prepare("INSERT INTO users (email, password, nom, prenom, role) VALUES (?, ?, 'Simele', 'Jean-Christophe', 'admin')")
      .run(process.env.ADMIN_EMAIL || 'ccs.guadeloupe@outlook.fr', hash);
    console.log('Compte admin cree');
  }
  console.log('Base de donnees initialisee:', DB_PATH);
}


// Table rendez-vous
try {
  db.exec(`CREATE TABLE IF NOT EXISTS rendez_vous (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date_rdv    TEXT    NOT NULL,
    heure_rdv   TEXT    NOT NULL,
    objet       TEXT    NOT NULL DEFAULT 'Entretien',
    lieu        TEXT    DEFAULT 'En ligne',
    statut      TEXT    NOT NULL DEFAULT 'confirme',
    notes       TEXT    DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);
} catch(e) { console.log('rdv table:', e.message); }

// Colonne mot_de_passe_provisoire dans portal_inscriptions
try { db.exec("ALTER TABLE portal_inscriptions ADD COLUMN mot_de_passe_provisoire TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE portal_inscriptions ADD COLUMN mdp_envoi_at TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE portal_inscriptions ADD COLUMN acces_actif INTEGER DEFAULT 0"); } catch(e) {}

module.exports = { db, initDB };
