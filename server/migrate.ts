import pg from "pg";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const { Client } = pg;
const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

// ─── Migrações em ordem ────────────────────────────────────────────────────
// Para adicionar novos campos/tabelas no futuro:
//   1. Adicione um novo objeto no array abaixo com version incrementado
//   2. Escreva o SQL com ALTER TABLE ... ADD COLUMN IF NOT EXISTS
//   3. Suba o deploy — será aplicado automaticamente
// ──────────────────────────────────────────────────────────────────────────
const MIGRATIONS = [
  {
    version: 1,
    description: "Criar tabelas iniciais (companies, users, bank_accounts, statements)",
    sql: `
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS companies (
        id          VARCHAR   PRIMARY KEY DEFAULT gen_random_uuid(),
        cnpj        TEXT      NOT NULL UNIQUE,
        name        TEXT      NOT NULL,
        email       TEXT,
        phone       TEXT,
        address     TEXT,
        is_active   BOOLEAN   NOT NULL DEFAULT true,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id          VARCHAR   PRIMARY KEY DEFAULT gen_random_uuid(),
        username    TEXT      NOT NULL UNIQUE,
        password    TEXT      NOT NULL,
        name        TEXT,
        role        TEXT      NOT NULL DEFAULT 'user',
        company_id  VARCHAR   REFERENCES companies(id),
        is_active   BOOLEAN   NOT NULL DEFAULT true,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS bank_accounts (
        id              VARCHAR   PRIMARY KEY DEFAULT gen_random_uuid(),
        bank_name       TEXT      NOT NULL,
        account_number  TEXT      NOT NULL,
        agency          TEXT,
        company_name    TEXT,
        company_id      VARCHAR   REFERENCES companies(id),
        created_at      TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS statements (
        id              VARCHAR   PRIMARY KEY DEFAULT gen_random_uuid(),
        filename        TEXT      NOT NULL,
        bank_account_id VARCHAR   REFERENCES bank_accounts(id),
        company_id      VARCHAR   REFERENCES companies(id),
        data            JSONB     NOT NULL,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `,
  },
  // Exemplo de migração futura:
  // {
  //   version: 2,
  //   description: "Adicionar campo notes em statements",
  //   sql: `ALTER TABLE statements ADD COLUMN IF NOT EXISTS notes TEXT;`,
  // },
];

// ─── Garante que o banco de dados existe ──────────────────────────────────
async function ensureDatabase(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  const dbName = url.pathname.slice(1);

  if (!dbName || dbName === "postgres") return;

  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";

  const client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[migrate] Banco de dados "${dbName}" criado.`);
    }
  } catch (err: any) {
    // Se não tiver permissão para criar, ignora — pode já existir
    if (!err.message?.includes("already exists")) {
      console.warn(`[migrate] Aviso ao verificar banco: ${err.message}`);
    }
  } finally {
    await client.end();
  }
}

// ─── Executa migrações pendentes ──────────────────────────────────────────
export async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return;

  // 1. Garante que o banco existe
  await ensureDatabase(connectionString);

  const client = new Client({ connectionString });
  try {
    await client.connect();

    // 2. Cria tabela de controle de versão
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     INTEGER   PRIMARY KEY,
        description TEXT,
        applied_at  TIMESTAMP DEFAULT NOW()
      )
    `);

    // 3. Verifica quais já foram aplicadas
    const { rows } = await client.query(
      "SELECT version FROM schema_migrations ORDER BY version"
    );
    const applied = new Set(rows.map((r: any) => r.version));

    // 4. Aplica pendentes em ordem
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;

      console.log(`[migrate] Aplicando v${migration.version}: ${migration.description}`);
      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (version, description) VALUES ($1, $2)",
          [migration.version, migration.description]
        );
        await client.query("COMMIT");
        console.log(`[migrate] v${migration.version} aplicada com sucesso.`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    // 5. Seed: cria admins padrão se não existirem
    await seedAdmins(client);

  } finally {
    await client.end();
  }
}

// ─── Usuários administradores padrão ──────────────────────────────────────
async function seedAdmins(client: InstanceType<typeof Client>): Promise<void> {
  const admins = [
    { username: "master",  password: "master",  name: "Master",  role: "admin" },
    { username: "cleiton", password: "cleiton", name: "Cleiton", role: "admin" },
  ];

  for (const admin of admins) {
    const { rows } = await client.query(
      "SELECT id FROM users WHERE username = $1",
      [admin.username]
    );
    if (rows.length === 0) {
      const hashed = await hashPassword(admin.password);
      await client.query(
        `INSERT INTO users (username, password, name, role, is_active)
         VALUES ($1, $2, $3, $4, true)`,
        [admin.username, hashed, admin.name, admin.role]
      );
      console.log(`[migrate] Usuário admin "${admin.username}" criado.`);
    }
  }
}
