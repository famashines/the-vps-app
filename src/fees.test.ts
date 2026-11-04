import assert from "node:assert/strict";
import { test } from "node:test";
import { chargeLabel, ledger, type Charge, type Payment } from "./fees.ts";

const rs = (n: number) => ({ amount: n * 100, currency: "PKR" as const });
const charge = (kind: Charge["kind"], amount: number, dueOn: string, extra: Partial<Charge> = {}): Charge => ({ chargeId: `${kind}${dueOn}`, kind, amount: rs(amount), dueOn, ...extra });
const payment = (amount: number, receivedAt: string, extra: Partial<Payment> = {}): Payment => ({
  paymentId: receivedAt, receiptNumber: "R-2026-27-000001", amount: rs(amount), method: "cash", receivedAt, receivedBy: "u1", ...extra,
});

test("the ledger is in date order, charges before payments on the same day, with a running balance", () => {
  const lines = ledger({
    charges: [charge("annual", 6000, "2026-10-26"), charge("monthly", 4500, "2026-10-25", { month: "2026-10" }), charge("admission", 10000, "2026-10-26")],
    payments: [payment(5000, "2026-10-26T05:00:00Z")],
  });
  assert.deepEqual(lines.map((l) => [l.date, l.charge ? chargeLabel(l.charge) : "payment", l.balance / 100]), [
    ["2026-10-25", "Monthly fee, October 2026", 4500],
    ["2026-10-26", "Annual fee", 10500],
    ["2026-10-26", "Admission fee", 20500],
    ["2026-10-26", "payment", 15500],
  ]);
});

test("a reversed entry stays in the ledger but does not change the balance", () => {
  const lines = ledger({
    charges: [charge("admission", 10000, "2026-10-26", { reversal: { reversedAt: "2026-10-27T05:00:00Z", reason: "Sibling" } })],
    payments: [payment(5000, "2026-10-26T20:00:00Z", { reversal: { reversedAt: "2026-10-27T05:00:00Z", reason: "Entered twice" } }), payment(1000, "2026-10-28T05:00:00Z")],
  });
  assert.deepEqual(lines.map((l) => [l.date, l.balance / 100]), [["2026-10-26", 0], ["2026-10-27", 0], ["2026-10-28", -1000]]);
});
