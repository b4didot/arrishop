"use client";
import { LoadingCard, LoadingSignal } from "@/components/loading-provider";
export default function Loading() { return <><LoadingSignal pending /><div className="route-loading-space" aria-hidden="true" /><div className="route-loading-overlay"><LoadingCard /></div></>; }
