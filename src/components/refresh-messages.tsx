"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLoadingSignal } from "@/components/loading-provider";
export function RefreshMessages() {
 const router=useRouter();const [pending,start]=useTransition();useLoadingSignal(pending);
 return <button type="button" className="button button-small button-outline" disabled={pending} onClick={()=>start(()=>router.refresh())}>Refresh messages</button>;
}
