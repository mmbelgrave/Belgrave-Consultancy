# Belgrave Consultancy website

Static site for www.belgraveconsultancy.com. No framework, no tracking, fonts self-hosted.

## Edit and preview

- Pages live in `src/pages/*.html`; shared header, footer and head in `src/partials/`.
- Rebuild the finished pages with `node build.mjs` (Node 20+). The output is committed, because GitHub Pages serves the repository root.
- Preview locally with `node tools/serve.mjs` and open http://localhost:4173.
- Settings (hide the EUR 149 tier, connect forms) are in `assets/js/site.config.js`.

## Before going live

1. Connect the four forms (contact, scorecard, costing checklist, Bid Advisor) in `assets/js/site.config.js`.
2. Have the privacy and terms pages reviewed; remove the "Draft" boxes in `src/pages/privacy.html` and `src/pages/terms.html`.
3. Confirm Lemon Squeezy accepts the guide + review product (its rules ban services), or set `showReview: false`.
4. Enable GitHub Pages, add the custom domain, and point DNS at GitHub.
