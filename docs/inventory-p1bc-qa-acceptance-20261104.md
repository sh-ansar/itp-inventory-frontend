# ITP Inventory — P1-B/C QA acceptance, 2026-11-04

## Scope and environment
- Frontend PR #38 and Backend PR #20; production confirmed at Frontend r21 / Backend r10 before this exercise.
- Synthetic accounts, isolated QA SQLite only: Frontend 127.0.0.1:5236, Backend 127.0.0.1:18191.
- A collision on 18090 with a separate old backend caused an initial QA login 422; dedicated ports resolved it.
- Production DB, Apache config, and all other applications were left unchanged.

## Verified evidence
- Backend PHPUnit: 92 passed, 1,416 assertions on PHP 8.4.26.
- Frontend: 83 unit tests passed; TypeScript passed; production Vite build passed.
- Original E2E full run: 44 of 50 passed. Corrected header layout, selectors and fixture-specific test assumptions; targeted replay 20/21 with last header case separately retested successfully.
- Real-API scenarios: company switch/isolation, RBAC, asset mutations/history/archive, QR movement and audit, disposal, facility map/editor, warehouse, stocktake, report filters, six A4 print forms, locale, sidebar and mobile.
- Authorized visual matrix: 330/330 checks across 11 pages, RU/EN/GE, light/dark, and 360/390/768/1024/1440 px; 12/12 Playwright tests including auth setup. Durable evidence rerun on the final QA revision.
- Console sanity: 11 authorized routes free of JavaScript errors, Vue warnings, and invalid HTML patterns; PASS after repair.
- Extra E2E: manufacturer/model linkage to asset and company isolation; custom field create/archive/localization; profile wrong-password rejection; document template draft, publish, preview and company isolation; PASS.
- Durable evidence location: C:/deploy/inventory/deployment-state/qa-p1bc-visual-20261104/[locale]/[theme]/[width]/[route].png; per-route JSON in the same root (QA local only, not committed).
- The registry snapshot at 1024 px was manually reviewed after data loaded, showing 59 real QA rows and correct filters and pagination.

## QA changes
1. Keep company picker in the right header cluster on tablet/desktop without disrupting mobile layout.
2. Localize asset field types in rows and selection options on RU/EN/GE live switch.
3. Confirm discarding changed field definitions; do not prompt for unchanged industry catalog edits.
4. Scope E2E selectors after new reference sections introduced duplicate action labels.
5. Remove fixed-count test assumptions about stocktakes, warehouses and disposal records.
6. Extend authorized Playwright to profile, company settings, templates, custom field definitions, attributes and RBAC.
7. Add full route/theme/locale/viewport visual acceptance suite with data-load waits and configurable durable screenshot output.
8. Correct HTML input patterns for industry codes and organization document/asset prefixes under modern RegExp v-mode.
9. Send profile-updated listener only to the profile component, preventing Vue extraneous-listener warnings.
10. Add console warning/error and native input-pattern Playwright checks across every route; verify publish and cross-company isolation of document templates.

## Public TLS release gate
- Apache owns port 443 and the platform.itpmining.kz vhost currently uses C:/xampp/apache/conf/ssl.crt/cert.crt.
- That certificate has a matching wildcard SAN, is valid 2026-10-12 to 2027-04-26, but the file contains only one PEM block: the issuing R36 intermediate is missing.
- Sectigo DV R36 intermediate and R46 root were fetched for QA; OpenSSL verified the certificate chain.
- Candidate leaf+intermediate chain staged at C:/deploy/inventory/deployment-state/qa-platform-fullchain-candidate.pem; NOT activated.
- Do not disable TLS verification or reload a shared Apache host without coordinated checks for HRM/Portal/other applications.

## Release condition
P1-B/C has not been deployed. Merge a verified matching Frontend/Backend version only after full latest-SHA regression and public HTTPS validation. Record deployment SHAs, migrations 000013–000016, auth/RBAC, health, and rollback feasibility. Vite warns about a >500 KB entry chunk; consider route-level code splitting as later optimization.
