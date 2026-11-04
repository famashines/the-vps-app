import { signInUrl } from "./session.ts";

export const GRADES = [
  ["playgroup", "Playgroup"],
  ["kg-1", "KG-1"],
  ["kg-2", "KG-2"],
  ...Array.from({ length: 10 }, (_, i) => [`class-${i + 1}`, `Class ${i + 1}`]),
] as [string, string][];

const grades = (from: number, to: number) => GRADES.slice(from, to + 1).map(([grade]) => grade);
export const STAGES = [
  ["Pre-primary", grades(0, 2)],
  ["Primary", grades(3, 7)],
  ["Middle", grades(8, 10)],
  ["Secondary", grades(11, 12)],
] as [string, string[]][];

export const FAMILY_STATUSES = [
  ["both-parents-alive", "Both parents alive"],
  ["father-deceased", "Father deceased (orphan)"],
  ["mother-deceased", "Mother deceased"],
  ["both-parents-deceased", "Both parents deceased"],
] as [string, string][];

export const familyStatusLabel = (status: string) => FAMILY_STATUSES.find(([value]) => value === status)?.[1] ?? status;

export const gradeLabel = (grade: string) => GRADES.find(([value]) => value === grade)?.[1] ?? grade;
export const stageOf = (grade: string) => STAGES.find(([, list]) => list.includes(grade))?.[0];

export type SchoolClass = { classId: string; version: number; grade: string; students: number };
export type Year = { academicYearId: string; version: number; name: string; startsOn: string; endsOn: string; classes: SchoolClass[] };

export const classGroups = (classes: SchoolClass[], label = (c: SchoolClass) => gradeLabel(c.grade), suffix = "") =>
  STAGES.map(([stage, list]) => ({
    group: stage + suffix,
    items: list.flatMap((grade) => classes.filter((c) => c.grade === grade)).map((c) => ({ value: c.classId, label: label(c) })),
  })).filter((g) => g.items.length);
export type Answer = { ok: true; data: any } | { ok: false; status: number; message: string; fields: Record<string, string> };

export function schoolYearOf(today: Date) {
  const [year, month] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit" }).format(today).split("-").map(Number);
  return yearStarting(month >= 4 ? year : year - 1);
}

export function yearStarting(start: number) {
  return { name: `${start}-${String((start + 1) % 100).padStart(2, "0")}`, startsOn: `${start}-04-01`, endsOn: `${start + 1}-03-31` };
}

export const todayInPakistan = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(now);

export function currentYear<Y extends { startsOn: string; endsOn: string }>(years: Y[], today = todayInPakistan(new Date())) {
  const byStart = [...years].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return byStart.find((y) => y.startsOn <= today && today <= y.endsOn) ?? byStart.filter((y) => y.startsOn <= today).at(-1) ?? byStart[0];
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

function yearsBefore(today: string, years: number) {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y - years, m - 1, d));
  if (date.getUTCMonth() !== m - 1) date.setUTCDate(0);
  return date;
}

export function birthDateLimits(today: string, minAge = 2, maxAge = 25) {
  const earliest = yearsBefore(today, maxAge + 1);
  earliest.setUTCDate(earliest.getUTCDate() + 1);
  return { min: iso(earliest), max: iso(yearsBefore(today, minAge)) };
}

export const showDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export async function send(path: string, body: object, key: string, method: "POST" | "PUT" = "POST"): Promise<Answer> {
  try {
    const response = await fetch(path, { method, headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) });
    if (response.status === 401) {
      location.assign(signInUrl());
      return { ok: false, status: 401, message: "Sign in again.", fields: {} };
    }
    const data = await response.json().catch(() => ({}));
    if (response.ok) return { ok: true, data };
    const fields: Record<string, string> = {};
    for (const f of (data.fields ?? []) as { field: string; message: string }[]) fields[f.field] ??= f.message;
    return { ok: false, status: response.status, message: data.error ?? "The change was not saved. Try again.", fields };
  } catch {
    return { ok: false, status: 0, message: "The change was not saved, because the connection failed. Try again.", fields: {} };
  }
}

export const isStale = (answer: Answer) => !answer.ok && answer.status === 409 && answer.message.includes("someone else");
