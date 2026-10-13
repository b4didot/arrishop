import { requireUser } from "@/lib/auth";
import { resetPassword } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Field } from "@/components/ui";

export const metadata = { title: "Reset password" };
export default async function ResetPassword() {
  await requireUser("/reset-password");
  return <AuthShell title="A fresh start." description="Choose a new password for your account."><ActionForm action={resetPassword} submitLabel="Save new password"><Field label="New password"><input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></Field></ActionForm></AuthShell>;
}
