# ITP Inventory — Frontend (актуальная версия)

**Внимание:** рабочая система написана на **Vue 3 + TypeScript** и находится в каталоге **modern/**. Корневой каталог src/ — **исторический Vue 2 frontend**; его сборка и mock-режим не относятся к действующему приложению. Не используйте корневые команды npm run serve/build для разработки или публикации Inventory.

## Назначение

Учет имущества нескольких компаний: реестр активов, объекты/этажи/помещения и интерактивные планы, материально ответственные, складской учет, инвентаризации, списание, QR, отчеты, отраслевые справочники, карточки с настраиваемыми полями, настройки компании, роли и личный кабинет.

- Рабочий URL: https://platform.itpmining.kz/inventory/
- API этого продукта: /inventory-api/api/v1/
- Frontend: Vue 3, Vite 7, TypeScript, Pinia 3, Vue Router 4
- Backend: Laravel 12, Sanctum, независимая PostgreSQL база
- Сессии, CSRF, файлы и права **не** общие с Portal/HRM.

## Как начать работу

~~~powershell
git clone https://github.com/sh-ansar/itp-inventory-frontend.git
cd itp-inventory-frontend\modern
node --version
npm ci
npm run typecheck
npm run test:unit
npm run build
~~~

Для локального UI необходим отдельный тестовый Inventory Backend; Vite проксирует /inventory-api к переменной INVENTORY_LOCAL_API_TARGET (по умолчанию 127.0.0.1:18090). Не направляйте локальные тесты на production API. Для Vite используйте base /inventory/.

Для авторизованных E2E используйте только локальную синтетическую базу и сгенерированную в ней тестовую учетную запись. Подробности в modern/README.md и docs/QA-HANDOFF.md.

## Что читать дальше

- **docs/ARCHITECTURE.md** — структура Vue, маршруты, компоненты, загрузка модулей, ответственность.
- **docs/PORTAL-COMPARISON.md** — сравнение с реальной архитектурой корпоративного Portal.
- **docs/inventory-deployment.md** — выпуск, маршрутизация Apache/Windows, откат и health.
- **docs/QA-HANDOFF.md** — результаты проверок, ограничения, воспроизводимый чеклист.
- **docs/MAINTENANCE-REVIEW-20261104.md** — техлид-ревью, P0/P1 статус и остаточные release gates.
- **docs/SHARED-UI-COMPATIBILITY.md** — совместимость компонентов HRM/Portal и блокеры UI-kit v0.9.0.
- **docs/inventory-user-guide.md** — пользовательские сценарии; проверяйте соответствие релизу.
- **Backend README и docs/** — API, роли, схема данных, миграции, поддержка, восстановление.

## Работа команды

Основная ветка main; все изменения — в отдельных feature/* ветках через PR/review и CI. Корневой Vue 2 оставлен только для истории; не добавляйте в него новый функционал. Не добавляйте секреты, БД, тестовые storageState, ZIP вложения и собранный dist в Git. Frontend и Backend выпускаются независимо; текущие SHA активных релизов оператор **проверяет на сервере**, а не получает из hardcoded README.

Подробная документация: https://github.com/sh-ansar/itp-inventory-backend
