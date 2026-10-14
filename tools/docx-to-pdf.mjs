// Converts the Belgrave lead-magnet Word files to PDF without Word installed.
// Word (.docx) -> HTML (tables, shading, borders, fonts, header and footer) -> PDF via Microsoft Edge.
//
// Usage:  node tools/docx-to-pdf.mjs "input.docx" "output.pdf"
// Needs Windows (PowerShell, Edge). Handles directly formatted documents like the lead magnets;
// it is not a general Word converter (no styles, lists or images).

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const [, , input, output] = process.argv;
if (!input || !output) { console.error('Usage: node tools/docx-to-pdf.mjs "in.docx" "out.pdf"'); process.exit(1); }

// Word's "single" line spacing for Arial is 1.15. Chrome lays text out slightly taller, so 1.10 reproduces Word's page breaks; tune with DOCX2PDF_LH.
const LH = +process.env.DOCX2PDF_LH || 1.10;

/* ---------- unzip ---------- */
const work = join(tmpdir(), "docx2pdf-" + Date.now());
mkdirSync(work, { recursive: true });
copyFileSync(resolve(input), join(work, "doc.zip"));
execFileSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${join(work, "doc.zip")}' -DestinationPath '${join(work, "x")}' -Force`]);
const part = (p) => { const f = join(work, "x", p); return existsSync(f) ? readFileSync(f, "utf8") : null; };

/* ---------- tiny XML parser ---------- */
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const dec = (s) => s.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] ?? m));
function parseXml(s) {
  const root = { n: "#root", a: {}, c: [] }, stack = [root];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/([\w:.-]+)\s*>|<([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) { stack.pop(); }
    else if (m[2]) {
      const a = {}; const are = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g; let am;
      while ((am = are.exec(m[3]))) a[am[1]] = dec(am[2] ?? am[3]);
      const node = { n: m[2], a, c: [] }; stack[stack.length - 1].c.push(node);
      if (!m[4]) stack.push(node);
    } else if (m[5] !== undefined) { stack[stack.length - 1].c.push({ t: dec(m[5]) }); }
  }
  return root.c.find((x) => x.n);
}
const kids = (n, name) => (n?.c || []).filter((x) => x.n === name);
const kid = (n, name) => (n?.c || []).find((x) => x.n === name);
const at = (n, a) => n?.a?.[a];
const desc = (n, name) => { for (const x of n?.c || []) { if (x.n === name) return x; const d = desc(x, name); if (d) return d; } return null; };
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pt = (tw) => +(tw / 20).toFixed(2);
const on = (n) => n && at(n, "w:val") !== "0" && at(n, "w:val") !== "false";

/* ---------- document defaults ---------- */
const styles = parseXml(part("word/styles.xml"));
const dd = kid(kid(kid(styles, "w:docDefaults"), "w:rPrDefault"), "w:rPr");
const defFont = at(kid(dd, "w:rFonts"), "w:ascii") || "Arial";
const defSize = at(kid(dd, "w:sz"), "w:val") ? at(kid(dd, "w:sz"), "w:val") / 2 : 10;
const defColor = at(kid(dd, "w:color"), "w:val") || "000000";

/* ---------- formatting helpers ---------- */
const hex = (c) => (!c || c === "auto" ? "#000000" : "#" + c);
function borderCss(b) {
  if (!b) return null;
  const v = at(b, "w:val");
  if (!v || v === "none" || v === "nil") return "none";
  const w = Math.max(0.5, (+at(b, "w:sz") || 4) / 8);
  const style = { dashed: "dashed", dotted: "dotted", double: "double" }[v] || "solid";
  return `${w}pt ${style} ${hex(at(b, "w:color"))}`;
}
function runCss(rpr) {
  const css = [];
  if (!rpr) return css;
  const f = kid(rpr, "w:rFonts"); const font = at(f, "w:ascii") || at(f, "w:hAnsi");
  if (font) css.push(`font-family:'${font}',Arial,sans-serif`);
  if (on(kid(rpr, "w:b"))) css.push("font-weight:700");
  if (on(kid(rpr, "w:i"))) css.push("font-style:italic");
  const col = at(kid(rpr, "w:color"), "w:val"); if (col && col !== "auto") css.push(`color:#${col}`);
  const sz = at(kid(rpr, "w:sz"), "w:val"); if (sz) css.push(`font-size:${sz / 2}pt`);
  if (on(kid(rpr, "w:caps"))) css.push("text-transform:uppercase");
  if (on(kid(rpr, "w:smallCaps"))) css.push("font-variant:small-caps");
  const sp = at(kid(rpr, "w:spacing"), "w:val"); if (sp) css.push(`letter-spacing:${pt(+sp)}pt`);
  const deco = []; if (kid(rpr, "w:u") && at(kid(rpr, "w:u"), "w:val") !== "none") deco.push("underline"); if (on(kid(rpr, "w:strike"))) deco.push("line-through");
  if (deco.length) css.push(`text-decoration:${deco.join(" ")}`);
  const va = at(kid(rpr, "w:vertAlign"), "w:val"); if (va === "superscript") css.push("vertical-align:super;font-size:70%"); if (va === "subscript") css.push("vertical-align:sub;font-size:70%");
  const sh = at(kid(rpr, "w:shd"), "w:fill"); if (sh && sh !== "auto") css.push(`background:#${sh}`);
  return css;
}

/* ---------- blocks ---------- */
function blocks(children, ctx) {
  let out = "";
  for (const n of children || []) {
    if (n.n === "w:p") out += para(n, ctx);
    else if (n.n === "w:tbl") out += table(n, ctx);
    else if (n.n === "w:sdt") out += blocks(kid(n, "w:sdtContent")?.c, ctx);
  }
  return out;
}

function para(p, ctx) {
  const ppr = kid(p, "w:pPr");
  const css = ["margin:0"];
  const sp = kid(ppr, "w:spacing");
  if (at(sp, "w:before")) css.push(`padding-top:${pt(+at(sp, "w:before"))}pt`);
  if (at(sp, "w:after")) css.push(`padding-bottom:${pt(+at(sp, "w:after"))}pt`);
  const line = at(sp, "w:line"), rule = at(sp, "w:lineRule") || "auto";
  css.push(line ? (rule === "auto" ? `line-height:${((+line / 240) * LH).toFixed(3)}` : `line-height:${pt(+line)}pt`) : `line-height:${LH}`);
  const ind = kid(ppr, "w:ind");
  const left = +at(ind, "w:left") || +at(ind, "w:start") || 0, right = +at(ind, "w:right") || 0;
  if (left) css.push(`padding-left:${pt(left)}pt`);
  if (right) css.push(`padding-right:${pt(right)}pt`);
  if (at(ind, "w:hanging")) css.push(`text-indent:-${pt(+at(ind, "w:hanging"))}pt`);
  else if (at(ind, "w:firstLine")) css.push(`text-indent:${pt(+at(ind, "w:firstLine"))}pt`);
  const jc = at(kid(ppr, "w:jc"), "w:val");
  if (jc) css.push(`text-align:${{ both: "justify", center: "center", right: "right", end: "right" }[jc] || "left"}`);
  const fill = at(kid(ppr, "w:shd"), "w:fill"); if (fill && fill !== "auto") css.push(`background:#${fill}`);
  const pb = kid(ppr, "w:pBdr");
  if (pb) for (const [w, c] of [["w:top", "top"], ["w:bottom", "bottom"], ["w:left", "left"], ["w:right", "right"]]) {
    const b = kid(pb, w); const v = borderCss(b); if (v && v !== "none") { css.push(`border-${c}:${v}`); css.push(`padding-${c}:${+at(b, "w:space") || 0}pt`); }
  }
  if (kid(ppr, "w:keepNext")) css.push("break-after:avoid");
  if (kid(ppr, "w:keepLines")) css.push("break-inside:avoid");
  if (kid(ppr, "w:pageBreakBefore")) css.push("break-before:page");
  css.push("position:relative");

  let html = "", pageBreak = false, hasText = false;
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (n.n === "w:r") {
        const rcss = runCss(kid(n, "w:rPr"));
        let inner = "";
        for (const c of n.c) {
          if (c.n === "w:t") { inner += esc(c.c.map((x) => x.t || "").join("")); hasText = true; }
          else if (c.n === "w:tab") { inner += '<span class="tab"></span>'; }
          else if (c.n === "w:lastRenderedPageBreak") { inner += "<!--LRPB-->"; }
          else if (c.n === "w:noBreakHyphen") { inner += "&#8209;"; }
          else if (c.n === "w:br") { if (at(c, "w:type") === "page") pageBreak = true; else inner += "<br>"; }
          else if (c.n === "w:drawing") { inner += drawing(c, ctx); }
          else if (c.n === "mc:AlternateContent") { const ch = kid(c, "mc:Choice"); for (const d of kids(ch, "w:drawing")) inner += drawing(d, ctx); }
        }
        if (inner) html += inner === "<!--LRPB-->" ? inner : `<span style="white-space:pre-wrap;${rcss.join(";")}">${inner}</span>`;
      } else if (["w:hyperlink", "w:ins", "w:smartTag", "w:fldSimple"].includes(n.n)) walk(n.c);
      else if (n.n === "mc:AlternateContent") { const ch = kid(n, "mc:Choice"); walk(ch?.c); }
    }
  };
  walk(p.c);
  if (!html.replace(/<span[^>]*><\/span>/g, "").trim() || (!hasText && !html.includes("fbox"))) {
    const psz = at(kid(kid(ppr, "w:rPr"), "w:sz"), "w:val");
    html = `<span style="${psz ? `font-size:${psz / 2}pt` : ""}">&nbsp;</span>` + html;
  }
  return `<div style="${css.join(";")}">${html}</div>` + (pageBreak ? '<div style="break-after:page;height:0"></div>' : "");
}

function drawing(d, ctx) {
  const anchor = kid(d, "wp:anchor") || kid(d, "wp:inline");
  const tx = desc(d, "w:txbxContent");
  if (!anchor || !tx) return "";
  const ext = kid(anchor, "wp:extent");
  const w = +at(ext, "cx") / 12700, h = +at(ext, "cy") / 12700;
  const ph = +(kid(kid(anchor, "wp:positionH"), "wp:posOffset")?.c?.[0]?.t || 0) / 12700;
  const pv = +(kid(kid(anchor, "wp:positionV"), "wp:posOffset")?.c?.[0]?.t || 0) / 12700;
  const sp = desc(d, "wps:spPr");
  const fill = at(desc(sp, "a:srgbClr"), "val");
  const lnClr = at(desc(kid(sp, "a:ln"), "a:srgbClr"), "val");
  const css = [`position:absolute`, `left:${ph.toFixed(1)}pt`, `top:${pv.toFixed(1)}pt`, `width:${w.toFixed(1)}pt`, `padding:3.6pt 7.2pt`, `z-index:3`, `box-sizing:border-box`];
  if (fill) css.push(`background:#${fill}`);
  if (lnClr) css.push(`border:0.75pt solid #${lnClr}`);
  return `<div class="fbox" style="${css.join(";")}">${blocks(tx.c, ctx)}</div>`;
}

/* ---------- tables ---------- */
function table(tbl, ctx) {
  const pr = kid(tbl, "w:tblPr");
  const tb = {}; const tbe = kid(pr, "w:tblBorders");
  for (const s of ["top", "left", "bottom", "right", "insideH", "insideV"]) tb[s] = borderCss(kid(tbe, "w:" + s));
  const tcm = kid(pr, "w:tblCellMar");
  const dm = { top: 0, bottom: 0, left: 108, right: 108 };
  for (const s of Object.keys(dm)) { const v = at(kid(tcm, "w:" + s), "w:w"); if (v !== undefined) dm[s] = +v; }
  const grid = kids(kid(tbl, "w:tblGrid"), "w:gridCol").map((g) => +at(g, "w:w"));
  const tw = at(kid(pr, "w:tblW"), "w:w") ? +at(kid(pr, "w:tblW"), "w:w") : grid.reduce((a, b) => a + b, 0);
  const jc = at(kid(pr, "w:jc"), "w:val");
  const tcss = [`border-collapse:collapse`, `table-layout:fixed`, ctx.depth ? `width:100%` : `width:${pt(tw)}pt`];
  if (jc === "center") tcss.push("margin:0 auto");
  const ind = at(kid(pr, "w:tblInd"), "w:w"); if (ind) tcss.push(`margin-left:${pt(+ind)}pt`);
  const rows = kids(tbl, "w:tr");
  let html = `<table style="${tcss.join(";")}"><colgroup>${grid.map((g) => `<col style="width:${pt(g)}pt">`).join("")}</colgroup><tbody>`;
  rows.forEach((tr, ri) => {
    const trp = kid(tr, "w:trPr"); const rcss = [];
    if (kid(trp, "w:cantSplit")) rcss.push("break-inside:avoid");
    const th = kid(trp, "w:trHeight"); if (th) rcss.push(`height:${pt(+at(th, "w:val"))}pt`);
    const rowStart = html.length; html += `<tr style="${rcss.join(";")}">`;
    let gi = 0;
    for (const tc of kids(tr, "w:tc")) {
      const cp = kid(tc, "w:tcPr");
      const span = +at(kid(cp, "w:gridSpan"), "w:val") || 1;
      const css = ["vertical-align:top"];
      const sides = [["top", ri === 0 ? "top" : "insideH"], ["bottom", ri === rows.length - 1 ? "bottom" : "insideH"], ["left", gi === 0 ? "left" : "insideV"], ["right", gi + span >= grid.length ? "right" : "insideV"]];
      const cb = kid(cp, "w:tcBorders");
      for (const [side, tkey] of sides) {
        const own = borderCss(kid(cb, "w:" + side));
        const v = own ?? tb[tkey];
        css.push(v && v !== "none" ? `border-${side}:${v}` : `border-${side}:none`);
      }
      const fill = at(kid(cp, "w:shd"), "w:fill"); if (fill && fill !== "auto") css.push(`background:#${fill}`);
      const mar = kid(cp, "w:tcMar");
      for (const s of ["top", "bottom", "left", "right"]) {
        const v = at(kid(mar, "w:" + s), "w:w"); let p = pt(v !== undefined ? +v : dm[s]);
        const bw = parseFloat(((css.find((c) => c.startsWith("border-" + s + ":")) || "").match(/:([d.]+)pt/) || [])[1] || 0);
        css.push(`padding-${s}:${Math.max(0, p - bw / 2).toFixed(2)}pt`);
      }
      const va = at(kid(cp, "w:vAlign"), "w:val"); if (va === "center") css[0] = "vertical-align:middle"; if (va === "bottom") css[0] = "vertical-align:bottom";
      html += `<td colspan="${span}" style="${css.join(";")}">${blocks(tc.c, { ...ctx, depth: (ctx.depth || 0) + 1 })}</td>`;
      gi += span;
    }
    html += "</tr>";
    if (html.indexOf("<!--LRPB-->", rowStart) >= 0) {
      html = html.slice(0, rowStart) + html.slice(rowStart).replace("<tr style=\"", "<tr style=\"break-before:page;").replace(/<!--LRPB-->/g, "");
    }
  });
  return html + "</tbody></table>";
}

/* ---------- assemble ---------- */
const doc = parseXml(part("word/document.xml"));
const body = kid(doc, "w:body");
const sect = kid(body, "w:sectPr");
const pg = kid(sect, "w:pgMar"), sz = kid(sect, "w:pgSz");
const M = { t: +at(pg, "w:top"), r: +at(pg, "w:right"), b: +at(pg, "w:bottom"), l: +at(pg, "w:left"), h: +at(pg, "w:header"), f: +at(pg, "w:footer") };
const rel = part("word/_rels/document.xml.rels") || "";
const relTarget = (id) => (rel.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${id}"`)) || []).slice(1).find(Boolean);
function hf(kind) {
  const ref = kid(sect, `w:${kind}Reference`); if (!ref) return "";
  const t = relTarget(at(ref, "r:id")); if (!t) return "";
  const x = part("word/" + t); if (!x) return "";
  return blocks(parseXml(x).c, {});
}
const header = hf("header"), footer = hf("footer");
const bodyHtml = blocks(body.c.filter((x) => x.n !== "w:sectPr"), {});

const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(input.split(/[\\/]/).pop())}</title>
<style>
@page{size:${pt(+at(sz, "w:w"))}pt ${pt(+at(sz, "w:h"))}pt;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:'${defFont}',Arial,sans-serif;font-size:${defSize}pt;color:#${defColor};-webkit-print-color-adjust:exact;print-color-adjust:exact;line-height:${LH}}
.tab{display:inline-block;width:36pt}
.frame{width:100%;border-collapse:collapse;table-layout:fixed}
.frame>thead>tr>td{height:${pt(M.t)}pt;padding:${pt(M.h)}pt ${pt(M.r)}pt 0 ${pt(M.l)}pt;vertical-align:top}
.frame>tfoot>tr>td{height:${pt(M.b)}pt;padding:0 ${pt(M.r)}pt ${pt(M.f)}pt ${pt(M.l)}pt;vertical-align:bottom}
.frame>tbody>tr>td{padding:0 ${pt(M.r)}pt 0 ${pt(M.l)}pt;vertical-align:top}
td{word-wrap:break-word}
</style></head><body>
<table class="frame"><thead><tr><td>${header}</td></tr></thead><tfoot><tr><td>${footer}</td></tr></tfoot><tbody><tr><td>${bodyHtml}</td></tr></tbody></table>
</body></html>`;

// DOCX2PDF_BREAKS=nokeepnext|noinside|none lets you loosen Word's keep-with-next / keep-together rules
const mode = process.env.DOCX2PDF_BREAKS || "";
let finalHtml = html;
if (mode === "nokeepnext" || mode === "none") finalHtml = finalHtml.replace(/break-after:avoid;?/g, "");
if (mode === "noinside" || mode === "none") finalHtml = finalHtml.replace(/break-inside:avoid;?/g, "");
const htmlPath = join(work, "doc.html");
writeFileSync(htmlPath, finalHtml);
const edge = ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find(existsSync);
if (!edge) { console.error("Edge or Chrome not found"); process.exit(1); }
const out = resolve(output);
execFileSync(edge, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${out}`, "--user-data-dir=" + join(work, "profile"), pathToFileURL(htmlPath).href], { timeout: 120000, stdio: "ignore" });
console.log("wrote", out, "| html kept at", htmlPath);
