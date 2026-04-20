/** SessionStorage key for email during multi-step sign-up (verify → code → username). */
export const SIGNUP_EMAIL_KEY = 'odin_signup_email';

/** Pending display name to save after the user signs in (no JWT on username step). */
export const PENDING_DISPLAY_NAME_KEY = 'odin_pending_display_name';

/** Must match digits Supabase sends (template `{{ .Token }}` — often 6 or 8). */
export const SIGNUP_OTP_LENGTH = 8;
