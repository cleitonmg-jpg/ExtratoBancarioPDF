import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// DB_TYPE=postgres → conecta ao PostgreSQL via DATABASE_URL
// DB_TYPE=memory (ou não definido) → sem banco, dados em memória
const usePostgres = process.env.DB_TYPE === "postgres";

if (usePostgres && !process.env.DATABASE_URL) {
  throw new Error(
    "DB_TYPE=postgres requer DATABASE_URL definido no .env\n" +
    "Exemplo: DATABASE_URL=postgres://postgres:postgres@localhost:5432/extratoai"
  );
}

export const pool = usePostgres
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null;
