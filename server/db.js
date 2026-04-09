const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/simele.db');

// S'assurer que le dossier data/ existe
const fs = require('fs');
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Performances SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    -- ── Table utilisateurs (vous + futurs collaborateurs) ──
    CREATE TABLE IF NOT EXISTS users (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    NOT NULL UNIQUE,
      password    TEXT    NOT NULL,
      nom         TEXT    NOT NULL,
      prenom      TEXT    NOT NULL,
      role        TEXT    NOT NULL DEFAULT 'admin',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Table clients ──────────────────────────────────────
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
      profil      TEXT    DEFAULT 'À qualifier',
      color       TEXT    DEFAULT '#D6EAF8',
      text_color  TEXT    DEFAULT '#1a5f8a',
      initials    TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      created_by  INTEGER REFERENCES users(id)
    );

    -- ── Table entretiens / scoring ──────────────────────────
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

    -- ── Table documents générés ────────────────────────────
    CREATE TABLE IF NOT EXISTS documents (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      type        TEXT    NOT NULL,
      nom         TEXT    NOT NULL,
      contenu     TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Créer le compte admin par défaut si aucun utilisateur
  const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get();
  if (userCount.n === 0) {
    const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'simele2024!', 10);
    db.prepare(`
      INSERT INTO users (email, password, nom, prenom, role)
      VALUES (?, ?, 'Simele', 'Jean-Christophe', 'admin')
    `).run(process.env.ADMIN_EMAIL || 'ccs.guadeloupe@outlook.fr', hash);
    console.log('👤 Compte admin créé :', process.env.ADMIN_EMAIL || 'ccs.guadeloupe@outlook.fr');
    console.log('🔑 Mot de passe :', process.env.ADMIN_PASSWORD || 'simele2024!');
    console.log('⚠️  Changez ces valeurs dans les variables d\'environnement Railway !');
  }

  console.log('🗄️  Base de données initialisée :', DB_PATH);
}

module.exports = { db, initDB };
