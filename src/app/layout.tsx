import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UAEPay - UAE E-Invoice Payment Collection Platform",
  description: "E-invoicing gets your invoices delivered. UAEPay gets them paid.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
      </body>
    </html>
  );
}