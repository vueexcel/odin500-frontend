import { createElement } from 'react';

const D = 'di' + 'v';

/**
 * Prompt when a signed-in-only feature is used while logged out.
 */
export function LoginRequiredModal({ open, onClose, onLogin, onSignup }) {
  if (!open) return null;

  return createElement(
    D,
    { className: 'wl-manage-overlay login-required-overlay', role: 'presentation', onMouseDown: onClose },
    createElement(
      D,
      {
        className: 'wl-manage-modal login-required-modal',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'login-required-title',
        onMouseDown: (e) => e.stopPropagation()
      },
      createElement(
        D,
        { className: 'wl-manage-modal__head' },
        createElement('h2', { id: 'login-required-title', className: 'wl-manage-modal__title' }, 'Sign in required'),
        createElement(
          'button',
          { type: 'button', className: 'wl-manage-modal__close', onClick: onClose, 'aria-label': 'Close' },
          '×'
        )
      ),
      createElement(
        D,
        { className: 'wl-manage-modal__body' },
        createElement(
          'p',
          { className: 'login-required-modal__message' },
          'You need to login to Access this feature'
        )
      ),
      createElement(
        D,
        { className: 'wl-manage-modal__foot login-required-modal__foot' },
        createElement(
          'button',
          { type: 'button', className: 'wl-manage-btn wl-manage-btn--ghost', onClick: onLogin },
          'Login'
        ),
        createElement(
          'button',
          { type: 'button', className: 'wl-manage-btn wl-manage-btn--primary', onClick: onSignup },
          'Sign up'
        )
      )
    )
  );
}
