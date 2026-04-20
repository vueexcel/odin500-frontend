import { apiUrl } from '../utils/apiOrigin.js';
import { fetchWithAuth } from '../store/apiStore.js';

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

/** Supabase `verifyOtp` with `type: 'signup'` — returns `session` in the JSON body. */
export async function verifySignupOtp(email, token) {
  const response = await fetch(apiUrl('/api/auth/verify-signup-otp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: String(email || '').trim(), token: String(token || '').trim() })
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Verification failed');
  }
  return payload;
}

export async function resendSignupOtp(email) {
  const response = await fetch(apiUrl('/api/auth/resend-signup-otp'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: String(email || '').trim() })
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Could not resend code');
  }
  return payload;
}

export async function startForgotPassword(email, redirectTo = '') {
  const response = await fetch(apiUrl('/api/auth/forgot-password/start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(email || '').trim(),
      redirectTo: String(redirectTo || '').trim()
    })
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Could not start password reset');
  }
  return payload;
}

export async function updateDisplayName(displayName) {
  const response = await fetchWithAuth(apiUrl('/api/auth/me/display-name'), {
    method: 'PATCH',
    body: JSON.stringify({ displayName: String(displayName || '').trim() })
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Could not save display name');
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

export async function getUserProfile() {
  const response = await fetchWithAuth(apiUrl('/api/user/profile'), { method: 'GET' });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Could not load profile');
  }
  return payload;
}

export async function updateUserProfile(profilePatch) {
  const response = await fetchWithAuth(apiUrl('/api/user/profile'), {
    method: 'PATCH',
    body: JSON.stringify(profilePatch || {})
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Could not update profile');
  }
  return payload;
}

export async function uploadAvatar(file) {
  if (!(file instanceof File)) throw new Error('Invalid file');
  const prep = await fetchWithAuth(apiUrl('/api/user/profile/avatar/upload-url'), {
    method: 'POST',
    body: JSON.stringify({
      mimeType: file.type,
      sizeBytes: file.size
    })
  });
  const prepPayload = await parseJsonSafe(prep);
  if (!prep.ok) {
    throw new Error(prepPayload.error || prepPayload.message || 'Could not prepare upload');
  }

  const signedUrl = prepPayload.signedUrl;
  const avatarPath = prepPayload.avatarPath;
  if (!signedUrl || !avatarPath) {
    throw new Error('Upload URL response is incomplete');
  }

  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    },
    body: file
  });
  if (!uploadRes.ok) {
    throw new Error('Avatar upload failed');
  }

  const saveRes = await fetchWithAuth(apiUrl('/api/user/profile/avatar'), {
    method: 'PATCH',
    body: JSON.stringify({ avatarPath })
  });
  const savePayload = await parseJsonSafe(saveRes);
  if (!saveRes.ok) {
    throw new Error(savePayload.error || savePayload.message || 'Could not save avatar');
  }
  return savePayload;
}

export async function changeEmail(newEmail) {
  const response = await fetchWithAuth(apiUrl('/api/user/change-email'), {
    method: 'POST',
    body: JSON.stringify({ newEmail: String(newEmail || '').trim() })
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Could not change email');
  }
  return payload;
}

export async function sendPasswordResetEmail(redirectTo = '') {
  const response = await fetchWithAuth(apiUrl('/api/user/reset-password'), {
    method: 'POST',
    body: JSON.stringify({ redirectTo })
  });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Could not send password reset');
  }
  return payload;
}

export async function deleteAccount() {
  const response = await fetchWithAuth(apiUrl('/api/user/account'), { method: 'DELETE' });
  const payload = await parseJsonSafe(response);
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'Could not delete account');
  }
  return payload;
}
