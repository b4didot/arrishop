"use client";

import { useTransition, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useLoadingSignal } from "@/components/loading-provider";

function PendingFields({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  useLoadingSignal(pending);
  return <fieldset className="form-fields" disabled={pending}>{children}</fieldset>;
}

export function PendingForm({ children, ...props }: ComponentProps<"form">) {
  return <form {...props}><PendingFields>{children}</PendingFields></form>;
}

export function NavigationForm({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useLoadingSignal(pending);
  return <form action={action} method="get" className={className} aria-busy={pending} onSubmit={(event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    values.forEach((value, key) => { if (typeof value === "string") query.append(key, value); });
    startTransition(() => router.push(`${action}?${query}`));
  }}>{children}</form>;
}
