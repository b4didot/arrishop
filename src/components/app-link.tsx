"use client";

import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { LoadingSignal } from "@/components/loading-provider";

function LinkPending() {
  const { pending } = useLinkStatus();
  return <LoadingSignal pending={pending} />;
}

// Keep Next's prefetching, anchor scrolling, modifier clicks, and navigation semantics.
export default function AppLink({ children, ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props}>{children}<LinkPending /></NextLink>;
}
