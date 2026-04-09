import { apiUrl } from '../utils/apiOrigin.js';

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function signup(email, password) {
  const response = await fetch(apiUrl('/api/auth/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Signup failed');
  }
  return payload;
}

export async function login(email, password) {
  const response = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Login failed');
  }
  return payload;
}
