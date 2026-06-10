# Архитектура Cubiki

## Сервер (`server/`)

```
server/
├── index.js              # Точка входа
├── app.js                # Express + Socket.io
├── config/               # env, константы, магазин
├── db/                   # MongoDB или файл data/users.json
├── models/User.js        # Mongoose-схема
├── services/UserService.js
├── managers/RoomManager.js
├── controllers/          # auth, shop, api
├── routes/               # REST-маршруты
├── middleware/           # JWT, ошибки
├── sockets/              # Socket.io обработчики
└── utils/                # jwt, game, network
```

## Клиент (`src/`)

```
src/
├── main.js       # Игра, UI, сеть
├── auth.js       # API авторизации и магазина
├── core/         # Three.js сцена и свет
└── config/       # Параметры сцены
```

## Поток данных

1. **Регистрация/вход** → `POST /api/auth/*` → JWT в `localStorage`.
2. **Подключение к игре** → Socket.io с `auth.token` → `joinRoom`.
3. **Синхронизация** → `playerMove`, `playerPush`, `chatMessage` в рамках комнаты.
4. **Выход** → `disconnect` → сохранение монет и статистики в БД.

## База данных

| Режим | Когда | Хранение |
|-------|-------|----------|
| MongoDB | `MONGO_URI` задан | Atlas / локальный Mongo |
| Файл | без `MONGO_URI` | `data/users.json` |

### Поля пользователя

- `username`, `passwordHash` (bcrypt)
- `coins`, `ownedShapes`, `profile`
- `stats`: сессии, толчки, заработанные монеты

## API

См. [API.md](./API.md)
