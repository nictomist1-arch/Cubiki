# API эндпоинты

## Авторизация

### `POST /api/auth/register`

```json
{ "username": "player1", "password": "1234", "displayName": "Игрок" }
```

Ответ: `{ "token": "...", "user": { ... } }`

### `POST /api/auth/login`

```json
{ "username": "player1", "password": "1234" }
```

### `GET /api/auth/me`

Заголовок: `Authorization: Bearer <token>`

### `PUT /api/auth/profile`

```json
{ "color": 5164484, "shape": "cube", "size": 1, "displayName": "Игрок" }
```

## Игра

### `GET /api/info`

Порт, тип БД, LAN-URL.

### `GET /api/rooms`

Список активных комнат.

### `GET /api/shop`

Каталог товаров (+ данные пользователя, если авторизован).

### `POST /api/shop/buy`

```json
{ "itemId": "shape_sphere" }
```

## Socket.io

| Событие | Направление | Описание |
|---------|-------------|----------|
| `joinRoom` | client → server | Вход в комнату |
| `init` | server → client | Состояние комнаты |
| `playerMove` | client → server | Позиция |
| `playerPush` | client → server | Толчок |
| `chatMessage` | client → server | Чат |
| `setProfile` | client → server | Смена скина |
