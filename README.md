# Belgrave Consultancy website

Static site for www.belgraveconsultancy.com. Plain HTML built from templates, no framework, no cookies, fonts self-hosted. Visitor statistics use GoatCounter (cookieless).

## Layout

- `src/pages/*.html`: page sources. The first line is a JSON comment with the page meta (title, description, nav, cta, footer, noindex, jsonld).
- `src/partials/`: shared head, header and footers.
- `build.mjs`: builds the pages into the repository root (`about/index.html`, `index.html` and so on) and regenerates `sitemap.xml` and `robots.txt`. The built pages are committed.
- `assets/`: CSS, JS, images and fonts. `assets/js/site.config.js` holds the form endpoints.
- `tools/serve.mjs`: local preview. `tools/check.mjs`: pre-publish checks.
- `d/`, the IndexNow key file and `vercel.json` stay as they are.

Never edit the built pages by hand: change `src` and rebuild.

## Edit and preview

1. Change `src/pages/*.html`, `src/partials/*` or `assets/`.
2. `node build.mjs` (Node 20 or newer).
3. `node tools/check.mjs`: links and images resolve, one title, description, canonical and h1 per page, alt text, sitemap matches the indexable pages, no placeholder text, one proof-line wording. It must print OK.
4. `node tools/serve.mjs` and open http://localhost:4173. Check desktop and a 390 px phone width.

## Publish

Work on a branch, then merge to `main` with a merge commit and push. Vercel builds nothing (the output is committed) and deploys `main` to production within about a minute. Tag each publish (`v-publish-YYYY-MM-DD`), so any change can be rolled back. After a publish, send the changed URLs to IndexNow (key file in the site root), and check them on the live site.

Keep a dated copy of every published version of the terms and the privacy notice.

## Hosting

- Vercel project `belgrave-consultancy`, team "Belgrave Management", connected to this repository (branch `main`).
- `vercel.json` sets trailing slashes, security headers and cache lifetimes. `.vercelignore` keeps `CNAME`, `.nojekyll`, `README.md`, `build.mjs`, `src` and `tools` out of the deployment.
- DNS is at Hostnet: apex `A 216.150.1.1`, `www CNAME 838f34f0b9a8d1b5.vercel-dns-016.com`, TTL 600. Email (MX, SPF, DKIM, DMARC) and `store.belgraveconsultancy.com` (Lemon Squeezy) are separate records and stay as they are.
- Rollback while the GitHub Pages fallback still exists: apex `A` 185.199.108.153, 185.199.109.153, 185.199.110.153 and 185.199.111.153, the matching AAAA records, and `www CNAME mmbelgrave.github.io`.
- The GitHub Pages deployment and the `CNAME` file are to be retired about a week after the move (29 October 2026).

## Forms, tracking and services

- Bid Advisor and the withdrawal form: Formspree (one endpoint in `site.config.js`). The contact page has no form: email and WhatsApp buttons.
- Free ERP resources: MailerLite (plain and follow-up forms). The Bid Advisor follow-up list is optional and unticked.
- Checkout: Lemon Squeezy, at store.belgraveconsultancy.com. It is the seller of record.
- Statistics: GoatCounter. Events are in `assets/js/site.js` (`cta-consultancy-click`, `guide-checkout-click`, `whatsapp-click`, `email-click`, form start and sent events).
- Search: sitemap submitted in Google Search Console and Bing Webmaster Tools.

## Notes

- `/withdraw/` is deliberately `noindex` and not in the sitemap. Each withdrawal needs a manual acknowledgement email with the date and time.
- Keep the privacy notice and the Lemon Squeezy product text in step with these services.
