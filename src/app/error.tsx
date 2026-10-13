"use client";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div className="container page-container"><EmptyState title="A little hiccup" description="We couldn't load this page. Please try again in a moment." /><div className="flex justify-center gap-4 mt-6"><button className="button" onClick={reset}>Try again</button><Link className="button button-soft" href="/">Back to shop</Link></div></div>;
}
