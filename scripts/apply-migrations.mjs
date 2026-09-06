#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql in order.
 *
 * Requires DATABASE_URL (Supabase dashboard → Project Settings → Database →
 * Connection string → URI). The anon/service keys cannot execute DDL, so this
 * is the only automated path; otherwise paste supabase/schema.sql into the
 * SQL editor.
 *
 *   npm run db:push
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// .env.local is not auto-loaded outside Next
for (const file of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // optional
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(`
DATABASE_URL is not set.

  1. Supabase dashboard → Project Settings → Database → Connection string (URI)
  2. Put it in .env.local as DATABASE_URL=postgresql://...
  3. Re-run: npm run db:push

Alternatively, open the SQL editor and paste the contents of
supabase/schema.sql (all migrations concatenated in order).
`);
  process.exit(1);
}

const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log(`connected · applying ${files.length} migration(s)`);

for (const file of files) {
  const sql = readFileSync(join(dir, file), "utf8");
  process.stdout.write(`  ${file} … `);
  try {
    await client.query(sql);
    console.log("ok");
  } catch (err) {
    console.log("FAILED");
    console.error(`\n${err.message}\n`);
    await client.end();
    process.exit(1);
  }
}

const { rows } = await client.query(
  `select count(*)::int as n from information_schema.tables where table_schema = 'public'`,
);
console.log(`\ndone · ${rows[0].n} tables in public schema`);

await client.end();
