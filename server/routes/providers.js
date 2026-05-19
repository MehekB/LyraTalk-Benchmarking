import { Router } from "express";

const ALLOWED = new Set(["stt", "llm", "tts"]);

function normalizeType(type) {
  const t = String(type ?? "")
    .trim()
    .toLowerCase();
  if (!ALLOWED.has(t)) return null;
  return { lower: t, upper: t.toUpperCase() };
}

function rowToClient(r) {
  return {
    id: Number(r.id),
    name: r.name,
    model: r.model,
    type: String(r.type).toLowerCase(),
  };
}

/** Routes for `providers` table (see schema/providers.sql). */
export default function providersRouter(pool) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, model, lower(type::text) AS type
         FROM providers
         ORDER BY id ASC`
      );
      return res.json(rows.map(rowToClient));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to list providers" });
    }
  });

  router.post("/", async (req, res) => {
    const { name, model, type } = req.body ?? {};
    const nt = normalizeType(type);
    const nm = String(name ?? "").trim();
    const md = String(model ?? "").trim();
    if (!nt) {
      return res.status(400).json({ error: "type must be stt, llm, or tts" });
    }
    if (!nm || !md) {
      return res.status(400).json({ error: "name and model are required" });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO providers (name, model, type)
         VALUES ($1, $2, $3)
         RETURNING id, name, model, lower(type) AS type`,
        [nm, md, nt.upper]
      );
      return res.status(201).json(rowToClient(rows[0]));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to create provider" });
    }
  });

  router.put("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1 || !Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const { name, model, type } = req.body ?? {};
    const nt = normalizeType(type);
    const nm = String(name ?? "").trim();
    const md = String(model ?? "").trim();
    if (!nt) {
      return res.status(400).json({ error: "type must be stt, llm, or tts" });
    }
    if (!nm || !md) {
      return res.status(400).json({ error: "name and model are required" });
    }
    try {
      const { rows, rowCount } = await pool.query(
        `UPDATE providers
         SET name = $1, model = $2, type = $3
         WHERE id = $4
         RETURNING id, name, model, lower(type) AS type`,
        [nm, md, nt.upper, id]
      );
      if (rowCount === 0) {
        return res.status(404).json({ error: "Provider not found" });
      }
      return res.json(rowToClient(rows[0]));
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to update provider" });
    }
  });

  router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1 || !Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM providers WHERE id = $1`,
        [id]
      );
      if (rowCount === 0) {
        return res.status(404).json({ error: "Provider not found" });
      }
      return res.status(204).send();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to delete provider" });
    }
  });

  return router;
}
