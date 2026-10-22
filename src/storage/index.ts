export type Records = Record<
  string,
  { length: number; stars: number; level: number }
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
export function record(code: string, length: number, stars: number, level = 0) {
  const records = load<Records>("records", {});
  if (!records[code] || length < records[code].length)
    records[code] = { length, stars, level };
  return save("records", records);
}
