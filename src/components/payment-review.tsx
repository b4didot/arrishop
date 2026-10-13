"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { reviewPayment } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { money } from "@/lib/format";

export function PaymentReview({ orderId, submissionId, total }: { orderId: string; submissionId: string; total: number }) {
  const [decision, setDecision] = useState<"confirm" | "reject" | null>(null);
  return <><p className="small muted">Expected total: <strong>{money(total)}</strong>. Check the receipt and verify the funds in your payment account.</p>
    <ActionForm key={`${submissionId}:${decision}`} action={reviewPayment}
      submitLabel={decision === "confirm" ? "Confirm payment" : decision === "reject" ? "Reject payment" : undefined}
      confirm={decision === "confirm" ? "Confirm that you received this payment? You can start processing the order next." : "Reject this payment? The customer will see your reason and can submit a replacement receipt."}>
      <input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="submission_id" value={submissionId} /><input type="hidden" name="decision" value={decision ?? ""} />
      <div className="payment-choices" role="group" aria-label="Payment decision">
        <button className={`button ${decision === "confirm" ? "button-green" : "button-soft"}`} type="button" aria-pressed={decision === "confirm"} onClick={() => setDecision("confirm")}><Check size={17} />Confirm</button>
        <button className={`button ${decision === "reject" ? "button-danger" : "button-soft"}`} type="button" aria-pressed={decision === "reject"} onClick={() => setDecision("reject")}><X size={17} />Reject</button>
      </div>
      {decision === "confirm" && <Field label="Actual amount received (PHP)"><input name="amount" type="text" inputMode="decimal" pattern="[0-9]+(\.[0-9]{1,2})?" required placeholder={(total / 100).toFixed(2)} autoFocus /></Field>}
      {decision === "reject" && <Field label="Rejection reason (visible to customer)"><textarea name="reason" required maxLength={1000} placeholder="Explain what needs to be corrected" autoFocus /></Field>}
    </ActionForm>
  </>;
}
