export type Status = "present" | "absent" | "leave";
export type Counts = { present: number; absent: number; leave: number };
export type ClassDay = Counts & { classId: string; date: string };
export type StaffDay = Counts & { date: string };
export type Summary = { students: ClassDay[]; staff: StaffDay[] };
export type Sheet<K extends string> = { sheetId: string; classId?: string; date: string; version: number; marks: ({ status: Status } & Record<K, string>)[] };
export type StaffMember = { staffId: string; version: number; name: string; role: string; phone: string | null; joinedOn: string; leftOn: string | null };
export type Exam = {
  examId: string;
  version: number;
  name: string;
  kind: "monthly-test" | "exam";
  classId: string;
  subject: string;
  heldOn: string;
  totalMarks: number;
  results: { studentId: string; marks: number | null }[];
};
export type StockItem = { itemId: string; name: string; unit: string; quantity: number };
export type Movement = { movementId: string; itemId: string; change: number; quantity: number; reason: string; recordedAt: string };
export type CalendarEntry = { entryId: string; title: string; kind: string; startsOn: string; endsOn: string };
export type Notice = { noticeId: string; title: string; body: string; audience: string; publishedAt: string };

export const STATUSES = [
  ["present", "Present"],
  ["absent", "Absent"],
  ["leave", "Leave"],
] as [Status, string][];
export const STAFF_ROLES = [
  ["teacher", "Teacher"],
  ["office", "Office"],
  ["support", "Support"],
] as [string, string][];
export const ENTRY_KINDS = [
  ["holiday", "Holiday"],
  ["exam", "Exam"],
  ["event", "Event"],
  ["meeting", "Meeting"],
] as [string, string][];
export const AUDIENCES = [
  ["everyone", "Everyone"],
  ["parents", "Parents"],
  ["staff", "Staff"],
] as [string, string][];
export const EXAM_KINDS = [
  ["monthly-test", "Monthly test"],
  ["exam", "Exam"],
] as [string, string][];
export const labelOf = (list: [string, string][], value: string) => list.find(([v]) => v === value)?.[1] ?? value;

export const LOW_STOCK = 2;

const add = (a: Counts, b: Counts): Counts => ({ present: a.present + b.present, absent: a.absent + b.absent, leave: a.leave + b.leave });
const none: Counts = { present: 0, absent: 0, leave: 0 };
export const total = (rows: Counts[]) => rows.reduce(add, none);
export const marked = (c: Counts) => c.present + c.absent + c.leave;

export function rate(c: Counts) {
  const all = marked(c);
  return all > 0 ? Math.round((c.present / all) * 100) : undefined;
}

export function classesToday(rows: ClassDay[], classes: { classId: string; grade: string }[], date: string) {
  const byClass = classes.map((c) => ({ ...c, counts: rows.find((r) => r.classId === c.classId && r.date === date) }));
  const done = byClass.flatMap((c) => (c.counts ? [c.counts] : []));
  return { byClass, markedClasses: done.length, classes: classes.length, counts: total(done), rate: rate(total(done)) };
}

export function lastDays(today: string, count: number) {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

export const rateByDay = (rows: (Counts & { date: string })[], days: string[]) =>
  days.map((date) => {
    const counts = total(rows.filter((r) => r.date === date));
    return { date, counts, rate: rate(counts) };
  });

export const percent = (marks: number, totalMarks: number) => Math.round((marks / totalMarks) * 100);

export function examAverage(exam: Pick<Exam, "results" | "totalMarks">) {
  const sat = exam.results.flatMap((r) => (r.marks === null ? [] : [r.marks]));
  return sat.length ? percent(sat.reduce((sum, m) => sum + m, 0) / sat.length, exam.totalMarks) : undefined;
}

export const resultsOf = (exams: Exam[], studentId: string) =>
  exams
    .flatMap((exam) => {
      const result = exam.results.find((r) => r.studentId === studentId);
      return result ? [{ exam, marks: result.marks, percent: result.marks === null ? undefined : percent(result.marks, exam.totalMarks) }] : [];
    })
    .sort((a, b) => b.exam.heldOn.localeCompare(a.exam.heldOn));

export const stockAlerts = (items: StockItem[]) =>
  items
    .filter((i) => i.quantity <= LOW_STOCK)
    .map((i) => ({ ...i, state: i.quantity === 0 ? ("out" as const) : ("low" as const) }))
    .sort((a, b) => a.quantity - b.quantity || a.name.localeCompare(b.name));

export const isMember = (s: Pick<StaffMember, "joinedOn" | "leftOn">, date: string) => s.joinedOn <= date && (!s.leftOn || s.leftOn >= date);

export function entriesByDay(entries: CalendarEntry[]) {
  const days = new Map<string, CalendarEntry[]>();
  for (const e of [...entries].sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.title.localeCompare(b.title))) {
    days.set(e.startsOn, [...(days.get(e.startsOn) ?? []), e]);
  }
  return [...days].map(([date, list]) => ({ date, entries: list }));
}

export const whatsAppLink = (n: Pick<Notice, "title" | "body">) => `https://wa.me/?text=${encodeURIComponent(`${n.title}\n\n${n.body}`)}`;
