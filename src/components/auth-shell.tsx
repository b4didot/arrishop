import { CakeSlice, Cookie, Croissant } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <div className="container"><div className="auth-shell"><aside className="auth-aside"><div className="auth-bakery-art" aria-hidden="true"><Cookie size={54} strokeWidth={1.3} /><CakeSlice size={130} strokeWidth={1.1} /><Croissant size={65} strokeWidth={1.3} /></div><h2>Your little corner<br />of sweetness.</h2><p>One simple account. A shop full of baked treats.</p></aside><section className="auth-main"><p className="eyebrow">HELLO, LOVELY</p><h1>{title}</h1><p className="muted">{description}</p>{children}</section></div></div>;
}
