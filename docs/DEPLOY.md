# Деплой Cubiki на Render.com

## Подготовка

1. Загрузите проект на GitHub.
2. Создайте бесплатный кластер в [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
3. Получите строку подключения `MONGO_URI`.

## Render Web Service

1. [render.com](https://render.com) → **New +** → **Web Service**.
2. Подключите репозиторий GitHub.
3. Настройки:

| Поле | Значение |
|------|----------|
| Runtime | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Port | `10000` (Render задаёт через `PORT`) |

4. **Environment Variables:**

| Ключ | Значение |
|------|----------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | случайная строка 32+ символов |
| `MONGO_URI` | строка MongoDB Atlas |
| `PORT` | `10000` |

5. **Create Web Service** — через 3–5 минут появится публичный URL.

## Альтернатива: render.yaml

В корне есть `render.yaml`. При подключении репозитория Render может подхватить настройки автоматически.

## Локально без MongoDB

Если `MONGO_URI` не задан, данные сохраняются в `data/users.json` (только для разработки).

## Проверка после деплоя

- Откройте публичный URL.
- Зарегистрируйте аккаунт.
- Войдите в игру с двух вкладок — игроки должны видеть друг друга.
- Выйдите из игры — монеты должны увеличиться (прогресс сохранён).
