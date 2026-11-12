import AppShell from "@/components/AppShell";
import DoctorsDirectory from "@/components/DoctorsDirectory";
export default function DoctorsPage() {
  return <AppShell><div className="page-heading"><div><div className="eyebrow">THE RIGHT EXPERTISE, CLOSER TO YOU</div><h1>Find your doctor.</h1><p>Explore our specialists. Choose the care and time that work for you.</p></div><span className="page-tag">MULTI-SPECIALTY CLINIC</span></div><DoctorsDirectory /></AppShell>;
}
