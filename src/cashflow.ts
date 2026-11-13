import type { Money } from "./money.ts";

export type FlowDay = { date: string; charged: Money; received: Money; refunded: Money; spent: Money };
export type Flow = { charged: number; income: number; spent: number };
export type Expense = {
  expenseId: string;
  spentOn: string;
  category: string;
  amount: Money;
  description: string;
  paidTo?: string;
  recordedAt: string;
  recordedBy: string;
  reversal?: { reversedAt: string; reason: string };
};

export const EXPENSE_CATEGORIES = [
  ["salaries", "Salaries"],
  ["rent", "Rent"],
  ["utilities", "Utilities"],
  ["supplies", "Supplies"],
  ["maintenance", "Maintenance"],
  ["transport", "Transport"],
  ["events", "Events"],
  ["other", "Other"],
] as [string, string][];

export const categoryLabel = (category: string) => EXPENSE_CATEGORIES.find(([value]) => value === category)?.[1] ?? category;

const sum = (days: FlowDay[], from: string, to: string): Flow =>
  days.reduce(
    (total, d) =>
      d.date < from || d.date > to
        ? total
        : { charged: total.charged + d.charged.amount, income: total.income + d.received.amount - d.refunded.amount, spent: total.spent + d.spent.amount },
    { charged: 0, income: 0, spent: 0 },
  );

export function moneyFigures(days: FlowDay[], yearStartsOn: string, today: string) {
  return { year: sum(days, yearStartsOn, today), month: sum(days, `${today.slice(0, 7)}-01`, today), today: sum(days, today, today) };
}

export function monthsBetween(from: string, to: string) {
  const months: string[] = [];
  let [y, m] = from.split("-").map(Number);
  for (let month = from.slice(0, 7); month <= to.slice(0, 7); month = `${y}-${String(m).padStart(2, "0")}`) {
    months.push(month);
    [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
  }
  return months;
}

export const flowByMonth = (days: FlowDay[], from: string, to: string) =>
  monthsBetween(from, to).map((month) => ({ key: month, ...sum(days, later(`${month}-01`, from), earlier(`${month}-31`, to)) }));

export function flowByDay(days: FlowDay[], today: string) {
  const month = today.slice(0, 7);
  return Array.from({ length: Number(today.slice(8)) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { key: date, ...sum(days, date, date) };
  });
}

const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);

export function expenseTotals(expenses: Expense[]) {
  const counted = expenses.filter((e) => !e.reversal);
  const byCategory = EXPENSE_CATEGORIES.map(([category]) => ({
    category,
    amount: counted.filter((e) => e.category === category).reduce((total, e) => total + e.amount.amount, 0),
  })).filter((c) => c.amount > 0);
  return { total: byCategory.reduce((total, c) => total + c.amount, 0), byCategory: byCategory.sort((a, b) => b.amount - a.amount) };
}

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}` };
}
