"use client";

import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { placeOrder } from "@/app/actions";
import { money } from "@/lib/format";
import { shippingFee, type DeliveryCarrier } from "@/lib/delivery";

export function CheckoutForm({ userId, fingerprint, subtotal, ready }: { userId: string; fingerprint: string; subtotal: number; ready: boolean }) {
  const [key, setKey] = useState("");
  const [carrier, setCarrier] = useState<DeliveryCarrier | null>(null);
  useEffect(() => {
    if (!carrier) { setKey(""); return; }
    const storageKey = `arri-checkout:${userId}:${fingerprint}:${carrier}`;
    try {
      const saved = sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, saved); setKey(saved);
    } catch { setKey(crypto.randomUUID()); }
  }, [userId, fingerprint, carrier]);
  const fee = carrier ? shippingFee(carrier) : 0;
  return <>
    <fieldset className="carrier-choices"><legend>Delivery option</legend>
      <label className={`carrier-choice ${carrier === "jnt" ? "selected" : ""}`}><input type="radio" name="delivery_carrier" value="jnt" checked={carrier === "jnt"} onChange={() => { setKey(""); setCarrier("jnt"); }} /><span className="carrier-mark carrier-jnt">J&amp;T</span><span><strong>J&amp;T (JNT)</strong><small>₱99 shipping added to your order total. Pay it with your order through the shop QR.</small></span></label>
      <label className={`carrier-choice ${carrier === "lalamove" ? "selected" : ""}`}><input type="radio" name="delivery_carrier" value="lalamove" checked={carrier === "lalamove"} onChange={() => { setKey(""); setCarrier("lalamove"); }} /><span className="carrier-mark carrier-lalamove">L</span><span><strong>Lalamove</strong><small>No delivery fee is added to this order. You will pay Lalamove's shipping fee separately.</small></span></label>
    </fieldset>
    <div className="summary-line"><span>Items subtotal</span><span>{money(subtotal)}</span></div>
    <div className="summary-line"><span>J&amp;T shipping</span><span>{carrier === "jnt" ? money(fee) : "—"}</span></div>
    <div className="summary-line summary-total"><span>Pay to Arrie Store</span><strong>{money(subtotal + fee)}</strong></div>
    {carrier === "lalamove" && <p className="small muted">Lalamove's shipping fee is separate and is not included in the amount you pay to Arrie Store.</p>}
    {ready ? <ActionForm action={placeOrder} confirm={`Place this ${carrier === "jnt" ? "J&T" : "Lalamove"} order? You'll pay ${money(subtotal + fee)} to the shop using its QR code and upload your receipt next.`}>
      <input type="hidden" name="checkout_key" value={key} /><input type="hidden" name="delivery_carrier" value={carrier ?? ""} /><SubmitButton disabled={!key || !carrier}>Confirm order <ArrowRight size={18} /></SubmitButton>
    </ActionForm> : <button className="button full-width" disabled>Complete the steps above</button>}
  </>;
}
export function OrderPlaced({ userId }: { userId: string }) {
  useEffect(() => {
    try { Object.keys(sessionStorage).filter((key) => key.startsWith(`arri-checkout:${userId}:`)).forEach((key) => sessionStorage.removeItem(key)); } catch { /* Storage is optional. */ }
  }, [userId]);
  return <div className="message success-message" role="status">Your order is placed! Follow the payment instructions below.</div>;
}
