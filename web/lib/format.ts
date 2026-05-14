export function fmtTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export function pad(n: number, w = 3): string {
  return n.toString().padStart(w, "0");
}
