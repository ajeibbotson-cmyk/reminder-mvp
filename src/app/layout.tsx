import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reminder - UAE E-Invoice Payment Collection Platform",
  description: "E-invoicing gets your invoices delivered. Reminder gets them paid.",
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
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