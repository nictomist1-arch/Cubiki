/** Централизованная обработка ошибок API */
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Внутренняя ошибка сервера';
  if (status >= 500) {
    console.error('[API]', err);
  }
  res.status(status).json({ error: message });
}
