# ITP Inventory — техлид: контроль перед передачей команде

Дата 04.11.2026. Scope: Frontend PR #39 + Backend PR #21. Правки выполнялись только в изолированных Git worktree. Production Inventory r22/r11, Portal, HRM, ТОиР не модифицировались.

## Архитектурное ревью

- Подтвержден отдельный Laravel/Sanctum session contour, tenant memberships с 404/403/409 и выделенным PostgreSQL. Общие JWT/APP_KEY/сессии Portal не используются.
- Frontend modern/ является единственной текущей Vue 3/TS реализацией; корневой Vue 2 — история, удалять без отдельного change нельзя.
- Браузер загружает Registry eager, другие страницы через lazy routes. Базовый JS chunk сократился с 576 954 до 351 249 байт raw.
- Выделены FacilityNavigation и FacilityPlanCatalog, StocktakeDocumentsPanel. Большие страницы сохраняют роуты/права; API контракты не изменены.
- Иерархия объектов индексируется через Map вместо повторных сканирований; геометрия плана и распознавание UUID вынесены в типизированные чистые утилиты.
- Backend использует CompanyRole enum с fail-closed базовыми возможностями; миграции и API payload остались прежними.
- PHPUnit и CI теперь проверяют реальный database driver, PostgreSQL 16 тестируется отдельно от SQLite.

## Испытания и доказательства

| Gate | Статус |
| --- | --- |
| GitHub CI исходных PR #39/#21 | PASS: Vue CI, Playwright smoke, Laravel SQLite, PostgreSQL 16 demo |
| Локальный Frontend TypeScript / Vitest / build после разбиения | PASS, 109/109 unit (включая тесты компонентов), TypeScript и production build |
| Повторный browser smoke после разбиения | PASS: 31/31, 3 языка, две темы и мобильные разрешения в сценариях |
| PostgreSQL 16 миграции на независимом loopback | PASS 20/20 |
| 10k синтетических активов, 2 tenants | PASS: 9000/1000 |
| pgbench read-only 20 clients × 4 threads × 12 сек | PASS: 14 251 транзакция, 0 ошибок, avg 16,534 мс |
| pg_dump/pg_restore в новую тестовую БД | PASS: 10 000 активов, миграции и checksum совпали |
| Проверка private QA secrets в Git | Артефакты/пароли не добавлялись; проверить git diff перед merge |
| Независимый человеческий code review | НЕ ПОДПИСАН; GitHub reviews отсутствуют |
| HTTP API throughput p95/p99 и 20 авторизованных пользователей | НЕ ПРОВОДИЛОСЬ; SQL pgbench не подменяет E2E |
| Настоящий production RPO/RTO из обезличенного backup | НЕ ПОДПИСАН; тестовый restore не заменяет production DR |
| Единая UI-библиотека для трех продуктов | BLOCKED на совместимости @itpmining/vue-basic-components 0.9.0 |

## Подтвержденный UI blocker

У Portal package 0.9.0 export ./style.css указывает на отсутствующий dist/style.css; Vue 3.4 и Pinia 2 заведены зависимостями, Inventory использует Vue 3.5 и Pinia 3. Не устанавливать существующий пакет в Inventory без исправления, peerDependency и consumer regression. См. SHARED-UI-COMPATIBILITY.md.

## Решение техлида

Готово к **командному review и дальнейшей разработке**, но не к подписи промышленной эксплуатации только на основании этого отчета. До merge/release необходимо добиться CI на финальных SHA, независимого ревью, согласованной проверки API concurrency и назначить владельца production backup/restore. При необходимости разделить большой PR на меньшие без потери артефактов. Изменять Portal/HRM ради унификации в рамках этой задачи запрещено.
