import { useContext, useMemo, useRef } from 'react';
import { AuthShellThemeContext } from './AuthSplitShell.jsx';

/** Single-digit OTP inputs (6 or 8 cells); uses `auth-otp-digit` + global auth CSS.
 * @param {number} [length]
 * @param {'default'|'signupLight'} [variant]
 */
export function OtpSixBoxes({ value, onChange, disabled, variant = 'default', length: lengthProp = 6 }) {
  const length = Math.min(12, Math.max(4, Number(lengthProp) || 6));
  const refs = useRef([]);
  const digits = useMemo(() => {
    const v = String(value || '').replace(/\D/g, '').slice(0, length);
    return Array.from({ length }, (_, i) => v[i] || '');
  }, [value, length]);

  const theme = useContext(AuthShellThemeContext);
  const isDark = theme === 'dark';

  const setDigit = (index, digit) => {
    const raw = String(value || '').replace(/\D/g, '');
    const next =
      digit === ''
        ? raw.slice(0, index) + raw.slice(index + 1)
        : raw.slice(0, index) + digit + raw.slice(index + 1);
    onChange(next.slice(0, length));
    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div
      className="grid w-full max-w-full gap-1 sm:gap-1.5 md:gap-2"
      style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          disabled={disabled}
          maxLength={1}
          value={d}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            setDigit(i, ch);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
            onChange(paste);
            const focusIdx = Math.min(paste.length, length - 1);
            refs.current[focusIdx]?.focus();
          }}
          className={`auth-otp-digit min-w-0 text-sm outline-none transition-opacity disabled:opacity-60 sm:text-base md:text-[18px] ${
            variant === 'signupLight'
              ? `signup-otp-cell ${isDark ? 'text-white' : 'text-[#0f172a]'}`
              : isDark
                ? 'text-white'
                : 'text-[#f8fafc]'
          }`}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
