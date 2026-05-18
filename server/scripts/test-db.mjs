import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Missing DATABASE_URL. Copy .env.example to .env and set DATABASE_URL.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  const { rows } = await client.query("select current_database() as db, version() as version");
  console.log("OK — connected to Postgres.");
  console.log("  database:", rows[0].db);
  console.log("  server:  ", rows[0].version.split("\n")[0]);
} catch (err) {
  console.error("Connection failed:", err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
