# Cubiki

Браузерная мультиплеерная 3D-игра на Node.js: игроки видят друг друга в реальном времени, общаются, толкают друг друга и сохраняют прогресс через аккаунт.

> **Экзаменационный проект:** серверное сетевое приложение на Node.js с Three.js, Socket.io, БД и деплоем.

## Ссылки

| Документ | Описание |
|----------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Архитектура сервера и клиента |
| [docs/API.md](docs/API.md) | REST и Socket.io API |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Деплой на Render.com |
| [.env.example](.env.example) | Переменные окружения |

## Исходники и инструменты

- Базовая 3D-сцена: форк идей из [nictomist1-arch/Cube](https://github.com/nictomist1-arch/Cube)
- Сетевой слой: [nictomist1-arch/Socket](https://github.com/nictomist1-arch/Socket)
- Репозиторий проекта: [nictomist1-arch/Cubiki](https://github.com/nictomist1-arch/Cubiki)
- Инструменты разработки: Node.js, Vite, Three.js, Cursor IDE, AI-ассистент (Cursor Agent)

## Возможности

- Мультиплеер в комнатах (Socket.io)
- Аккаунты: регистрация, вход (JWT + bcrypt)
- Прогресс: монеты, купленные формы, статистика сессий
- Магазин скинов (сфера, ромб, цилиндр)
- Чат, прыжки, толчок, мобильное управление

## Технологии

| Слой | Стек |
|------|------|
| Клиент | Three.js, Vite |
| Сервер | Node.js, Express, Socket.io |
| БД | MongoDB (продакшен) / `data/users.json` (локально) |
| Auth | jsonwebtoken, bcryptjs |

## Быстрый старт

```bash
npm install
cp .env.example .env   # опционально
npm run build
npm start
```

Откройте **http://localhost:3000**

### Режим разработки

```bash
npm run dev
```

- Сервер: `:3000`
- Vite: `:5173`

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `PORT` | Порт (по умолчанию 3000) |
| `JWT_SECRET` | Секрет для JWT |
| `MONGO_URI` | MongoDB Atlas (без неё — файл `data/users.json`) |
| `NODE_ENV` | `production` на хостинге |

## Структура проекта

```
Cubiki/
├── server/
│   ├── index.js           # Точка входа
│   ├── app.js             # Express + Socket.io
│   ├── config/            # env, константы, магазин
│   ├── db/                # MongoDB / файловое хранилище
│   ├── models/            # Mongoose User
│   ├── services/          # UserService
│   ├── managers/          # RoomManager
│   ├── controllers/       # auth, shop, api
│   ├── routes/            # REST
│   ├── middleware/        # JWT
│   └── sockets/           # игровые события
├── src/
│   ├── main.js            # клиент
│   ├── auth.js            # API авторизации
│   └── core/              # Three.js
├── docs/                  # архитектура, API, деплой
├── render.yaml            # конфиг Render
└── package.json
```

## Управление

| Клавиша | Действие |
|---------|----------|
| WASD | Движение |
| Пробел | Прыжок |
| E | Толчок |
| T | Чат |
| 📷 | Сброс камеры |
| 🎨 | Персонализация |

## Прогресс и магазин

- За каждую сессию: **+10 монет**
- За каждый успешный толчок: **+2 монеты**
- В магазине можно купить формы (сфера 30🪙, цилиндр 40🪙, ромб 50🪙)
- Прогресс сохраняется при выходе из игры (disconnect)

## Деплой (Render.com)

1. MongoDB Atlas → получить `MONGO_URI`
2. GitHub → подключить репозиторий к Render
3. Build: `npm install && npm run build`
4. Start: `npm start`
5. Env: `JWT_SECRET`, `MONGO_URI`, `NODE_ENV=production`

Подробнее: [docs/DEPLOY.md](docs/DEPLOY.md)

## GitHub (для сдачи)

Рекомендуется создать:

- **Issues** — минимум 3 задачи (enhancement, bug, documentation)
- **Projects** — канбан To Do / In Progress / Done
- **Wiki** — управление, БД, API (можно скопировать из `docs/`)
- **About** — описание, URL деплоя, теги: `multiplayer`, `threejs`, `nodejs`, `socketio`

## Скрипты

| Команда | Описание |
|---------|----------|
| `npm install` | Зависимости |
| `npm run dev` | Разработка |
| `npm run build` | Сборка в `dist/` |
| `npm start` | Продакшен-сервер |
