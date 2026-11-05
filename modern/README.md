# Inventory Frontend — modern/

**Единственный актуальный frontend приложения.** Корень репозитория содержит сохраненную legacy Vue 2-сборку. Не редактировать ее для действующей системы.

## Команды

~~~powershell
npm ci
npm run typecheck
npm run test:unit
npm run build
npm run dev -- --host 127.0.0.1 --port 5174
~~~

Актуальная версия CI использует Node.js 24. Изолированный Laravel API запускается отдельно, например на 127.0.0.1:18090. Настройка прокси осуществляется переменной INVENTORY_LOCAL_API_TARGET перед запуском Vite; публичная точка API — /inventory-api. BASE_URL сборки — /inventory/.

## Карта исходников

- src/pages — экраны бизнес-модулей.
- src/router — пути, имена и асинхронная загрузка страниц (registry загружается сразу).
- src/api/client.ts — единственный HTTP клиент, same-origin cookie, XSRF, коды ошибок.
- src/api/* — типизированные контракты по функционалу.
- src/components/ui — HRM-совместимые изолированные компоненты. Не копируйте компоненты Portal непосредственно в production.
- src/components/registry, facilities, stocktakes — формы и специализированные элементы.
- src/stores — состояние UI, язык/тема/навигация.
- src/composables — сохранение таблиц, фильтров и прочее повторное поведение.
- src/i18n.ts и файлы переводов — RU/EN/GE.
- tests/unit, tests/e2e, tests/smoke — уровни тестирования.

## Работа с маршрутом

Изменение path/name требует проверки внутренних RouterLink, deep-link /inventory/..., API параметров и E2E. Не заменяйте асинхронные импорты страниц на массовые eager-импорты без performance-профиля. Заголовки, права и компания проверяются на сервере; скрытая кнопка **не** является авторизацией.

## Безопасность

Не переносить JWT, токены или общие session cookies из Portal. Вся запись в Inventory идет через same-origin /inventory-api; mutating запросы требуют INVENTORY-XSRF-TOKEN. User input, HTML документов, вложения и QR проверяются на Backend. Тесты с реальными данными и production API запрещены.

См. ../docs/ARCHITECTURE.md, ../docs/inventory-deployment.md и ../docs/QA-HANDOFF.md.


## Публичная зона, тарифы и супер-админка (05.11.2026)

- src/Root.vue разделяет оболочки: публичные страницы (лендинг, тарифы, юридические документы, вход/регистрация), защищённый супер-администратор и прежний приватный Inventory.
- /inventory/ — публичная главная страница в стиле Portal; /inventory/registry — существующий реестр имущества. Прочие прежние маршруты не удалены.
- src/pages/public/ — страницы главной, тарифов, юридических документов, входа и продуктовых модулей.
- src/pages/PlatformAdminPage.vue — UI супер-админки; src/components/commercial/AdminGate.vue — проверка сессии и полномочий до показа интерфейса; API выполняет независимую проверку прав.
- src/pages/CompanyBillingPage.vue — подписка, счета, доказательства оплаты и согласия текущей компании.
- src/components/commercial — общий публичный хедер/футер, редакторы тарифов/счетов/документов и диалоги; src/styles/commercial.css задаёт отдельный визуальный слой без изменений tokens.css.
- src/commercialTranslations.ts хранит RU, EN и GE тексты; в UI используется locale ka, в коммерческом API тарифы и юридические документы используют ge. Согласованное преобразование делается только на границе.
- API-клиент src/api/commercial.ts обращается исключительно к /inventory-api того же происхождения, не читает Portal cookies или секреты.
- Юридический документ загружается по ID опубликованной версии отдельно от публичного списка, который намеренно не выдаёт body.

Проверки: npm run build, npm run test:unit, npm run test:e2e -- tests/e2e/commercial-public.spec.ts с INVENTORY_E2E_BASE_URL=http://127.0.0.1:5177/inventory/. E2E с мокированными ответами проверяют UI и роли, но не заменяют интеграционные Laravel/PostgreSQL тесты.

Публикация осуществляется только одновременно с соответствующим Inventory Backend (миграция 2026_11_05_000017_commercial_platform), потому что лендинг использует публичные /commercial/plans и /commercial/legal. Не включать коммерческие флаги в prod до подтверждения действующих тарифов, юридических текстов, SMTP, PHP 8.4 и tenant/role QA. Подробные матрица, ограничения и шаги: Backend docs/commercial/README.md.

## Site CMS and localized plan descriptions — 2026-11-05
The Inventory-only super-admin has an editable Site section at /inventory/admin/site. Authorized users can edit 20 plain-text landing and pricing labels separately for ru/en/ge. PublicLayout loads current locale values from commercial/site-content; built-in translations remain the fallback. Site edits become visible without rebuilding the application. The public landing does not access the admin endpoint.
PlanEditor supports localized names and descriptions per ru/en/ge, modules, price, company/user/storage/file limits. Public zero-price prototype plans display "On request", not "Free"; actual pricing can be changed by publishing new plan versions. Paid onboarding, legal publication and invoice issuance remain feature-gated until their separate approvals.
QA: npm run build; npm run test:unit; npm run test:e2e -- tests/e2e/commercial-site-content.spec.ts. Browser mocks do not replace a real authenticated PostgreSQL environment test.
