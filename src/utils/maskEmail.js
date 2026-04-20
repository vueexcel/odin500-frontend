/** @param {string} email */
export function maskEmail(email) {
  const em = String(email || '').trim();
  const at = em.indexOf('@');
  if (at <= 1) return em || 'your email';
  const local = em.slice(0, at);
  const domain = em.slice(at + 1);
  const keep = Math.min(3, Math.max(1, Math.floor(local.length / 4)));
  const masked = `${local.slice(0, keep)}${'*'.repeat(Math.min(7, Math.max(3, local.length - keep)))}`;
  return `${masked}@${domain}`;
}
