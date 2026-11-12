import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "CareSlot · Clinic Appointment Assistant", template: "%s · CareSlot" }, description: "Find a doctor, book a visit, and manage your clinic appointments with CareSlot. Powered by Gemini." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><a href="#main-content" className="skip-link">Skip to content</a>{children}</body></html>;
}
