// Historical experimental wave/wind comparison, not probability or safety.
function waveScore(h) {
  if (h == null) return null;
  if (h < 0.2) return 45;
  if (h < 0.5) return 75;
  if (h <= 1.2) return 100;
  if (h <= 1.8) return 60;
  if (h <= 2.5) return 25;
  return 5;
}
function windScore(kmh, gust) {
  if (kmh == null) return null;
  let s = kmh < 8 ? 95 : kmh < 14 ? 85 : kmh < 20 ? 65 : kmh < 28 ? 40 : 15;
  if (gust != null && gust > 35) s = Math.min(s, 30);
  return s;
}
export function windowScore(waveH, windKmh, gust) {
  const w = waveScore(waveH), v = windScore(windKmh, gust);
  // Withhold inference when an essential factor is missing: a score built from wind alone
  // (or waves alone) looks identical to a full score and would be false confidence.
  if (w == null || v == null) return null;
  return Math.round(0.55 * w + 0.45 * v);
}
