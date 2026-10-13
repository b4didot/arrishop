import { AddressFields } from "@/components/address-fields";
import Link from "@/components/app-link";
import { register } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/ui";

export const metadata = { title: "Create an account" };
export default function Register() {
  return <AuthShell title="Join our little shop." description="Create your account and start shopping right away. No email verification needed."><ActionForm action={register} submitLabel="Create account">
    <Field label="Full name"><input name="full_name" autoComplete="name" required maxLength={120} placeholder="Your full name" /></Field>
    <Field label="Social name (optional)"><input name="social_name" maxLength={120} placeholder="Name you use on social media" /></Field>
    <Field label="Email address"><input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></Field>
    <Field label="Password"><input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={128} required placeholder="At least 8 characters" /></Field>
    <Field label="Phone number"><input type="tel" name="phone" autoComplete="tel" required maxLength={30} placeholder="Your contact number" /></Field>
    <AddressFields />
  </ActionForm><p className="auth-foot">Already have an account? <Link href="/login">Log in</Link></p></AuthShell>;
}
