// Tiny static-site builder: node build.mjs
// Reads src/pages/*.html (first line: <!--{json meta}-->) and src/partials/*.html,
// writes the finished pages into the repository root (what GitHub Pages serves).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://www.belgraveconsultancy.com";
const partial = (n) => readFileSync(join("src/partials", n + ".html"), "utf8");
const pages = readdirSync("src/pages").filter((f) => f.endsWith(".html"));
const sitemap = [];

for (const file of pages) {
  const raw = readFileSync(join("src/pages", file), "utf8");
  const m = raw.match(/^<!--(\{[\s\S]*?\})-->\s*/);
  if (!m) throw new Error(file + ": missing meta comment");
  const meta = JSON.parse(m[1]);
  const body = raw.slice(m[0].length);
  const slug = file.replace(/\.html$/, "");
  const isHome = slug === "index";
  const is404 = slug === "404";
  const root = is404 ? "/" : isHome ? "" : "../";
  const home = is404 ? "/" : isHome ? "" : "../";
  const canonical = isHome ? SITE + "/" : is404 ? "" : SITE + "/" + slug + "/";
  const vars = {
    root, home, canonical,
    title: meta.title, description: meta.description,
    ogimage: SITE + "/assets/img/og-image.jpg",
    robots: meta.noindex ? '<meta name="robots" content="noindex">' : "",
    canonicalTag: canonical ? `<link rel="canonical" href="${canonical}">` : "",
    year: String(new Date().getFullYear()),
  };
  const nav = meta.nav || "";
  const navLink = (key, href, label) =>
    `<a href="${href}"${nav === key ? ' aria-current="page"' : ""}>${label}</a>`;
  // Two paths: work with Mwata (Consultancy, Experience, About) and use a product (Products).
  vars.navlinks = [
    navLink("home", root || "./", "Home"),
    navLink("consultancy", root + "consultancy/", "Consultancy"),
    navLink("guide", root + "guide/", "ERP guide"),
    navLink("about", root + "about/", "About"),
  ].join("\n      ");
  // Header action: consultancy pages ask for an enquiry; product pages can set their own.
  const cta = meta.cta || { label: "Discuss your situation", href: "contact/?topic=consultancy" };
  vars.ctaLabel = cta.label;
  vars.ctaHref = /^(#|https?:)/.test(cta.href) ? cta.href : root + cta.href;
  vars.contactActive = nav === "contact" ? ' aria-current="page"' : "";
  vars.extra = meta.extra ? meta.extra.replace(/\{\{root\}\}/g, root) : "";

  const apply = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : "{{" + k + "}}"));
  const html = apply(partial("head")) + apply(partial("header")) + apply(body) + apply(partial(meta.footer === "compact" ? "footer-compact" : "footer"));

  const out = isHome ? "index.html" : is404 ? "404.html" : join(slug, "index.html");
  if (!isHome && !is404) mkdirSync(slug, { recursive: true });
  writeFileSync(out, html);
  if (!is404 && !meta.noindex) sitemap.push(canonical);
  console.log("built", out);
}

writeFileSync("sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  sitemap.map((u) => `  <url><loc>${u}</loc></url>`).join("\n") + `\n</urlset>\n`);
writeFileSync("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
