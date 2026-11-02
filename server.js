// Small API server for the recipe generator.
// - POST /api/recipe asks the AI for a recipe (the API key stays on the server).
// - In production it also serves the built React app from dist/.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.TOGETHER_API_KEY;
const MODEL = process.env.TOGETHER_MODEL || "openai/gpt-oss-120b";
const DIST = join(import.meta.dirname, "dist");

// At most 10 recipes per minute from one IP, so a public demo can't drain the key.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

const PROMPT = `You are a helpful chef. Create ONE recipe using mainly the given ingredients.
You may add common pantry items (salt, pepper, oil, water, basic spices).
Reply with ONLY a JSON object, no other text, in exactly this shape:
{"title": string, "description": string, "time": string, "servings": number,
 "ingredients": [string], "steps": [string], "tip": string}`;

async function generateRecipe({ ingredients, diet, cuisine }) {
  const ask = [
    `Ingredients: ${ingredients}`,
    diet && `Diet: ${diet}`,
    cuisine && `Cuisine: ${cuisine}`,
  ].filter(Boolean).join("\n");

  const res = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{ role: "system", content: PROMPT }, { role: "user", content: ask }],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const text = (await res.json()).choices?.[0]?.message?.content || "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) throw new Error("Request too large");
  }
  return JSON.parse(body || "{}");
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

async function serveStatic(req, res) {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  const file = join(DIST, path || "index.html");
  if (!file.startsWith(DIST)) return send(res, 403, { error: "Forbidden" });
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    try {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(await readFile(join(DIST, "index.html")));
    } catch {
      send(res, 404, { error: "Not found. Run `npm run build` first." });
    }
  }
}

createServer(async (req, res) => {
  if (req.url !== "/api/recipe") return serveStatic(req, res);
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  if (!API_KEY) return send(res, 500, { error: "Server is missing TOGETHER_API_KEY." });
  if (rateLimited(req.socket.remoteAddress)) return send(res, 429, { error: "Too many requests. Wait a minute and try again." });

  try {
    const { ingredients = "", diet = "", cuisine = "" } = await readBody(req);
    if (!ingredients.trim()) return send(res, 400, { error: "Add at least one ingredient." });
    if (ingredients.length > 500) return send(res, 400, { error: "Keep the ingredient list under 500 characters." });
    send(res, 200, await generateRecipe({ ingredients: ingredients.trim(), diet, cuisine }));
  } catch (err) {
    console.error(err);
    send(res, 502, { error: "Couldn't create a recipe right now. Please try again." });
  }
}).listen(PORT, () => console.log(`Recipe API running on http://localhost:${PORT}`));
