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
