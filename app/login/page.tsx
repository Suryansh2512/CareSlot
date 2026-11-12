"use client";
import { useState } from "react";
import { Icon } from "@/components/Icons";
export default function LoginPage() {
  const [passcode, setPasscode] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault(); if (loading) return; setLoading(true); setError("");
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not sign in.");
      window.location.assign("/");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not sign in. Please try again."); }
    finally { setLoading(false); }
  }
  return <main className="login-page" id="main-content"><section className="login-story"><div className="brand"><span className="brand-mark"><Icon name="plus" size={27} /></span><span>CareSlot</span></div><div><span className="eyebrow">CARE, WITHOUT THE WAIT</span><h1>Your next visit.<br />One less thing<br />to worry about.</h1><p>A simple conversation to find your doctor,<br />book your time, and get on with your day.</p><div className="login-feature"><Icon name="shield" size={22} />You review. You confirm. You’re in control.</div></div><small>PS3 · SRM Agentic AI Hackathon · Fictional demo data</small></section>
    <section className="login-form-section"><form onSubmit={login} className="login-form"><span className="eyebrow">WELCOME TO YOUR PATIENT WORKSPACE</span><h2>A little less waiting.<br />A little more care.</h2><p>Enter your team passcode to continue as Arjun Mehta, demo patient P001.</p><label className="field-label" htmlFor="passcode">Team passcode<input id="passcode" name="passcode" type="password" value={passcode} onChange={e => setPasscode(e.target.value)} maxLength={100} autoComplete="current-password" required placeholder="Enter your passcode" /></label>{error && <p className="notice error" role="alert">{error}</p>}<button className="button primary full-width" disabled={loading || !passcode.trim()}>{loading ? "Signing in…" : "Continue to CareSlot"}<Icon name="arrow" size={18} /></button><p className="login-fineprint"><Icon name="shield" size={15} />This is a hackathon demo. No real patient data.</p></form></section>
  </main>;
}
