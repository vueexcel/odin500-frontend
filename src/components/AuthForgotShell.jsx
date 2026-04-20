import { AuthFlowShell } from './AuthFlowShell.jsx';

/** @param {object} props
 *  @param {import('react').ReactNode} props.children */
export function AuthForgotShell({ children }) {
  return <AuthFlowShell backTo="/login" backAriaLabel="Back to sign in">{children}</AuthFlowShell>;
}
