export type Records = Record<
  string,
  {
    score: number;
    lengthSegments: number;
    clicks: number;
    stars: number;
    level: number;
    penaltyPoints: number;
  }
>;
export function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export const RECORDS_KEY = "records-quotient-no-loops-v3";
export function record(code: string, result: Records[string]) {
  const records = load<Records>(RECORDS_KEY, {}),
    old = records[code];
  if (
    !old ||
    result.score > old.score ||
    (result.score === old.score && result.penaltyPoints > old.penaltyPoints)
  )
    records[code] = result;
  return save(RECORDS_KEY, records);
}
