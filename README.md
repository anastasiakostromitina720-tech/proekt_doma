node -v
npm -v# Proekt Doma

Веб-приложение для проектирования, реконструкции и дизайна домов: 2D-планировка, 3D-просмотр и AI-редизайн по фото.

Репозиторий содержит **foundation-скелет** + **auth module**: монорепо, NestJS + Prisma, Next.js 14 (App Router) + Tailwind + shadcn/ui, общий пакет контрактов с zod, docker-compose (Postgres + Redis + MinIO), и production-like authentication flow на httpOnly cookies.

На этом этапе **нет** 2D-редактора, 3D-просмотра и AI-редизайна — только архитектурная основа, auth, health-endpoint и CI.

---

## Структура

```
proekt_doma/
├── apps/
│   ├── api/         NestJS + Prisma + Pino + health
│   └── web/         Next.js 14 + Tailwind + shadcn/ui
├── packages/
│   └── contracts/   TypeScript-типы и zod-схемы (pre-compiled → dist)
├── .github/workflows/ci.yml
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

---

## Требования

- **Node.js** 20.11+
- **pnpm** 9+ (ставится автоматически через corepack)
- **Docker Desktop** / **Docker Engine** + **Docker Compose v2**

`npm` и `yarn` **заблокированы** preinstall-хуком. Используйте только `pnpm`.

---

## Быстрый старт

### 1. Включить pnpm через corepack

```bash
corepack enable
```

Это активирует версию pnpm, зафиксированную в `packageManager` корневого `package.json`.

### 2. Установить зависимости

```bash
pnpm install
```

`postinstall` в `apps/api` автоматически выполнит `prisma generate` — Prisma Client становится готов к использованию сразу.

### 3. Подготовить env-файлы

**macOS / Linux:**

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Дефолтные значения совпадают с настройками docker-compose и работают «из коробки».

### 4. Поднять инфраструктуру

```bash
pnpm docker:up
```

Что поднимется:

| Сервис   | Порт | Доступ                                               |
| -------- | ---- | ---------------------------------------------------- |
| Postgres | 5432 | `proekt / proekt`, БД `proekt_doma`                  |
| Redis    | 6379 | —                                                    |
| MinIO    | 9000 | API (`minioadmin / minioadmin`), бакет `proekt-doma` |
| MinIO UI | 9001 | http://localhost:9001                                |

Убедитесь, что Postgres здоров, прежде чем идти дальше:

```bash
docker compose ps
```

### 5. Применить миграции БД

**Неинтерактивно**, применяет закоммиченные миграции (`20260423120000_init` + `20260423130000_refresh_tokens`):

```bash
pnpm db:deploy
```

> `pnpm db:migrate` (`prisma migrate dev`) используйте только когда **специально** создаёте новую миграцию — она интерактивна.

> **Важно:** перед первым запуском сгенерируйте секреты для JWT и вставьте в `apps/api/.env`:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
> ```
>
> Значения `AUTH_JWT_ACCESS_SECRET` и `AUTH_JWT_REFRESH_SECRET` **должны отличаться** и быть не короче 32 символов — иначе api не стартует.

### 6. Запуск

```bash
pnpm dev
```

Сначала соберётся `@app/contracts`, затем `concurrently` поднимет в параллель:

- **contracts** — `tsc --watch`, пересобирает `dist/` на изменения
- **web** — http://localhost:3000
- **api** — http://localhost:4000/api/v1
- healthcheck — http://localhost:4000/api/v1/health

По отдельности:

```bash
pnpm dev:api   # contracts watch + api
pnpm dev:web   # contracts watch + web
```

---

## Скрипты

| Скрипт                | Назначение                                       |
| --------------------- | ------------------------------------------------ |
| `pnpm dev`            | contracts (watch) + api + web                    |
| `pnpm build`          | Production-сборка: contracts → api → web         |
| `pnpm typecheck`      | Прогон `tsc --noEmit` во всех пакетах            |
| `pnpm lint`           | ESLint во всех пакетах                           |
| `pnpm format`         | Prettier                                         |
| `pnpm docker:up`      | Поднять Postgres / Redis / MinIO                 |
| `pnpm docker:down`    | Остановить инфраструктуру                        |
| `pnpm docker:reset`   | Остановить **и удалить volumes**                 |
| `pnpm db:deploy`      | Применить существующие миграции (для CI/клонов)  |
| `pnpm db:migrate`     | Создать новую миграцию (интерактивно)            |
| `pnpm db:generate`    | `prisma generate`                                |
| `pnpm db:studio`      | Открыть Prisma Studio                            |
| `pnpm db:validate`    | `prisma validate` — проверка schema.prisma       |

---

## Архитектурные решения, закреплённые в foundation

1. **Build chain.** `@app/contracts` собирается в `dist/` как CommonJS + `.d.ts`. API и web импортируют его по имени пакета через `node_modules`-симлинк, как любой обычный пакет. В dev `tsc --watch` в contracts + `concurrently` синхронизируют пересборку.
2. **HttpOnly cookie auth.** Production-like flow:
   - Access token — JWT, TTL 15 мин, живёт **только в памяти** фронта (zustand).
   - Refresh token — JWT с отдельным `jti`, TTL 7 дней, отдаётся **httpOnly Secure SameSite=Lax** cookie с `Path=/api/v1/auth`.
   - В БД хранится SHA-256 hash refresh-токена + метаданные (`userAgent`, `ip`).
   - Ротация refresh-токена на каждом `/auth/refresh` с detection reuse: если устаревший токен переиспользован, инвалидируются **все** сессии пользователя.
   - Single-flight refresh на фронте: параллельные 401 вызывают один `/auth/refresh`, остальные ждут.
   - `bcrypt` (cost 12) для паролей, отдельные секреты для access и refresh JWT, проверка несовпадения секретов в env-валидации.
3. **`FLOOR_PLAN_SCHEMA_VERSION`** — константа в `packages/contracts/src/floor-plan/floor-plan.schema.ts`, валидируется как `z.literal`. Бамп версии ловится TypeScript-ом.
4. **Единый `EnvService`** в api, провалидированный через zod. Никто в коде не читает `process.env` напрямую.
5. **Унифицированные ошибки API** — формат `{ statusCode, code, message, path, timestamp, details? }` в глобальном exception filter. Фронт-клиент парсит их в `ApiError`.
6. **Логгер Pino** (`nestjs-pino`) с redact для `authorization` / `cookie`. Pretty-режим — только в dev.
7. **Helmet** включён.
8. **CI** прогоняет install → contracts build → prisma validate → typecheck → lint → api/web build на каждый PR.

---

## Auth API

| Метод | URL | Auth | Описание |
|-------|-----|------|----------|
| POST | `/api/v1/auth/register` | public | Создать пользователя, вернуть session, установить refresh cookie |
| POST | `/api/v1/auth/login` | public | Логин, session + cookie |
| POST | `/api/v1/auth/refresh` | cookie | Ротация refresh + новый access token |
| POST | `/api/v1/auth/logout` | cookie | Отзывает refresh в БД и очищает cookie |
| GET | `/api/v1/auth/me` | bearer | Текущий пользователь по access token |
| GET | `/api/v1/users/me` | bearer | То же (в домене users) |

Public-эндпоинты помечаются `@Public()` decorator-ом. Глобальный `JwtAuthGuard` защищает всё остальное.

---

## Что появится в следующих итерациях

- `projects`: CRUD.
- `floor-plans`: сохранение/загрузка плана с optimistic locking.
- `media`: presigned URL на MinIO/S3.
- `ai-redesign`: BullMQ + воркер + внешний AI-провайдер.
- 2D-редактор (Konva), 3D-просмотр (R3F).

---

## Траблшутинг

**`npm ERR! only pnpm is allowed`** при `npm install`. Это ожидаемое поведение. Используйте `pnpm install`.

**`prisma generate` падает после `pnpm install`.** Убедитесь, что `apps/api/.env` создан и `DATABASE_URL` валидна (не обязательно подключаться — но URL должен быть корректен синтаксически).

**`pnpm db:deploy` падает с `ECONNREFUSED`.** Postgres ещё не поднялся или не healthy. Проверьте `docker compose ps` — у `proekt-doma-postgres` должен быть статус `(healthy)`.

**CORS-ошибка в браузере.** `WEB_ORIGIN` в `apps/api/.env` должен точно совпадать с origin фронта, **без trailing slash**. По умолчанию — `http://localhost:3000`.

**`tsc` в api ругается на типы Prisma.** Запустите `pnpm db:generate` (или переустановите зависимости — `postinstall` перегенерирует клиент).

**MinIO `unhealthy` в compose.** Первый старт может занять 10–20 секунд. Если задержалось — `docker compose logs minio`.

**Windows: symlinks и pnpm.** В Windows 10+ включите режим разработчика или запускайте терминал от администратора — pnpm использует симлинки для workspace-пакетов.
