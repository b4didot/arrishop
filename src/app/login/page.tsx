import Link from "next/link";
import { signIn } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/ui";
import { safeNext } from "@/lib/validation";

export const metadata = { title: "Log in" };
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const params = await searchParams;
  return <AuthShell title="Welcome back!" description="Log in to pick up where you left off.">
    {params.notice === "expired-link" && <p className="message error-message">That link has expired or already been used. Please log in or request a new link.</p>}
    <ActionForm action={signIn} submitLabel="Log in"><input type="hidden" name="next" value={safeNext(params.next)} /><Field label="Email address"><input type="email" name="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></Field><Field label="Password"><input type="password" name="password" autoComplete="current-password" required maxLength={128} /></Field><Link href="/forgot-password" className="forgot-link">Forgot your password?</Link></ActionForm>
    <p className="auth-foot">New here? <Link href="/register">Create an account</Link></p>
  </AuthShell>;
}
