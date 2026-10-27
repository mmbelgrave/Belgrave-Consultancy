// Pre-publish checks on the built pages: node tools/check.mjs
// Looks at the generated HTML in the repository root (run node build.mjs first).
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, normalize } from "node:path";

const SITE = "https://www.belgraveconsultancy.com";
const problems = [];
const notes = [];
const warn = (page, msg) => problems.push(`${page}: ${msg}`);
const note = (page, msg) => notes.push(`${page}: ${msg}`);

const pages = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    if (["node_modules", ".git", "src", "tools", "d"].includes(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".html")) pages.push(p);
  }
};
walk(".");

const descriptions = new Map();
const proofLines = new Set();

for (const file of pages) {
  const html = readFileSync(file, "utf8");
  const rel = file.replace(/\\/g, "/");
  const get = (re) => [...html.matchAll(re)].map((m) => m[1]);
  const noindex = /<meta name="robots" content="noindex">/.test(html);

  // title, description, canonical, h1
  if (get(/<title>([^<]*)<\/title>/g).length !== 1) warn(rel, "needs exactly one <title>");
  const desc = get(/<meta name="description" content="([^"]*)"/g);
  if (desc.length !== 1) warn(rel, "needs exactly one meta description");
  else if (!noindex) {
    if (descriptions.has(desc[0])) warn(rel, `same description as ${descriptions.get(desc[0])}`);
    descriptions.set(desc[0], rel);
    if (desc[0].length < 70 || desc[0].length > 200) note(rel, `description length ${desc[0].length} (aim for about 120 to 160)`);
  }
  if (rel !== "404.html" && get(/<link rel="canonical" href="([^"]*)"/g).length !== 1) warn(rel, "needs one canonical");
  if ((html.match(/<h1[ >]/g) || []).length !== 1) warn(rel, "needs exactly one h1");
  if (!/property="og:image"/.test(html)) warn(rel, "missing og:image");

  // headings must not skip a level
  let last = 0;
  for (const m of html.matchAll(/<h([1-6])[ >]/g)) {
    const n = Number(m[1]);
    if (last && n > last + 1) { warn(rel, `heading level jumps from h${last} to h${n}`); break; }
    last = n;
  }

  // images: alt present
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(m[0])) warn(rel, `image without alt: ${m[0].slice(0, 80)}`);
  }

  // JSON-LD parses
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { warn(rel, "JSON-LD does not parse"); }
  }

  // placeholders
  const visible = html.split('<script type="application/ld+json">').map((part, i) => (i === 0 ? part : part.slice(part.indexOf("</script>") + 9))).join("");
  for (const bad of ["TODO", "lorem ipsum", "{{", "}}"]) {
    if (visible.includes(bad)) warn(rel, `contains "${bad}"`);
  }

  // internal links and files resolve
  const base = dirname(file);
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    let u = m[1];
    if (/^(https?:|mailto:|tel:|#|data:|\/\/)/.test(u)) {
      if (u.startsWith(SITE)) u = u.slice(SITE.length) || "/"; else continue;
    }
    u = u.split("#")[0].split("?")[0];
    if (!u) continue;
    const target = u.startsWith("/") ? normalize(u.slice(1)) : normalize(join(base, u));
    const candidates = [target, join(target, "index.html")];
    if (!candidates.some((c) => existsSync(c) && (statSync(c).isFile()))) warn(rel, `broken link or file: ${m[1]}`);
  }

  // proof line wording must be the same everywhere it appears
  for (const m of html.matchAll(/three[^<.]{0,40}ERP implementations?[^<.]{0,60}/gi)) proofLines.add(m[0].trim());
}

// sitemap lists exactly the indexable pages and each exists
if (existsSync("sitemap.xml")) {
  const sm = readFileSync("sitemap.xml", "utf8");
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const u of urls) {
    const p = u.slice(SITE.length).replace(/^\//, "");
    if (!existsSync(join(p, "index.html")) && !(p === "" && existsSync("index.html"))) warn("sitemap.xml", `listed page does not exist: ${u}`);
  }
  for (const f of pages) {
    const html = readFileSync(f, "utf8");
    if (/<meta name="robots" content="noindex">/.test(html) || f.replace(/\\/g, "/") === "404.html") continue;
    const path = f.replace(/\\/g, "/").replace(/index\.html$/, "");
    const url = SITE + "/" + path;
    if (!urls.includes(url)) warn("sitemap.xml", `indexable page missing from sitemap: ${url}`);
  }
}

if (proofLines.size > 1) notes.push(`proof line differs between pages:\n    - ${[...proofLines].join("\n    - ")}`);

if (notes.length) { console.log(`${notes.length} note(s):`); for (const n of notes) console.log("  " + n); }
if (problems.length) {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log(`OK: ${pages.length} pages checked, no problems.`);
