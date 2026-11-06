# Сравнение архитектуры Inventory и корпоративного Portal

Основание: чтение исходников Portal frontend/backend на Windows QA 04.11.2026, каталог portal-mail-frontend-20261103 и portal-mail-backend-20261103. Portal **не модифицирован**. README Portal частично устарел; сравнивать по package.json/composer.json/src, не по общим описаниям.

| Аспект | Inventory | Portal | Решение для Inventory |
| --- | --- | --- | --- |
| Frontend | Vue 3, TypeScript, Vite 7, Pinia 3 | Vue 3, JavaScript, Vite 6, Pinia 2 | Сохранять TS и строгую типизацию, не откатывать версии |
| UI | Локальные HRM-подобные Base* компоненты | @itpmining/vue-basic-components + модульные компоненты | Общее API и токены — ориентир; прямое копирование не требуется |
| HTTP | Типизированный same-origin fetch, /inventory-api | Axios, interceptor, /api, user/customer context | Держать единый клиент и явные ошибки, не смешивать cookies |
| Backend | Laravel 12, Sanctum, бизнес-домен Inventory | Laravel 12, Sanctum, JWT, Spatie Permission | Отдельный контур IAM; авторизацию нельзя объединять копированием |
| Модель прав | Membership по компании и 3 роли | Многоуровневые permissions/modules/entitlements | Оставить узкий проверяемый RBAC; расширять через ADR |
| Данные | PostgreSQL Inventory, tenant-scoped связи | База Portal с Customer/Document/Task/etc | Не создавать cross-DB join или общие таблицы |
| Аудит | asset_events, membership/stocktake/disposal события | PortalAudit и предметные событийные сущности | Единый принцип audit actor+tenant+before/after |
| Документы | Приватные вложения к списанию/инвентаризации, шаблоны | Обширный private storage, реестры, проекты | Переиспользовать паттерны доступа и хранения, но не сами пути/ключи |
| Реалтайм | Нет обязательного realtime | Reverb, Echo, Push | Не подключать Reverb без бизнес-потребности |
| Тестирование | PHPUnit, Vitest, Playwright, PostgreSQL CI rehearsal | PHPunit, модульные проверки/QA | Привести к одинаковым release gates |
| Сервисная поставка | Отдельные Frontend/Backend/DB/junction/services | Совместное размещение на платформе, собственные службы | Единая эксплуатационная дисциплина, независимые деплои |

Статический анализ: Inventory frontend 72 source-файла / 11 765 строк; backend 82 / 7 202. Portal frontend 415 / 37 917; backend 399 / 29 028. Это **объемы исходного кода**, не метрики качества. Нельзя переносить сложность Portal в меньший продукт без необходимости.

## Что унифицировать между продуктами

- Терминологию и схемы имён компонентов; общие размеры контролов, focus/keyboard, темизацию и RU/EN/GE.
- Git flow: main защищен, малая ветка/PR/review, независимые FE/BE, повторяемые CI и релизный manifest с SHA.
- Принципы безопасности: tenant isolation, запрет доступа к private files по угадываемому URL, аудит изменений, централизованные response/error-коды.
- Runbook поддержки: health, службы, логи, связь X-Request-ID с запросом, база, оперативный откат.
- Контракт интеграции через версионированный API и feature flags вместо прямого доступа к БД Portal.

## Что не переносить

JWT и личные сессии Portal, таблицы Customer/User, Storage/Folders, очередь и Reverb без сценария; не использовать единые env/APP_KEY/CSRF/cookie или общие фоновые задания. Разные релизные циклы — преимущество, не дефект.

## Приоритеты архитектуры

P0: однозначный README, deploy/rollback, стандартизированный контроль тестов и PostgreSQL, багфиксы без изменения поведения.
P1: извлечение крупных страниц, schema/validation contracts, shared UI primitives только после версии и обратной совместимости.
P2: SSO/ERP/Portal интеграция через отдельные ADR и безопасный внешний API, при обязательной обратной совместимости.
