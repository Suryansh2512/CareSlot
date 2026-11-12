import Link from "next/link";
import AppShell from "@/components/AppShell";
import AppointmentsList from "@/components/AppointmentsList";
import { Icon } from "@/components/Icons";
export default function AppointmentsPage() {
  return <AppShell><div className="page-heading"><div><div className="eyebrow">EVERY VISIT, ALL IN ONE PLACE</div><h1>My appointments.</h1><p>Your upcoming visits and appointment history. All times in IST.</p></div><Link href="/" className="button primary"><Icon name="plus" size={18} />Book a visit</Link></div><AppointmentsList /></AppShell>;
}
