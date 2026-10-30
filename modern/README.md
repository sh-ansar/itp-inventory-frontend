# ITP Inventory - Vue 3 frontend

The root of this repository contains the preserved legacy Vue 2 application. The modern/ directory is the isolated Vue 3 + TypeScript + Vite 7 migration. Never overwrite the root or deploy inside the production Portal dist.

## Implemented in this vertical slice

- Independent Inventory login (no Portal SSO), same-origin /inventory-api/ root, isolated XSRF cookie.
- Company picker with tenant isolation. Viewer/admin/manager backend roles.
- Server-side search, filter, sort and pagination for the asset register.
- Create/edit assets, optimistic version locking, admin-only soft archive with reason, audit events.
- Company-specific categories, accounting and physical locations.
- Printable QR labels generated locally (no external QR API); the public UUID link resolves under the authenticated company only.
- Physical movements with destination, reason, version conflict protection and immutable actor/location history; Viewer remains read-only.
- HRM-derived UI: BaseButton, BaseCard, BaseStatusPill, BaseLoadingState, BaseDialog, adapted BaseDataTable/Pagination/Search and semantic tokens.
- RU/EN/GE translations, responsive layout and light/dark themes.

## Local development

1. npm ci
2. npm run typecheck && npm run test:unit && npm run build
3. Start isolated Laravel backend bound to 127.0.0.1:18090 with local database and local-only authentication enabled.
4. npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
5. Open http://127.0.0.1:5174/inventory/; Vite proxies /inventory-api/ to Laravel.

Optional Playwright E2E: set INVENTORY_QA_SECRET_FILE to the local gitignored synthetic-only QA secret file path, install Chromium headless (npx playwright install chromium --only-shell) and run npm run test:e2e. auth.setup.ts signs in the synthetic admin and viewer once per suite and saves browser storageState only under ignored test-results/.auth; regular tests reuse these sessions to avoid hitting the login throttle. If repeat runs exhaust the throttle, clear the **isolated local Inventory QA cache only**, never Portal/HRM. Never print/commit login secrets or generated browser states.

## Known release blockers

- Backend GitHub repository needs provisioning; isolated PostgreSQL and PHP services need staging integration.
- HTTPS, auth CSRF/session, multi-company cross-tenant, mobile/tablet, backups, rollback and concurrent writes require acceptance.
- Inventory stocktakes, accounting transfer approvals, in-app camera decoding, bulk QR printing, responsible persons from HRM, 1C sync, attachments, Excel and real legacy inventory data migration remain out of scope for this slice.
- Do not merge or deploy until these gates pass. Existing production Portal/HRM must stay untouched.