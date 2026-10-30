# ITP Inventory - Vue 3 frontend

The root of this repository contains the preserved legacy Vue 2 application. The modern/ directory is the isolated Vue 3 + TypeScript + Vite 7 migration. Never overwrite the root or deploy inside the production Portal dist.

## Implemented in this vertical slice

- Independent Inventory login (no Portal SSO), same-origin /inventory-api/ root, isolated XSRF cookie.
- Company picker with tenant isolation. Viewer/admin/manager backend roles.
- Server-side search, filter, sort and pagination for the asset register.
- Create/edit assets, optimistic version locking, admin-only soft archive with reason, audit events.
- Company-specific categories, accounting and physical locations.
- HRM-derived UI: BaseButton, BaseCard, BaseStatusPill, BaseLoadingState, BaseDialog, adapted BaseDataTable/Pagination/Search and semantic tokens.
- RU/EN/GE translations, responsive layout and light/dark themes.

## Local development

1. npm ci
2. npm run typecheck && npm run test:unit && npm run build
3. Start isolated Laravel backend bound to 127.0.0.1:18090 with local database and local-only authentication enabled.
4. npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
5. Open http://127.0.0.1:5174/inventory/; Vite proxies /inventory-api/ to Laravel.

Optional Playwright E2E: set INVENTORY_QA_SECRET_FILE to the local gitignored QA-only secret file path, install Chromium headless (npx playwright install chromium --only-shell) and run npm run test:e2e. Never print/commit test login secrets.

## Known release blockers

- Backend GitHub repository needs provisioning; isolated PostgreSQL and PHP services need staging integration.
- HTTPS, auth CSRF/session, multi-company cross-tenant, mobile/tablet, backups, rollback and concurrent writes require acceptance.
- Stocktakes, movements, QR generation/scanning, responsible persons from HRM, 1C sync, attachments, Excel and migration of legacy inventory data are not yet implemented.
- Do not merge or deploy until these gates pass. Existing production Portal/HRM must stay untouched.