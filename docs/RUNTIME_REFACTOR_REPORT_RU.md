# Рефакторинг runtime SDK и проверка трёх игр

Дата: 10 ноября 2026 года.

## Результат и рабочая копия

Основной runtime-рефакторинг по находкам архитектурного аудита реализован в отдельном worktree.
Three/hybrid уже находился в `main`; повторное слияние экспериментальной ветки не выполнялось.

- Основа: `origin/main`, commit `139bee4`.
- Ветка: `codex/runtime-architecture-refactor`.
- Worktree: `/Users/alexandr/.codex/worktrees/sdk-runtime-refactor/sdk`.
- Runtime и regression tests: commit `0932d1b`.
- Миграционные инструкции сохранены в ветке; game-specific patches — в локальных validation artifacts.
- Проверенные пакеты: engine `0.0.13-refactor.1`, tooling `0.2.2-refactor.1`.
- Merge, push и npm publication не выполнялись. Пакеты остаются приватными локальными сборками.
- Разработка редактора, React/Electron и новый формат сцен не добавлялись.

Это проверяемый результат конкретного рефакторинга, а не утверждение об отсутствии любых возможных ошибок.

## Что изменено

### Границы рендереров и модулей

`RendererModule` использует `DiContainerInterface`. Контракты создания layout и input hit testing
выделены в узкие capabilities; input больше не требует полного renderer runtime.
Общий runtime не выбирает Pixi/Three за потребителя.

Matter больше не регистрируется как побочный эффект подключения Pixi. Добавлены явный
`MatterPhysicsModule`, `EngineModule` и renderer-neutral `PhysicsServices.Manager`.
При ошибке регистрации уже подключённые модули освобождаются в обратном порядке.
Cannon остаётся отдельным модулем игры; искусственная общая физическая модель не вводилась.

В общий SDK перенесены реально необходимые Rings `PixiThreeTextureRendererModule` и
`ThreeTextureSurface`: отличающийся от hybrid с двумя canvas способ отрисовки Three в Pixi texture.
Поверхностью владеет компонент; она освобождает свой renderer и texture, но не чужие GLB leases.

### Владение ресурсами, lifecycle и ошибки

Добавлен `DisposalScope`: сигнал отмены, синхронные disposers, обратный порядок освобождения,
повторный безопасный dispose, сбор ошибок, немедленное освобождение поздней регистрации.
Components/actions получили owner-bound `ownDisposer` и `scopeSignal`.

Engine lifecycle отменяет ожидание незавершённой инициализации/запуска. Boot pipeline
останавливает следующие задачи при отмене. Поздняя инициализация Pixi/platform не воскрешает
уничтоженный runtime. Frame driver и EventBus освобождают подписчиков при destroy.

Scene contexts и service contexts получили lifetime signal. Он истекает при ошибке, timeout,
выходе и уничтожении manager. SDK проверяет продолжение после собственных async boundaries.
Ошибка exit не оставляет уже закрытую сцену на стеке. Pop восстанавливает предыдущие bindings
даже после ошибки cleanup. Lifecycle scheduler выполняет rollback частичного enter и продолжает
cleanup остальных систем после исключения одного участника.

Ошибки EventBus, detached commands и FSM tick доступны через общий диагностический канал.
DI дополнительно обнаруживает циклы factory resolve и показывает цепочку tokens.
Существующее исправление singleton override сохранено: cache инвалидируется, но контейнер
не принимает на себя неявное владение ранее выданным внешним объектом.

### Assets

Добавлены `loadRequired(ids, {signal})`, строгий scene preload и сохранение исходных loader causes.
Best-effort `load`/`loadBundle` сохранены как отдельный осознанный контракт.

Политика retry/concurrency валидируется schema-first. Очередь ограничивает суммарную
конкурентность всех caller batches; single-flight разделяется между вызывающими сторонами.
Отмена одного waiter не уничтожает запрос другого. Destroy отменяет asset work; поздние
результаты timeout/abort освобождаются через loader disposer и не попадают в cache.

Добавлен явный `assets.unload(id)`: нельзя выгружать in-flight asset; отказ disposer из-за
живой lease сохраняет владение в cache. Автоматического освобождения всех ассетов при выходе
сцены нет: сцены, prefabs и preload могут разделять один ресурс.

### Persistence

Глобальный перенастраиваемый singleton заменён coordinator, принадлежащим экземпляру Engine.
Потребитель получает adapter через `engine.storage` / `SystemServices.PersistentStorage`.
Standalone adapters требуют явного coordinator.

Политики `platform-exclusive` и `mirror` описаны явно. Для существующих Rings и Hole Islands
в тестовых копиях установлен `mirror`, сохраняющий прежнюю семантику browser/platform saves.
Namespace и структура сохранений не переписывались. Bootstrap не заменяет более свежие
значения, записанные во время ожидания snapshot; неудачный bootstrap можно повторить.

### Presentation и диагностика

Добавлена финальная scheduler phase после physics/particles/tweens: `camera → world → ui`.
Внутри phase сохраняются numeric order и стабильный порядок подписки. Привязка к layout
останавливает callbacks покрытой сцены и возобновляет их после pop. Lifetime signal снимает
подписки. Component helper учитывает enabled/detach и регистрируется после готовности layout.

Диагностика предоставляет errors, raw/clamped frame delta, timings систем и render CPU.
Observers не могут нарушить выполнение runtime; SDK не хранит историю samples.
В копии Hole Islands удалена необходимость monkey patching renderer/service methods.
Эти timings не являются временем GPU execution или benchmark реального мобильного устройства.

### OOP и правила репозитория

Разделены файлы с несколькими runtime classes: registry, text-style catalogs, layout asset reader,
FSM lifecycle event bridge. Runtime helpers/defaults оформлены классами. Убраны оставшиеся
non-null assertions в затронутом input-контуре.

Добавлен архитектурный lint: синтаксис TypeScript, запрет exported runtime functions/const,
`any`, non-null assertions, нескольких classes в одном engine-файле и native renderer imports
в renderer-neutral подсистемах. Typecheck выполняется отдельно. CI и release validation
получили необходимые проверки runtime, renderer boundaries, stability и lint.

## Соответствие прежнему аудиту

| Находки | Состояние |
| --- | --- |
| A1–A3: service rollback, failure-tolerant node cleanup, async EventBus | Основные исправления уже были в main; сохранены и дополнены cancellation/diagnostics |
| A4–A5: timeout и Engine lifecycle | Добавлены owner signals, отмена ожидания и проверки поздних продолжений |
| A6: singleton override | Исправление main сохранено; добавлена диагностика DI cycles |
| A7: глобальный persistence owner и неоднозначная политика | Исправлено; миграция adapter и политики явная |
| A8: ранняя потеря asset errors | Исправлено строгим API и сохранением причины |
| A9: управление cache | Есть явная lease-safe eviction; автоматическая scene eviction намеренно не вводилась |
| A10: самодельная presentation queue | Перенесено в SDK, применено в Hole Islands |
| A11: инфраструктурные обходы consumer | Storage injection, strict model loads, diagnostics вместо monkey patching |
| A12: несколько независимых SDK snapshots | Проверены реальные tarballs одного commit, без source aliases |

## Проверка SDK

Последовательный итоговый прогон завершён успешно:

- `npm run typecheck`, `npm run build`, `npm run lint`.
- Engine unit/regression suite: **28/28**.
- `test:stability`: **13/13**.
- `test:renderers`: **17 сценариев**.
- Tooling tests: **14/14**.
- Resource cleanup, screen, audio activation/music, locales, CrazyGames, Playgama,
  archive dependency boundary и создание проекта из tooling.
- `test:local-package`: **core-only, Pixi-only, Three-only, hybrid**. Проверены реальные tarballs,
  strict declarations с `skipLibCheck=false`, optional peers и ожидаемый module graph.

В одном промежуточном прогоне пересеклись очистка dist при сборке и проверки пакетов.
Итоговые проверки запущены последовательно после завершения сборки; результаты выше относятся к ним.
Platform/audio unit fixtures не объявляются live portal или device QA.

## Проверка игр

Оригинальные рабочие каталоги игр содержали пользовательские изменения. Для проверки скопированы
фактические файлы, а необходимые миграции выполнены только в изолированных копиях:

`/Users/alexandr/.codex/worktrees/sdk-runtime-refactor/consumers/`

| Игра | Статика и сборка | Автоматические сценарии |
| --- | --- | --- |
| Rings 3D | typecheck, lint, build — успешно | Domain suite 21 тест; solver проверил все 100 уровней |
| AI Defender | rebuilt Cyber UI SDK adapter, typecheck, lint, build — успешно | 14 project check-команд, включая boot, hub, boss defeat, beams, plasma, balance |
| Hole Islands / three-game | typecheck, lint, build, typecheck:tests — успешно | 155/156: одна ранее существовавшая ошибка учёта media, описана ниже |

В Hole Islands engine исключён из game-local npm workspaces и заменён tarball; physics-cannon
оставлен отдельным workspace. Наличие скопированных старых файлов `packages/engine` не означает
их участие в сборке. Проверен установленный dependency graph: одна новая engine dependency и
общие renderer peers. У AI Defender адаптер Cyber UI пересобран под явный Pixi node contract.

[Описание миграций](consumer-migrations/README.md) сохранено в ветке. Source patches сохранены
локально в `artifacts/validation/consumer-migrations/` для review; игровой код не добавляется в публичную историю SDK. Dependency paths
на локальные tarballs и новые manifests описаны отдельно: blindly применять patch к другой
версии игры нельзя. Миграции в исходные репозитории и их публикация не выполнялись.

### Наблюдавшиеся браузерные сценарии

Проверка выполнена в реальном in-app browser с WebGL на локальных dev servers и итоговым tarball.

- Rings: загрузка, Three внутри Pixi texture, реакция на drag, timeout/retry.
  Отдельный alpha regression прошёл для opacity 1 и 0.35: overshoot 0, antialiased pixels 568/500.
- AI Defender: boot/tap, выбор агента и улучшений, бой, settings, победа `SECTOR SECURED`,
  переход к command center. Новый public texture-generation API используется реальной отрисовкой.
- Hole Islands: boot/tap, WASD, сбор объектов с уменьшением счётчика 36→34, settings и pause,
  изменение аудионастройки; отдельная реальная сцена level 9 с Cannon и Pixi UI.
  Destroy/remount восстановил сцену с двумя canvas; отсутствие оставшихся canvas между mounts
  проверяется самой QA entry point. Профилирование использует diagnostics subscription.

Длительный browser route уровня 9 завершился **WON, 572/572, 119.50 s** — с реальной физикой,
обычными FSM movement events и игровыми правилами. Затем через обычную кнопку Next level
успешно загрузился уровень 10 с новыми моделями и камерой; число canvas осталось 2.
Errors в console основной игры, AI Defender и campaign QA на этих сценариях не обнаружены.
После закрытия параллельного QA runtime проверено сохранение Music off через reload основной игры.
Сохранён экспорт игрового кадра и победного экрана. Это отдельные наблюдения browser QA;
цифры FPS из диагностической панели не используются как обещание производительности устройства.

## Известные ограничения и оставшиеся отдельные работы

1. **Hole Islands: существующий media test остаётся красным.**
   `tests/ui-settings.test.ts` сообщает `Unreferenced runtime media: images/loading/hole-islands-boot.webp`.
   Тот же конкретный тест воспроизведён в оригинальном `/projects/three-game` на прежнем SDK.
   Неиспользуемый пользовательский art-файл не удалялся ради зелёного результата.
2. Legacy `renderer-check.html` в исходном состоянии устарел: его scenes.map содержит одну сцену,
   а ProjectDi — все сцены кампании; запуск остановлен fail-fast диагностикой для `hole-02`.
   Его нельзя засчитывать успешным browser smoke. Для фактического hybrid использовался
   `campaign-check.html` с полной конфигурацией игры, для package isolation — отдельные fixtures SDK.
3. Проверены выбранные реальные сценарии, а не исчерпывающие прохождения всех кампаний, все браузеры,
   Android/iOS и live ads/storage на внешних порталах. Физические domain tests не заменяют browser QA.
4. Отмена cooperative: SDK не может принудительно остановить произвольный Promise или запретить
   пользовательскому hook выполнять собственный side effect после await. Для этого нужны signal/owner checks.
5. Engine-owned coordinators не предоставляют transaction isolation нескольким вкладкам с одинаковыми
   save keys. Namespace bootstrap и `StorageNamespace` должны быть согласованы потребителем;
   два одновременно открытых QA runtime одной игры могут перезаписать общий save своими snapshots.
6. IndexedDB writes остаются асинхронными за синхронным state-store API. Durable flush/transactions
   и автоматическое scene asset reference counting не добавлялись без отдельного нужного потребителя.
7. Широкий ECS/MVC/MVVM framework, универсальное объединение Cannon/Matter и перенос игровой логики
   в engine не нужны для этого рефакторинга. Instancing/effects остаются там, где ими владеет игра,
   пока не появится подтверждённый повторяемый renderer-neutral или Three-specific контракт.

## Подготовка к будущему редактору

Runtime boundaries, ресурсное владение и независимые renderer modules стали более явными.
Code-only разработка, исходные layouts/prefabs/configs и запуск игры без редактора сохранены.
Никаких Electron/React/editor dependencies в production runtime не появилось.

При этом **готовность runtime-основы не равна готовому authoring SDK**. Отдельный следующий этап:
controlled authoring session/edit policy без gameplay, provenance/dependency graph `$include`/extends/prefabs,
metadata редактируемых полей, обратимое сохранение source documents, picking/gizmo/editor camera,
управляемый preview компонентов. Эти editor-specific контракты нужно проектировать по первому
реальному editor slice; сейчас они не подменены абстракциями без потребителя.

## Артефакты и повторение

- Пакеты, checksums и commit: `artifacts/latest.json`.
- Проверка isolated packages: `artifacts/consumer-checks.json`.
- Локальные результаты команд и dependency graphs: `artifacts/validation/`.
- Кадр реальной hybrid-сцены: `artifacts/validation/hole-islands-level9.png`.
- Изменения API и действия при миграции: `packages/engine/MIGRATION_RUNTIME.md` и `MIGRATION_RENDERERS.md`.

`artifacts/` игнорируется Git. Эти локальные доказательства сохранены в worktree; source tests,
миграционная документация и данный отчёт сохранены в ветке. Game-specific patches остаются локальными. Для воспроизведения: установить
зависимости, последовательно выполнить build/typecheck/lint и перечисленные suites, затем
`npm run pack:local`, `npm run test:local-package` и обновить изолированные consumers точными tarballs.
