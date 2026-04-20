import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  changeEmail,
  deleteAccount,
  getUserProfile,
  sendPasswordResetEmail,
  updateUserProfile,
  uploadAvatar
} from '../services/authApi.js';
import { clearApiCache, clearAuthToken } from '../store/apiStore.js';

function initialsFor(name, email) {
  const base = String(name || '').trim() || String(email || '').trim().split('@')[0] || 'U';
  return base
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}

export default function AboutPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [profile, setProfile] = useState({
    userEmail: '',
    userName: '',
    displayName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    planName: '',
    planStatus: '',
    planRenewalAt: '',
    avatarUrl: ''
  });
  const [newEmail, setNewEmail] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const p = await getUserProfile();
      setProfile((prev) => ({
        ...prev,
        ...p,
        userName: p.userName || p.displayName || '',
        displayName: p.displayName || p.userName || '',
        avatarUrl: p.avatarUrl || ''
      }));
    } catch (e) {
      setError(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const initials = useMemo(
    () => initialsFor(profile.displayName || profile.userName, profile.userEmail),
    [profile.displayName, profile.userEmail, profile.userName]
  );

  const onSaveProfile = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateUserProfile({
        displayName: profile.displayName,
        phone: profile.phone,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        postalCode: profile.postalCode,
        country: profile.country
      });
      setMessage('Profile saved.');
      await loadProfile();
      window.dispatchEvent(new CustomEvent('odin-auth-updated'));
    } catch (e2) {
      setError(e2.message || 'Could not save profile');
    } finally {
      setBusy(false);
    }
  };

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    setError('');
    setMessage('');
    try {
      await uploadAvatar(file);
      setMessage('Avatar updated.');
      await loadProfile();
    } catch (e2) {
      setError(e2.message || 'Could not upload avatar');
    } finally {
      setAvatarBusy(false);
      e.target.value = '';
    }
  };

  const onChangeEmail = async () => {
    setEmailBusy(true);
    setError('');
    setMessage('');
    try {
      await changeEmail(newEmail);
      setMessage('Email change verification sent.');
      setNewEmail('');
    } catch (e) {
      setError(e.message || 'Could not change email');
    } finally {
      setEmailBusy(false);
    }
  };

  const onSendReset = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await sendPasswordResetEmail(`${window.location.origin}/forgot-password`);
      setMessage('Password reset email sent.');
    } catch (e) {
      setError(e.message || 'Could not send password reset');
    } finally {
      setBusy(false);
    }
  };

  const onDeleteAccount = async () => {
    const ok = window.confirm('Delete account permanently? This cannot be undone.');
    if (!ok) return;
    setDeleteBusy(true);
    setError('');
    setMessage('');
    try {
      await deleteAccount();
      clearAuthToken();
      clearApiCache();
      navigate('/signup', { replace: true });
    } catch (e) {
      setError(e.message || 'Could not delete account');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="about-page">
      <h1 className="about-page__title">About your account</h1>
      {loading ? <div className="about-page__status">Loading profile…</div> : null}
      {error ? <div className="about-page__status about-page__status--err">{error}</div> : null}
      {message ? <div className="about-page__status about-page__status--ok">{message}</div> : null}

      <section className="about-card">
        <h2 className="about-card__title">Profile details</h2>
        <form className="about-profile-grid" onSubmit={onSaveProfile}>
          <div className="about-avatar-block">
            {profile.avatarUrl ? (
              <img className="about-avatar" src={profile.avatarUrl} alt="Profile avatar" />
            ) : (
              <div className="about-avatar about-avatar--fallback">{initials}</div>
            )}
            <label className="about-file-btn">
              {avatarBusy ? 'Uploading…' : 'Upload image'}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarPick} hidden />
            </label>
          </div>

          <div className="about-fields">
            <label className="about-field">
              <span>Name</span>
              <input
                value={profile.displayName || ''}
                onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
                placeholder="Enter name"
              />
            </label>
            <label className="about-field">
              <span>Email (current)</span>
              <input value={profile.userEmail || ''} readOnly />
            </label>
            <label className="about-field">
              <span>Phone</span>
              <input
                value={profile.phone || ''}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+1 555 000 000"
              />
            </label>
            <label className="about-field">
              <span>Address line 1</span>
              <input
                value={profile.addressLine1 || ''}
                onChange={(e) => setProfile((p) => ({ ...p, addressLine1: e.target.value }))}
              />
            </label>
            <label className="about-field">
              <span>Address line 2</span>
              <input
                value={profile.addressLine2 || ''}
                onChange={(e) => setProfile((p) => ({ ...p, addressLine2: e.target.value }))}
              />
            </label>
            <label className="about-field">
              <span>City</span>
              <input
                value={profile.city || ''}
                onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
              />
            </label>
            <label className="about-field">
              <span>State</span>
              <input
                value={profile.state || ''}
                onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))}
              />
            </label>
            <label className="about-field">
              <span>Postal code</span>
              <input
                value={profile.postalCode || ''}
                onChange={(e) => setProfile((p) => ({ ...p, postalCode: e.target.value }))}
              />
            </label>
            <label className="about-field">
              <span>Country</span>
              <input
                value={profile.country || ''}
                onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
              />
            </label>
          </div>

          <div className="about-actions-row">
            <button type="submit" className="about-btn about-btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      </section>

      <section className="about-card">
        <h2 className="about-card__title">Plan details</h2>
        <div className="about-plan-grid">
          <div><strong>Plan:</strong> {profile.planName || 'Free'}</div>
          <div><strong>Status:</strong> {profile.planStatus || 'active'}</div>
          <div><strong>Renewal:</strong> {profile.planRenewalAt || '—'}</div>
        </div>
      </section>

      <section className="about-card">
        <h2 className="about-card__title">Security</h2>
        <div className="about-security-grid">
          <div className="about-security-item">
            <h3>Change email</h3>
            <div className="about-security-row">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new-email@example.com"
              />
              <button
                type="button"
                className="about-btn"
                onClick={onChangeEmail}
                disabled={emailBusy || !newEmail}
              >
                {emailBusy ? 'Sending…' : 'Change email'}
              </button>
            </div>
          </div>
          <div className="about-security-item">
            <h3>Password reset</h3>
            <button type="button" className="about-btn" onClick={onSendReset} disabled={busy}>
              Send reset link
            </button>
          </div>
          <div className="about-security-item about-security-item--danger">
            <h3>Delete account</h3>
            <button type="button" className="about-btn about-btn--danger" onClick={onDeleteAccount} disabled={deleteBusy}>
              {deleteBusy ? 'Deleting…' : 'Delete account'}
            </button>
          </div>
        </div>
      </section>

      <section className="about-card">
        <h2 className="about-card__title">Legal stuff</h2>
        <div className="about-legal-list">
          <div className="about-legal-item">
            <div>
              <strong>Privacy policy</strong>
              <p>How Odin500 collects, handles and processes user data.</p>
            </div>
            <a className="about-btn" href="#" onClick={(e) => e.preventDefault()}>
              Read privacy policy
            </a>
          </div>
          <div className="about-legal-item">
            <div>
              <strong>Terms & conditions</strong>
              <p>Terms of service regarding the use of this platform.</p>
            </div>
            <a className="about-btn" href="#" onClick={(e) => e.preventDefault()}>
              Read terms & conditions
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
