import Link from "@/components/app-link";
import { Croissant, Heart } from "lucide-react";

export function Footer() {
  return <footer className="site-footer"><div className="footer-top"><div><Link href="/" className="brand footer-brand"><Croissant size={29} /><span>arrie<span className="brand-dot">.</span><small>STORE</small></span></Link><p>Sweet treats. Lovely moments.<br />A brighter kind of everyday.</p></div><div><h3>Make yourself at home</h3><Link href="/#shop">Shop all products</Link><Link href="/orders">My orders</Link><Link href="/account">My account</Link></div><div className="footer-note"><Heart size={23} /><p>Baked with care.<br />Packed with a little love.</p></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Arrie Store</span><span>All prices in Philippine Peso · Manual QR payment</span></div></footer>;
}
