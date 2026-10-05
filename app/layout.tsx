import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const interfaceFont = localFont({
  src: "./fonts/geist-latin.woff2",
  variable: "--font-tcs-sans",
  weight: "100 900",
  display: "swap",
});
const monoFont = localFont({
  src: "./fonts/geist-mono-latin.woff2",
  variable: "--font-tcs-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "TCS InvoiceFlow | The Code Squad",
  description:
    "InvoiceFlow by The Code Squad. Create personalised invoices with your company details, logo, colours, and line items.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${interfaceFont.variable} ${monoFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
