import Link from "next/link";
import AppShell from "@/components/AppShell";
import AgentChat from "@/components/AgentChat";
import AppointmentsList from "@/components/AppointmentsList";
import { Icon } from "@/components/Icons";
import { getAIProvider } from "@/lib/env";
export const dynamic = "force-dynamic";
export default function HomePage() {
  return <AppShell><div className="page-heading"><div><div className="eyebrow">A SIMPLER WAY TO FEEL LOOKED AFTER</div><h1>Good care starts with a conversation.</h1><p>Hello, Arjun. Let’s make your next clinic visit a little easier.</p></div><Link href="/doctors" className="button secondary"><Icon name="doctors" size={18} />Browse doctors</Link></div>
    <div className="booking-grid"><AgentChat provider={getAIProvider()} /><aside className="booking-aside"><AppointmentsList compact /><section className="how-it-works panel"><span className="eyebrow">FROM HELLO TO BOOKED</span><h2>Your visit, in three steps.</h2><ol><li><span>01</span><div><strong>Tell us what you need</strong><p>A specialty, preferred language, or a day that suits you.</p></div></li><li><span>02</span><div><strong>Find your best fit</strong><p>Explore real doctors and available appointment times.</p></div></li><li><span>03</span><div><strong>Review, then confirm</strong><p>You’re in control. Every change needs your confirmation.</p></div></li></ol></section><div className="clinic-note"><Icon name="clock" size={21} /><div><strong>Clinic hours</strong><p>Monday–Saturday · 9:00 AM–12:30 PM IST</p><span>Appointments available within the seeded date window.</span></div></div></aside></div>
  </AppShell>;
}
