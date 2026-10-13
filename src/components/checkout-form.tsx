"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { placeOrder } from "@/app/actions";

export function CheckoutForm({ userId, fingerprint }: { userId: string; fingerprint: string }) {
  const [key, setKey] = useState("");
  useEffect(() => {
    const storageKey = `arri-checkout:${userId}:${fingerprint}`;
    try {
      const saved = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, saved); setKey(saved);
    } catch { setKey(crypto.randomUUID()); }
  }, [userId, fingerprint]);
  return <ActionForm action={placeOrder} confirm="Place this order? You'll pay using the shop's QR code and upload your receipt next.">
    <input type="hidden" name="checkout_key" value={key} /><SubmitButton disabled={!key}>Confirm order <ArrowRight size={18} /></SubmitButton>
  </ActionForm>;
}
export function OrderPlaced({ userId }: { userId: string }) {
  useEffect(() => {
    try { Object.keys(sessionStorage).filter((key) => key.startsWith(`arri-checkout:${userId}:`)).forEach((key) => sessionStorage.removeItem(key)); } catch { /* Storage is optional. */ }
  }, [userId]);
  return <div className="message success-message" role="status">Your order is placed! Follow the payment instructions below.</div>;
}
