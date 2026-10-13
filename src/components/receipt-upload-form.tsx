"use client";

import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/ui";
import { uploadReceipt } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";
import { imageFile } from "@/lib/validation";
import type { ActionState } from "@/types";

export function ReceiptUploadForm({ orderId, replacement, submissionKey }: { orderId: string; replacement: boolean; submissionKey: string }) {
  async function submit(state: ActionState, form: FormData): Promise<ActionState> {
    try {
      if (form.getAll("receipt").length !== 1 || form.getAll("receipt_second").length > 1 || [...form].some(([key, value]) => value instanceof File && value.size > 0 && key !== "receipt" && key !== "receipt_second")) throw new Error("Please choose no more than two receipt photos.");
      const first = await imageFile(form, "receipt");
      const second = await imageFile(form, "receipt_second", false);
      const images = [first, second].filter((image): image is NonNullable<typeof image> => Boolean(image));
      if (images.length < 1 || images.length > 2) throw new Error("Please upload one or two receipt photos.");
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) throw new Error("Please log in again before submitting your receipt.");
      const submission = String(form.get("submission_key"));
      const paths: string[] = [];
      for (const [index, image] of images.entries()) {
        const path = `${user.id}/${orderId}/${submission}-${index + 1}.${image.extension}`;
        const { error } = await client.storage.from("receipts").upload(path, image.file, { contentType: image.type, upsert: false });
        if (error && !/already exists|duplicate/i.test(error.message)) throw new Error("We couldn't upload your receipt photo. Please try again.");
        paths.push(path);
      }
      form.delete("receipt"); form.delete("receipt_second");
      form.set("receipt_paths", JSON.stringify(paths));
      return await uploadReceipt(state, form);
    } catch (error) { return { error: error instanceof Error ? error.message : "We couldn't submit your receipt. Please try again." }; }
  }
  return <ActionForm action={submit} submitLabel={replacement ? "Submit replacement receipt" : "Submit payment receipt"} confirm="Submit your receipt photos for manual verification?">
    <input type="hidden" name="order_id" value={orderId} /><input type="hidden" name="submission_key" value={submissionKey} />
    <Field label="Receipt photo 1"><input type="file" name="receipt" accept="image/jpeg,image/png,image/webp" required /></Field>
    <Field label="Receipt photo 2 (optional)"><input type="file" name="receipt_second" accept="image/jpeg,image/png,image/webp" /></Field>
    <p className="field-hint">Upload one or two photos. JPG, PNG, or WebP, up to 5 MB each. Only you and shop administrators can view them.</p>
  </ActionForm>;
}
