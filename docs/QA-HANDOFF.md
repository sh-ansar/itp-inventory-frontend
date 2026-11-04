# ITP Inventory — QA / чеклист передачи

Фактическая полная QA-проверка 04.11.2026 проходила на независимой SQLite базе, локальных Inventory портах и синтетических пользователях. Production не изменялся этими QA-тестами.

## Подтвержденное состояние на 04.11.2026

| Область | Результат |
| --- | --- |
| Laravel migrations в новой QA базе | 20/20 |
| Backend PHPUnit до refactor | 92/92, 1416 assertions |
| Vue unit до оптимизации маршрутов | 83/83 |
| Анонимные API/auth маршруты | 110/110, включая 103 auth и 5 выключенных внешних |
| Авторизованные GET API | 49/49 |
| E2E бизнес-процессы | 57/58 в первом проходе, затем повтор выявленного сценария PASS |
| Дополнительные проверки RBAC / tenant / logout | 3/3 |
| Визуальная матрица | 330/330: 11 страниц × RU/EN/GE × светлая/тёмная × 360/390/768/1024/1440 |
| Сравнение активных prod junction | не изменены тестовым контуром |

Evidence на авторизованном Windows сервере:
C:\deploy\inventory\deployment-state\inventory-fullqa-20261104-report.md
C:\deploy\inventory\deployment-state\inventory-fullqa-20261104-visual-evidence.zip

В дополнительном password-rotation сценарии первый переход и вход с новым паролем подтвердились, но возврат к старому QA-паролю завершился 422 из-за политики сложности. Не считать полный rotate-and-restore тест пройденным; для воспроизведения брать отдельный синтетический пароль, соответствующий политике с обеих сторон.

## Ежедневная CI / reviewer проверка

Frontend: npm ci, npm run typecheck, npm run test:unit, npm run build и Playwright smoke. Полный авторизованный E2E требует отдельной local-only QA-БД и синтетического пароля, не CI секретов production.

Backend: composer install и php artisan test на SQLite in-memory, затем PostgreSQL 16 regression. Прямая проверка RBAC обязана проверять 401 (гость), 403 (нет роли), 404 (чужая компания), 409 (конфликт версий), 419 (CSRF) и отсутствие раскрытия данных.

## Матрица основной приёмки

Реестр: CRUD, поиск/фильтры, export/QR, хронология и архив.
Facility: дерево объект→этаж→помещение, фон плана, элементы, сохранение.
People: МОЛ и назначение/массовые изменения.
Warehouse: приход/выдача, единицы измерения, баланс и история.
Stocktake: снимок, QR, подсчет, повторная проверка, завершение, отчет.
Disposal: жизненный цикл заявки и подтверждение, акт, аудит.
Catalogs: базовые и company-specific типы, единицы, производители, модели, custom attributes.
Company: выбор tenant, настройки, шаблоны, роли и запрет на изменение вне прав.
Profile: изменение имени, неверный/верный пароль, logout.
Mobile: ширины, keyboard, focus, scroll, sticky header/sidebar, tables.

## Важные пределы доказательств

SQLite QA не моделирует PostgreSQL locking, многопользовательскую нагрузку, filesystem ACL и резервное восстановление. 330 снимков подтверждают rendering/viewport/JS, а не все комбинации интерактивных состояний. Внешние ERP/1C-интеграции выключены — их готовность не утверждать.

## При добавлении функции

1. Обновить Backend API и тесты ролей/tenant.
2. Обновить типы src/api и Vue UI-компоненты; RU/EN/GE, обе темы, disabled/empty/error.
3. Добавить unit-тесты и один авторизованный Playwright happy path + forbidden path.
4. Прогнать CI и локальный PostgreSQL rehearsal при изменениях схемы/ограничений.
5. Обновить docs/ и release notes с rollback и observability.
