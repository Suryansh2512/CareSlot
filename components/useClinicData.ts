"use client";
import { useCallback, useEffect, useState } from "react";
export function notifyClinicChanged() { window.dispatchEvent(new Event("careslot:changed")); }
export function useClinicData<T>(url: string, refreshKey = 0) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    setLoading(true); setError(""); setData(undefined);
    const load = async () => {
      controller?.abort(); controller = new AbortController();
      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Could not load clinic data.");
        if (active) { setData(body); setError(""); }
      } catch (e) { if (active && !(e instanceof Error && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Could not load data."); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(load, 5000);
    window.addEventListener("careslot:changed", load);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); window.removeEventListener("careslot:changed", load); };
  }, [url, refreshKey, version]);
  return { data, error, loading, refresh };
}
