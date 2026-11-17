/** Finds cooking durations in a step ("asse por 25 a 30 minutos", "deixe 1h30 na geladeira"). */
export interface FoundDuration {
  /** Seconds (the upper bound of a range like "25 a 30 minutos"). */
  seconds: number;
  label: string;
}

const UNIT = String.raw`(h|hr|hrs|hora|horas|min|mins|minuto|minutos|s|seg|segundo|segundos)\b`;
const RANGE = new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*(?:a|-|–|ou)\s*(\d+(?:[.,]\d+)?)\s*${UNIT}`, 'i');
const HOURS_MIN = /(\d+)\s*h\s*(\d{1,2})\b(?:\s*min)?/i;
const SINGLE = new RegExp(String.raw`(\d+(?:[.,]\d+)?)\s*${UNIT}`, 'i');

function toSeconds(value: string, unit: string) {
  const n = Number(value.replace(',', '.'));
  const u = unit.toLowerCase();
  if (u.startsWith('h')) return n * 3600;
  if (u.startsWith('m')) return n * 60;
  return n;
}

export function findDuration(text: string): FoundDuration | null {
  const hm = HOURS_MIN.exec(text);
  if (hm) {
    const seconds = Number(hm[1]) * 3600 + Number(hm[2]) * 60;
    return { seconds, label: durationLabel(seconds) };
  }
  const range = RANGE.exec(text);
  if (range) {
    const seconds = toSeconds(range[2], range[3]);
    if (seconds > 0) return { seconds, label: durationLabel(seconds) };
  }
  const single = SINGLE.exec(text);
  if (single) {
    const seconds = toSeconds(single[1], single[2]);
    // "200 °C" or "3 cm" never get here; still, ignore absurd values.
    if (seconds > 0 && seconds <= 24 * 3600) return { seconds, label: durationLabel(seconds) };
  }
  return null;
}

/** "40 min", "1h30", "2h", "10 s" */
export function durationLabel(seconds: number) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** Countdown display: "1:05", "1:02:05". */
export function formatTimer(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
