"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import type { ActionState } from "@/types";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;
export function SubmitButton({ children, className = "button", disabled = false }: { children: ReactNode; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={className} disabled={pending || disabled}>{pending ? <><LoaderCircle size={17} className="spin" /> Please wait…</> : children}</button>;
}
export function ActionForm({ action, children, className = "form-stack", confirm, submitLabel }: { action: Action; children: ReactNode; className?: string; confirm?: string; submitLabel?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className={className} onSubmit={(event) => { if (confirm && !window.confirm(confirm)) event.preventDefault(); }} aria-busy={pending}>
    <fieldset disabled={pending} className="form-fields">{children}{submitLabel && <SubmitButton>{submitLabel}</SubmitButton>}</fieldset>
    {state.error && <p role="alert" className="message error-message">{state.error}</p>}
    {state.success && <p role="status" className="message success-message">{state.success}</p>}
  </form>;
}
