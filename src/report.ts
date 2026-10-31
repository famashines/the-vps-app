import type { AccountSummary } from "./fees.ts";
import { GRADES } from "./school.ts";

export type Totals = { accounts: number; charged: number; collected: number; remaining: number; credit: number; overdue: number };

const empty = (): Totals => ({ accounts: 0, charged: 0, collected: 0, remaining: 0, credit: 0, overdue: 0 });
const overdueOf = (a: AccountSummary) => a.overdue?.amount ?? 0;
const rank = (grade: string) => {
  const i = GRADES.findIndex(([g]) => g === grade);
  return i < 0 ? GRADES.length : i;
};

function add(t: Totals, a: AccountSummary) {
  t.accounts += 1;
  t.charged += a.charged.amount;
  t.collected += a.paid.amount;
  t.remaining += Math.max(a.balance.amount, 0);
  t.credit += Math.max(-a.balance.amount, 0);
  t.overdue += overdueOf(a);
}

export function feeReport(accounts: AccountSummary[]) {
  const total = empty();
  const grades = new Map<string, Totals>();
  for (const a of accounts) {
    add(total, a);
    if (!grades.has(a.grade)) grades.set(a.grade, empty());
    add(grades.get(a.grade)!, a);
  }
  const byGrade = [...grades].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)).map(([grade, t]) => ({ grade, ...t }));
  const defaulters = accounts.filter((a) => overdueOf(a) > 0).sort((a, b) => overdueOf(b) - overdueOf(a) || b.balance.amount - a.balance.amount);
  return { total, byGrade, defaulters };
}

export const share = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : undefined);
