import Link from "next/link";
import { requireUser, getViewer } from "@/lib/auth";
import { getProfile } from "@/lib/data";
import { saveProfile } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, Notice, PageHeading } from "@/components/ui";

export const metadata = { title: "My account" };
export default async function Account({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const user = await requireUser("/account");
  const [profile, viewer, params] = await Promise.all([getProfile(user.id), getViewer(), searchParams]);
  return <div className="container page-container"><PageHeading eyebrow="YOUR LITTLE CORNER" title="My account" description="Keep your contact and delivery details up to date.">{viewer.admin && <Link href="/admin" className="button button-soft">Open admin dashboard</Link>}</PageHeading>{params.notice === "admin-only" && <Notice>This area is for shop administrators. You can manage your own details here.</Notice>}<section className="panel narrow"><p className="muted small">Signed in as {user.email}</p><ActionForm action={saveProfile} submitLabel="Save my details">
    <Field label="Full name"><input name="full_name" autoComplete="name" required maxLength={120} defaultValue={profile?.full_name} /></Field>
    <Field label="Phone number"><input name="phone" type="tel" autoComplete="tel" required maxLength={30} defaultValue={profile?.phone} /></Field>
    <Field label="Delivery address"><textarea name="delivery_address" autoComplete="street-address" required maxLength={1000} defaultValue={profile?.delivery_address} /></Field>
  </ActionForm><p className="small muted" style={{ marginTop: 20, marginBottom: 0 }}>Updates apply to future orders. Existing orders keep the delivery details you confirmed at checkout.</p></section></div>;
}
