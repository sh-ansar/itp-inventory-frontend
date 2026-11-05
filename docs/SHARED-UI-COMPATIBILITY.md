# Shared UI contract — Inventory / HRM / Portal

Проверено 04.11.2026 по реальным package.json и компонентам. Рабочие Portal/HRM не модифицировались.

## Архитектурная матрица

| Аспект | Inventory modern/ | Корпоративный Portal | Решение |
| --- | --- | --- | --- |
| Vue | Vue 3.5, TypeScript | Vue 3.4, JavaScript | Vue peerDependency для общего пакета |
| Pinia | 3.x | 2.x | UI не должен импортировать чужой global store |
| Формы | BaseSelect, BaseMultiSelect, BaseDropdownSelect | @itpmining/vue-basic-components 0.9.0 | Сначала контракт props/events и тесты |
| Таблицы | BaseDataTable, BasePagination | Таблицы + shared lib | Единые sort/empty/loading/selection |
| Навигация | HRM-подобный локальный Sidebar | Собственная бизнес-навигация Portal | Общие токены, не общий Router |
| Локализация | RU/EN/GE и dark/light | Portal locale/store | Язык через props/provider без singleton |

## Выявленный блокер совместимости пакета 0.9.0

Установленный в QA Portal пакет @itpmining/vue-basic-components@0.9.0 экспортирует ./style.css как ./dist/style.css, но файл dist/style.css **отсутствует** в установленном пакете. Vue ^3.4.21 и Pinia ^2.1.7 заявлены как dependencies вместо peerDependencies; это может привести к разным экземплярам Vue/Pinia при использовании Inventory Pinia 3. GitHub Packages требует отдельной package read авторизации в CI. Прямое подключение v0.9.0 в Inventory без исправления blocked.

## Целевой контракт версии 1.0

- Button: variant, size, disabled, loading, type, title, click. Единые высоты и focus.
- Select и MultiSelect: modelValue, options {value,label,disabled?}[], multiple, searchable, placeholder, aria-label; update:modelValue/change; keyboard/Esc/Tab.
- Table: rows, columns, rowKey, loading, emptyTitle, sortKey, sortDirection, selectedKeys и update:selectedKeys. Пагинация/фильтры остаются у вызывающего экрана.
- Dialog: open, title, close/confirm, focus trap, restoration focus, keyboard и mobile.
- Нейтральные CSS переменные вместо hardcoded Portal themes. Тексты RU/EN/GE передаются из экрана.

## Этапы принятия общего UI

1. Исправить в itpmining/vue_basic_components экспорт CSS и dependencies, добавить .d.ts, Storybook contract tests.
2. Опубликовать версионированную сборку 1.0.0 через GitHub Packages с secret-only auth.
3. Запустить независимый consumer playground Vue3+TS+Pinia3: 360/390/768/1440, RU/EN/GE, light/dark и accessibility.
4. Подключать Inventory по одному адаптеру BaseButton/BaseSelect с обратной совместимостью и полноценным smoke.
5. После проверки только отдельные PR для HRM и Portal, без одновременного деплоя.

**Сегодняшнее решение:** сохраняем локальные Inventory Base* компоненты и оформляем единый контракт дизайна. Это закрывает архитектурную подготовку, не означает внедрение общей библиотеки во все приложения.
