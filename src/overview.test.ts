import assert from "node:assert/strict";
import test from "node:test";
import { feeParts, feesByStage, overview, roundUp, smoothLine, wavyRing } from "./overview.ts";

const rs = (amount: number) => ({ amount, currency: "PKR" as const });
const year = { academicYearId: "y", version: 1, name: "2026-27", startsOn: "2026-04-01", endsOn: "2027-03-31", classes: [{ classId: "c3", version: 1, grade: "class-3", students: 3 }, { classId: "k1", version: 1, grade: "kg-1", students: 0 }] };
const student = (studentId: string, over = {}) => ({ studentId, gender: "female", bFormNumber: "x", leftOn: null, enrollments: [{ academicYearId: "y", grade: "class-3" }], ...over });
const account = (studentId: string, balance: number, overdue: number, academicYearId = "y", charged = 100) =>
  ({ accountId: studentId, studentId, academicYearId, academicYearName: "2026-27", classId: "c3", grade: "class-3", openedOn: "2026-04-01", charged: rs(charged), paid: rs(charged - balance), balance: rs(balance), overdue: rs(overdue) });

test("the overview counts active students only", () => {
  const o = overview([student("a"), student("gone", { leftOn: "2026-06-01" }), student("new", { enrollments: [], gender: "male", bFormNumber: null })], year, []);
  assert.deepEqual([o.active.length, o.inClass, o.noClass, o.missingBForm, o.girls, o.boys], [2, 1, 1, 1, 1, 1]);
});

test("the classes are in grade order, with empty classes and no closed grades", () => {
  const o = overview([student("a"), student("b")], year, []);
  assert.deepEqual(o.classes.map((c) => [c.grade, c.stage, c.students]), [["kg-1", "Pre-primary", 0], ["class-3", "Primary", 2]]);
  assert.deepEqual(o.stages, [{ stage: "Pre-primary", students: 0 }, { stage: "Primary", students: 2 }, { stage: "Middle", students: 0 }, { stage: "Secondary", students: 0 }]);
});

test("late students come largest first, and only for this year and active students", () => {
  const o = overview([student("small"), student("big"), student("old"), student("gone", { leftOn: "2026-06-01" }), student("paid")], year, [account("small", 10, 10), account("big", 50, 50), account("old", 90, 90, "other"), account("gone", 99, 99), account("paid", 0, 0)]);
  assert.deepEqual(o.late.map((l) => [l.student.studentId, l.amount, l.grade]), [["big", 50, "class-3"], ["small", 10, "class-3"]]);
});

test("paid up counts active students who were charged and owe nothing", () => {
  const o = overview([student("paid"), student("credit"), student("owes"), student("free"), student("gone", { leftOn: "2026-06-01" })], year, [account("paid", 0, 0), account("credit", -5, 0), account("owes", 5, 0), account("free", 0, 0, "y", 0), account("gone", 0, 0)]);
  assert.deepEqual([o.billed, o.paidUp], [3, 2]);
});

test("the fee parts add up to the charged amount", () => {
  assert.deepEqual(feeParts({ charged: 1000, remaining: 600, overdue: 200 }), { settled: 400, notDue: 400, late: 200 });
});

test("fees by stage add the classes and skip a stage with no fees", () => {
  const rows = [{ grade: "class-1", charged: 10, collected: 5, overdue: 1 }, { grade: "class-2", charged: 20, collected: 10, overdue: 2 }, { grade: "class-9", charged: 40, collected: 40, overdue: 0 }];
  assert.deepEqual(feesByStage(rows), [{ stage: "Primary", charged: 30, collected: 15, overdue: 3 }, { stage: "Secondary", charged: 40, collected: 40, overdue: 0 }]);
});

test("a chart maximum rounds up to a tidy number", () => {
  assert.deepEqual([0, 34, 100, 101, 1_234_000].map(roundUp), [1, 40, 100, 150, 1_500_000]);
});

test("the wavy ring starts at the top and stops at the share", () => {
  const ring = wavyRing(0.25, { amplitude: 0 });
  assert.ok(ring.startsWith("M50.00 10.00"));
  assert.ok(ring.endsWith("L90.00 50.00"));
  assert.ok(wavyRing(2, { amplitude: 0 }).endsWith("L50.00 10.00"));
});

test("a smooth line goes through each point", () => {
  assert.equal(smoothLine([[0, 10], [50, 20], [100, 5]]), "M0 10C25 10 25 20 50 20C75 20 75 5 100 5");
});
