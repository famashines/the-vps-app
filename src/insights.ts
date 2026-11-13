import { monthsBetween } from "./cashflow.ts";

type Person = { firstName: string; lastName: string; admissionDate: string; leftOn: string | null };

export const admissionsByMonth = (students: Pick<Person, "admissionDate">[], from: string, today: string) =>
  monthsBetween(from, today).map((month) => ({ key: month, count: students.filter((s) => s.admissionDate.slice(0, 7) === month && s.admissionDate >= from && s.admissionDate <= today).length }));

export const leavers = <S extends Person>(students: S[], from: string) =>
  students.filter((s): s is S & { leftOn: string } => !!s.leftOn && s.leftOn >= from).sort((a, b) => b.leftOn.localeCompare(a.leftOn));

export type Activity = { eventId: string; eventType: string; occurredAt: string; payload: Record<string, any> };

const rupees = (money?: { amount: number }) => (money ? `Rs ${new Intl.NumberFormat("en-PK").format(money.amount / 100)}` : "");
const fullName = (p: Record<string, any>) => [p.firstName, p.lastName].filter(Boolean).join(" ");

const texts: Record<string, (p: Record<string, any>) => string> = {
  "admissions.StudentRegistered": (p) => `Student registered: ${fullName(p)} (${p.admissionNumber})`,
  "admissions.StudentDetailsUpdated": (p) => `Student details changed: ${fullName(p)}`,
  "admissions.StudentLeft": (p) => `Student marked as left on ${p.leftOn}`,
  "admissions.ClassOpened": (p) => `Class opened: ${p.grade}`,
  "admissions.AcademicYearOpened": (p) => `School year opened: ${p.name}`,
  "fees.PaymentReceived": (p) => `Payment received: ${rupees(p.amount)}, receipt ${p.receiptNumber}`,
  "fees.PaymentReversed": (p) => `Payment reversed: ${rupees(p.amount)}, receipt ${p.receiptNumber}`,
  "fees.ChargeReversed": (p) => `Charge reversed: ${rupees(p.amount)}`,
  "fees.FeeScheduleSet": (p) => `Fees set for ${p.grade}: ${rupees(p.monthlyFee)} a month`,
  "fees.ExpenseRecorded": (p) => `Expense recorded: ${rupees(p.amount)}, ${p.description}`,
  "fees.ExpenseReversed": (p) => `Expense reversed: ${rupees(p.amount)}`,
  "campus.StaffMemberAdded": (p) => `Staff member added: ${p.name}`,
  "campus.StudentAttendanceMarked": (p) => `Student attendance marked for ${p.date}: ${p.marks?.length ?? 0} students`,
  "campus.StaffAttendanceMarked": (p) => `Staff attendance marked for ${p.date}`,
};

export function activityText({ eventType, payload }: Pick<Activity, "eventType" | "payload">) {
  const known = texts[eventType];
  if (known) return known(payload ?? {});
  const words = eventType.slice(eventType.indexOf(".") + 1).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
