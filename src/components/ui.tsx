import Link from "next/link";
import { ArrowLeft, Cookie, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { OrderStatus } from "@/types";
import { statusLabels } from "@/lib/format";

export function PageHeading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{children}</div>;
}
export function StatusBadge({ status }: { status: OrderStatus }) { return <span className={`badge status-${status}`}>{statusLabels[status]}</span>; }
export function EmptyState({ title, description, href, label }: { title: string; description: string; href?: string; label?: string }) {
  return <div className="empty-state"><span className="empty-icon"><Cookie size={32} strokeWidth={1.5} /></span><h2>{title}</h2><p className="muted">{description}</p>{href && <Link className="button" href={href}>{label ?? "Browse the shop"}</Link>}</div>;
}
export function BackLink({ href, children }: { href: string; children: ReactNode }) { return <Link className="back-link" href={href}><ArrowLeft size={16} />{children}</Link>; }
export function Notice({ children }: { children: ReactNode }) { return <div className="notice"><Sparkles size={20} /><p>{children}</p></div>; }
export function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
