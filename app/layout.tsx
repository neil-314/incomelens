import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "IncomeLens — clarity in every transaction",
  description:
    "An explainable financial-data pipeline powered by Plaid Sandbox.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
