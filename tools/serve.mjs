// Minimal local static server for previewing the site: node tools/serve.mjs [port]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
const root = join(fileURLToPath(import.meta.url), "..", "..");
const port = Number(process.argv[2] || 4173);
const types = { ".html":"text/html; charset=utf-8", ".css":"text/css", ".js":"text/javascript", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".woff2":"font/woff2", ".xml":"application/xml", ".txt":"text/plain" };
createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  let file = join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); res.end("Forbidden"); return; }
  try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); } catch {}
  try { const data = await readFile(file); res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" }); res.end(data); }
  catch { try { const d = await readFile(join(root, "404.html")); res.writeHead(404, { "Content-Type": types[".html"] }); res.end(d); } catch { res.writeHead(404); res.end("Not found"); } }
}).listen(port, () => console.log("Serving on http://localhost:" + port));
