import type { Metadata } from "next";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { LoadingProvider } from "@/components/loading-provider";
import "./globals.css";

export const metadata: Metadata = { title: { default: "Arrie Store · Baked with love", template: "%s · Arrie Store" }, description: "Sweet baked goods for your everyday. Browse Arrie Store and order with simple QR payment." };
export const dynamic = "force-dynamic";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" data-scroll-behavior="smooth"><body><LoadingProvider><a className="skip-link" href="#main">Skip to content</a><Header /><main id="main">{children}</main><Footer /></LoadingProvider></body></html>;
}
