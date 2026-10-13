import Link from "@/components/app-link";
import { forgotPassword } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/ui";

export const metadata = { title: "Forgot password" };
export default function ForgotPassword() {
  return <AuthShell title="Let's get you back in." description="We'll send a link to reset your password."><ActionForm action={forgotPassword} submitLabel="Send reset link"><Field label="Email address"><input name="email" type="email" autoComplete="email" required maxLength={254} /></Field></ActionForm><p className="auth-foot"><Link href="/login">Back to log in</Link></p></AuthShell>;
}
