# Inventory Vue 3 foundation

Isolated modernization workspace. The production Vue 2 source at repository root is deliberately preserved.

Run `npm install`, `npm run typecheck`, `npm run build` in `modern/`. Default deployment base `/inventory/` is configurable via `VITE_APP_BASE_PATH`.

This first commit only validates the Vue 3 + TypeScript + Vite foundation. It does **not** implement HRM UI parity, authentication, working asset CRUD, or a Laravel API; production data is intentionally not mocked.

Next: extract independent BaseButton/BaseCard/BaseDataTable primitives from HRM with tests, add session-bound API client, and port Inventory screens incrementally. Do not deploy to platform production until Laravel backend and auth acceptance pass.
