import { Router } from "express";

const ALLOWED = new Set(["stt", "llm", "tts"]);

function normalizeType(type) {
  const t = String(type ?? "")
    .trim()
    .toLowerCase();
  if (!ALLOWED.has(t)) return null;
  return { lower: t, upper: t.toUpperCase() };
}

function parseUnitPrice(value, label) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return { error: `${label} must be a non-negative number` };
  }
  return n;
}

function rowToClient(r) {
  return {
    id: Number(r.id),
    name: r.name,
    model: r.model,
    type: String(r.type).toLowerCase(),
    input_unit_price:
      r.input_unit_price != null ? Number(r.input_unit_price) : null,
    output_unit_price:
      r.output_unit_price != null ? Number(r.output_unit_price) : null,
  };
}

function parseProviderPrices(body, typeLower) {
  const input = parseUnitPrice(body?.input_unit_price, "input_unit_price");
  if (input && typeof input === "object" && "error" in input) return input;

  if (typeLower === "llm") {
    const output = parseUnitPrice(body?.output_unit_price, "output_unit_price");
    if (output && typeof output === "object" && "error" in output) return output;
    return { input_unit_price: input, output_unit_price: output };
  }

  if (body?.output_unit_price != null && body?.output_unit_price !== "") {
    return { error: "output_unit_price is only allowed for llm providers" };
  }

  return { input_unit_price: input, output_unit_price: null };
}

/** Routes for `providers` table (see schema/providers.sql). */
export default function providersRouter(pool) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, model, lower(type::text) AS type,
                input_unit_price, output_unit_price
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
    const prices = parseProviderPrices(req.body, nt.lower);
    if (prices.error) {
      return res.status(400).json({ error: prices.error });
    }
    try {
      const { rows } = await pool.query(
        `INSERT INTO providers (name, model, type, input_unit_price, output_unit_price)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, model, lower(type) AS type,
                   input_unit_price, output_unit_price`,
        [nm, md, nt.upper, prices.input_unit_price, prices.output_unit_price]
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
    const prices = parseProviderPrices(req.body, nt.lower);
    if (prices.error) {
      return res.status(400).json({ error: prices.error });
    }
    try {
      const { rows, rowCount } = await pool.query(
        `UPDATE providers
         SET name = $1, model = $2, type = $3,
             input_unit_price = $4, output_unit_price = $5
         WHERE id = $6
         RETURNING id, name, model, lower(type) AS type,
                   input_unit_price, output_unit_price`,
        [nm, md, nt.upper, prices.input_unit_price, prices.output_unit_price, id]
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
