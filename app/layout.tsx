import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "IncomeLens",
  description: "Income and cash flow from Plaid Sandbox transactions.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
