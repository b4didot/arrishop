"use client";
import Link from "@/components/app-link";
import { EmptyState } from "@/components/ui";
import { useTransition } from "react";
import { useLoadingSignal } from "@/components/loading-provider";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const [pending, startTransition] = useTransition();
  useLoadingSignal(pending);
  return <div className="container page-container"><EmptyState title="A little hiccup" description="We couldn't load this page. Please try again in a moment." /><div className="flex justify-center gap-4 mt-6"><button className="button" disabled={pending} onClick={() => startTransition(reset)}>Try again</button><Link className="button button-soft" href="/">Back to shop</Link></div></div>;
}
