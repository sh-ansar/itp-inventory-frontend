# Shared UI integration — reserve candidate

Package: 0.10.0-reserve.3, exact vendored tarball; not published. SHA-256 is recorded in package.json in this directory.

Connected SiteHeader, SiteFooter, SiteLegalContent; retained API loading, localization and product routes. Base UI adapters are listed in current-imports.json. Inventory uses modern/ Vue 3; its initial router readiness redirect was corrected. HRM/MRO BaseFormField now uses shared FormField/TextInput.

Validation: independent build; existing relevant regression suites; public browser checks at 320,375,768,1024,1440,1920. public-qa.json is public smoke only, NOT business acceptance. Missing test API blocks real pricing/legal contents and authenticated workflows; HRM login capability unavailable in this preview. AppSidebar/AppTopbar, DataTable, calendar and advanced product widgets still need migration and authenticated visual QA. Do not merge main or deploy to production on this evidence.

Preview is loopback-only on its build host. Public screenshot artifacts remain in screenshots/ and are intentionally not committed. No production environment files are included.
