const TOKEN_KEY = 'cubiki_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка запроса');
  return data;
}

export async function register(username, password, displayName) {
  const data = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName }),
  });
  setToken(data.token);
  return data.user;
}

export async function login(username, password) {
  const data = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(data.token);
  return data.user;
}

export async function fetchMe() {
  const token = getToken();
  if (!token) return null;
  try {
    const data = await api('/api/auth/me');
    return data.user;
  } catch {
    setToken(null);
    return null;
  }
}

export async function fetchShop() {
  return api('/api/shop');
}

export async function buyItem(itemId) {
  return api('/api/shop/buy', {
    method: 'POST',
    body: JSON.stringify({ itemId }),
  });
}

export function logout() {
  setToken(null);
}
