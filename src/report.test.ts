import assert from "node:assert/strict";
import { test } from "node:test";
import type { AccountSummary } from "./fees.ts";
import { feeReport, share } from "./report.ts";

const rs = (n: number) => ({ amount: n * 100, currency: "PKR" as const });
const account = (id: string, grade: string, charged: number, paid: number, overdue?: number): AccountSummary => ({
  accountId: id, studentId: `s-${id}`, academicYearId: "y", academicYearName: "2026-27", classId: `c-${grade}`, grade, openedOn: "2026-04-01",
  charged: rs(charged), paid: rs(paid), balance: rs(charged - paid), ...(overdue !== undefined && { overdue: rs(overdue) }),
});

const accounts = [
  account("a", "class-3", 20500, 5000, 10000),
  account("b", "class-3", 20500, 20500, 0),
  account("c", "kg-1", 9000, 12000, 0),
  account("d", "class-10", 15000, 0, 15000),
  account("e", "class-3", 4500, 0),
];

test("the totals are the sums of the accounts, and charged - collected = remaining - credit", () => {
  const { total } = feeReport(accounts);
  assert.deepEqual(total, { accounts: 5, charged: 6950000, collected: 3750000, remaining: 3500000, credit: 300000, overdue: 2500000 });
  assert.equal(total.charged - total.collected, total.remaining - total.credit);
});

test("by grade: in the order of the grades, and the rows add up to the totals", () => {
  const { total, byGrade } = feeReport(accounts);
  assert.deepEqual(byGrade.map((g) => [g.grade, g.accounts, g.remaining / 100]), [["kg-1", 1, 0], ["class-3", 3, 20000], ["class-10", 1, 15000]]);
  for (const key of ["accounts", "charged", "collected", "remaining", "credit", "overdue"] as const) {
    assert.equal(byGrade.reduce((n, g) => n + g[key], 0), total[key], key);
  }
});

test("defaulters: only overdue above 0, the most overdue first; no overdue field counts as 0", () => {
  assert.deepEqual(feeReport(accounts).defaulters.map((a) => a.accountId), ["d", "a"]);
  assert.deepEqual(feeReport([]).defaulters, []);
});

test("share: a whole percent, and nothing when there is nothing to share", () => {
  assert.equal(share(3750000, 6950000), 54);
  assert.equal(share(0, 0), undefined);
});
