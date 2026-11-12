"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./Icons";
const links = [
  { href: "/", label: "Booking Chat", icon: "chat" as const },
  { href: "/doctors", label: "Doctors", icon: "doctors" as const },
  { href: "/appointments", label: "My Appointments", icon: "calendar" as const },
];
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  async function logout() { await fetch("/api/logout", { method: "POST" }); window.location.assign("/login"); }
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><Icon name="plus" size={25} /></span><span>CareSlot<span className="brand-caption">CARE, WITHOUT THE WAIT</span></span></Link>
      <div className="sidebar-label">PATIENT WORKSPACE</div>
      <nav aria-label="Main navigation">{links.map(link => <Link key={link.href} href={link.href} className={pathname === link.href ? "nav-link active" : "nav-link"} aria-current={pathname === link.href ? "page" : undefined}><Icon name={link.icon} /><span>{link.label}</span>{pathname === link.href && <span className="nav-dot" />}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="safety-note"><Icon name="shield" size={21} /><strong>Your care, your choice</strong><p>Find the right department. Review every change before it happens.</p></div><div className="profile"><span className="avatar">AM</span><div><strong>Arjun Mehta</strong><span>Demo patient · P001</span></div><button className="icon-button" onClick={logout} aria-label="Log out"><Icon name="logout" size={18} /></button></div></div>
    </aside>
    <div className="main-column"><header className="topbar"><span>YOUR HEALTH, SIMPLIFIED</span><span className="clinic-time"><span className="status-dot" />Chennai clinic <span className="time-zone">· IST</span></span></header><main id="main-content" className="page-content">{children}</main><footer className="page-footer"><span>CareSlot · SRM Agentic AI Hackathon</span><span>Fictional clinic data. Appointment assistance only.</span></footer></div>
  </div>;
}
