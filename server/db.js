import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy server/.env.example to server/.env.");
}

export const pool = new pg.Pool({ connectionString: url });
