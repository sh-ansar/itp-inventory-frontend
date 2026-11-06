# ITP Inventory — Runbook выпуска Frontend/Backend (Windows + Apache)

**Контрольный снимок:** на 04.11.2026 опубликованы FE r22 / BE r11. Это НЕ цель будущих релизов и не подставляется автоматически в команды. Источник правды о текущей версии: фактические Windows junction + manifest релиза + SHA объединенного main.

## 1. Схема поставки

HTTPS https://platform.itpmining.kz
→ /inventory/ → C:\deploy\inventory\site\current (immutable FE release)
→ /inventory-api/ → отдельная HTTP/FastCGI служба Laravel → C:\deploy\inventory\backend\current → независимая Inventory PostgreSQL база

Директории:
- C:\deploy\inventory\site\releases\ — отдельные неизменяемые frontend releases.
- C:\deploy\inventory\backend\releases\ — отдельные неизменяемые backend releases.
- C:\deploy\inventory\site\current и backend\current — junction на активный release.
- C:\deploy\inventory\shared\storage — постоянное приватное storage Laravel.
- C:\deploy\inventory\deployment-state\ — manifest/sha/операционные логи; хранить с ограниченными ACL.
- C:\deploy\inventory\httpd-isolated\ — маршрутизация Inventory для общего Apache.

Windows службы: ITP-INVENTORY-HTTP, ITP-INVENTORY-FastCGI. Apache является общим frontend для других продуктов; никогда не перезаписывайте общий конфиг, сертификаты или маршруты без согласованного change.

## 2. Разработка / локальный QA

Минимум: Node 24, npm, PHP 8.4 (Laravel 12), Composer 2, расширения pdo_pgsql/pdo_sqlite/mbstring/xml/fileinfo/gd, PostgreSQL 16 или отдельный SQLite для автоматизированного QA. Отдельная Inventory база и .env. Запуск на 127.0.0.1, не связывать с prod.

Backend:
~~~powershell
cd <inventory-backend>
composer install
Copy-Item .env.example .env
# Для локального QA: APP_ENV=local, DB_CONNECTION=sqlite, DB_DATABASE=<isolated-local-file>,
# SESSION_SECURE_COOKIE=false, MAIL_MAILER=log; отдельный новый APP_KEY.
php artisan key:generate
php artisan migrate --force
php artisan db:seed --class=LocalDevelopmentSeeder
php artisan serve --host=127.0.0.1 --port=18090
~~~

LocalDevelopmentSeeder **принудительно отказывает** вне APP_ENV=local + SQLite; пароль QA сохраняет в приватном gitignored-файле storage/app/private/local-inventory-qa.secret. Никогда не запускайте его в production.

Frontend:
~~~powershell
cd <inventory-frontend>\modern
npm ci
npm run typecheck
npm run test:unit
$env:INVENTORY_LOCAL_API_TARGET="http://127.0.0.1:18090"
npm run dev -- --host 127.0.0.1 --port 5174
~~~

В отдельном терминале выполнить npm run build; результаты modern/dist. Не используйте корневое legacy Vue 2 приложение.

## 3. Preflight промышленного релиза

1. Только reviewed PR и зафиксированные FE/BE merge SHA в GitHub main. Никаких прямых коммитов в main и изменений working directory production.
2. CI green: FE typecheck/unit/build + Playwright smoke; BE PHPUnit + PostgreSQL 16 checks. Для прав/данных выполнить авторизованный Playwright на изолированном QA.
3. Согласовать миграции (DDL, data impact, индексы, locks), ограничить доступ по времени change. Сделать проверяемый PostgreSQL backup + отдельный restore rehearsal. Документировать проверку контрольной суммы backup.
4. Новые backend и frontend releases собирать в staging, **без** замены current. Production .env/APP_KEY и private storage не копировать в repo, QA и пользовательские скриншоты.
5. Проверить Apache rewrite для /inventory/ deep-link, API proxy, валидную TLS цепочку, session cookie/XSRF и точные пути. Проверить, что отсутствуют конфликты с /hrm/, /mro/ и корнем Portal.
6. Сверить SHA256 frontend index/assets и backend composer.lock, содержимое bootstrap/cache, доступность vendor/autoload, права NTFS к storage, ожидаемые активные junction.
7. На backend кандидате выполнить php artisan migrate:status и php artisan migrate --pretend. Изменения схемы применять **один раз** лишь после preflight и backup/restore gate.
8. Использовать проверенный per-release скрипт с явными expected-old и expected-new target, SHA и rollback path. Никакой повторной команды старого r19/r22 с зашитыми путями.
9. Переключить только Inventory службы и junction; другие приложения и их Apache vhosts не трогать. Валидация index фактически ссылается на новые JS/CSS, а не только HTTP 200.

## 4. После выпуска

Прогнать:
- GET /inventory/ и его CSS/JS с фактическим SHA из manifest;
- GET /inventory-api/api/v1/health → 200; GET /inventory-api/api/v1/me без сессии → 401;
- авторизованный login + /api/v1/me + список компаний, смена компании, список активов;
- доступ admin/manager/viewer, запрет чужой компании, CSRF 419, повторную загрузку раздела;
- /hrm/, /mro/, корень Portal, ETP и другие критичные адреса без изменений;
- журналы Laravel, Inventory HTTP/FastCGI, отсутствие новых 500.

Релиз не считается выполненным без evidence: оба SHA, UTC+локальное время, миграции Ran, service status, backup ID, хеши assets, 401/200, ссылки на тесты, previous/current pointers.

## 5. Откат и восстановление

- При отказе post-check **возвратить только Inventory junction** на ранее подтвержденные релизы и перезапустить **только Inventory службы**. Не удалять старые releases и не менять shared storage.
- При уже примененных ADDITIVE миграциях откат кода **не означает** откат схемы; убедиться в обратной совместимости r(N-1) либо использовать согласованный план восстановления БД с владельцем данных. НЕ запускать автоматически migrate:rollback на боевой БД.
- Если затронуты данные, оповестить владельца и применять восстановление из проверенного бэкапа по отдельному DR-процессу. Все действия отражать в incident/release журнале.
- Проверить сразу оба компонента Inventory и соседние сайты, не считать наличие работающего Apache доказательством работы Inventory.

## 6. Секреты и правила

APP_KEY, DB_PASSWORD, SMTP, ключи интеграций, cookie и storageState не печатать в логи и не коммитить. Смена ключей и TLS-сертификатов проводится отдельным change с проверкой сессий/шифрования; автоматическое key:generate на уже развернутой БД запрещено.

Авторитетная документация Backend (схема БД, сервисы, миграции и DR):
https://github.com/sh-ansar/itp-inventory-backend/tree/main/docs
