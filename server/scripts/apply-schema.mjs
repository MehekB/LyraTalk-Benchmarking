import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.join(__dirname, "..", "schema");

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Missing DATABASE_URL. Set it in server/.env (see .env.example).");
  process.exit(1);
}

const files = (await fs.readdir(schemaDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("No .sql files in", schemaDir);
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });

try {
  await client.connect();
  for (const file of files) {
    const sql = await fs.readFile(path.join(schemaDir, file), "utf8");
    console.log("Applying", file, "…");
    await client.query(sql);
  }
  console.log("Schema applied successfully.");
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
