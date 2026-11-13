import assert from "node:assert/strict";
import { test } from "node:test";
import { activityText, admissionsByMonth, leavers } from "./insights.ts";

const student = (admissionDate: string, leftOn: string | null = null) => ({ firstName: "A", lastName: admissionDate, admissionDate, leftOn });

test("admissions for each month of the school year up to today", () => {
  const months = admissionsByMonth([student("2026-04-01"), student("2026-04-20"), student("2026-06-02"), student("2025-06-02"), student("2026-12-01")], "2026-04-01", "2026-07-15");
  assert.deepEqual(months, [{ key: "2026-04", count: 2 }, { key: "2026-05", count: 0 }, { key: "2026-06", count: 1 }, { key: "2026-07", count: 0 }]);
});

test("the students who left in the school year, the newest first", () => {
  const list = leavers([student("2026-04-01", "2026-05-10"), student("2026-04-02"), student("2025-04-01", "2026-03-20"), student("2026-04-03", "2026-09-01")], "2026-04-01");
  assert.deepEqual(list.map((s) => s.leftOn), ["2026-09-01", "2026-05-10"]);
});

test("an event becomes a sentence; an unknown type becomes its words", () => {
  assert.equal(activityText({ eventType: "fees.PaymentReceived", payload: { amount: { amount: 450000 }, receiptNumber: "R-2026-27-000001" } }), "Payment received: Rs 4,500, receipt R-2026-27-000001");
  assert.equal(activityText({ eventType: "admissions.StudentRegistered", payload: { firstName: "Ayesha", lastName: "Khan", admissionNumber: "2026-0001" } }), "Student registered: Ayesha Khan (2026-0001)");
  assert.equal(activityText({ eventType: "admissions.StudentClassChanged", payload: {} }), "Student class changed");
});
