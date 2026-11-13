import assert from "node:assert/strict";
import { test } from "node:test";
import { expenseTotals, flowByDay, flowByMonth, moneyFigures, monthRange, monthsBetween, type Expense, type FlowDay } from "./cashflow.ts";

const rs = (rupees: number) => ({ amount: rupees * 100, currency: "PKR" as const });
const day = (date: string, charged: number, received: number, refunded: number, spent: number): FlowDay => ({ date, charged: rs(charged), received: rs(received), refunded: rs(refunded), spent: rs(spent) });
const days = [day("2026-04-10", 9000, 4000, 0, 1000), day("2026-10-28", 0, 5000, 0, 0), day("2026-11-01", 4500, 2000, 0, 700), day("2026-11-13", 0, 3000, 5000, 300)];

test("the figures of the year, the month and today; a refund lowers the income of its day", () => {
  const f = moneyFigures(days, "2026-04-01", "2026-11-13");
  assert.deepEqual(f.year, { charged: 1350000, income: 900000, spent: 200000 });
  assert.deepEqual(f.month, { charged: 450000, income: 0, spent: 100000 });
  assert.deepEqual(f.today, { charged: 0, income: -200000, spent: 30000 });
  assert.deepEqual(moneyFigures([], "2026-04-01", "2026-11-13").today, { charged: 0, income: 0, spent: 0 });
});

test("each month of the period has a row, also a month with no money", () => {
  assert.deepEqual(monthsBetween("2026-11-20", "2027-02-01"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  const months = flowByMonth(days, "2026-04-01", "2026-11-13");
  assert.equal(months.length, 8);
  assert.deepEqual(months[0], { key: "2026-04", charged: 900000, income: 400000, spent: 100000 });
  assert.deepEqual(months[1], { key: "2026-05", charged: 0, income: 0, spent: 0 });
  assert.equal(months.reduce((total, m) => total + m.income, 0), moneyFigures(days, "2026-04-01", "2026-11-13").year.income);
});

test("the days of the current month, up to today", () => {
  const list = flowByDay(days, "2026-11-13");
  assert.equal(list.length, 13);
  assert.deepEqual(list[0], { key: "2026-11-01", charged: 450000, income: 200000, spent: 70000 });
  assert.equal(list[12].income, -200000);
});

test("expense totals leave out the reversed expenses; the largest category is first", () => {
  const expense = (category: string, rupees: number, reversed = false): Expense => ({
    expenseId: category + rupees, spentOn: "2026-11-01", category, amount: rs(rupees), description: "x", recordedAt: "", recordedBy: "",
    ...(reversed && { reversal: { reversedAt: "", reason: "twice" } }),
  });
  const totals = expenseTotals([expense("rent", 500), expense("salaries", 900), expense("salaries", 100), expense("rent", 5000, true)]);
  assert.equal(totals.total, 150000);
  assert.deepEqual(totals.byCategory, [{ category: "salaries", amount: 100000 }, { category: "rent", amount: 50000 }]);
});

test("the first and last day of a month", () => {
  assert.deepEqual(monthRange("2026-11"), { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(monthRange("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
});
