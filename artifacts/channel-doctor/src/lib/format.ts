export function compactNumber(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K";
  return String(Math.round(n));
}

export function pct(n: number | null | undefined, places = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return (n * 100).toFixed(places) + "%";
}

export function formatDate(s: string | Date): string {
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dayOfWeek(n: number): string {
  return DOW[((n % 7) + 7) % 7];
}

export function healthColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-cyan-400";
  if (score >= 40) return "text-amber-400";
  return "text-rose-400";
}

export function healthBadge(score: number): string {
  if (score >= 80) return "Thriving";
  if (score >= 60) return "Healthy";
  if (score >= 40) return "Warning";
  return "Critical";
}
