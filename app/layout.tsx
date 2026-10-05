import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TCS InvoiceFlow | The Code Squad",
  description:
    "InvoiceFlow by The Code Squad. Create personalised invoices with your company details, logo, colours, and line items.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
