import assert from "node:assert/strict";
import { test } from "node:test";
import { classesToday, entriesByDay, examAverage, isMember, lastDays, rate, rateByDay, resultsOf, stockAlerts, whatsAppLink, type Exam } from "./campus.ts";

const day = (classId: string, date: string, present: number, absent: number, leave: number) => ({ classId, date, present, absent, leave });

test("the rate uses only marked people; no mark is no rate, not 0%", () => {
  assert.equal(rate({ present: 18, absent: 1, leave: 1 }), 90);
  assert.equal(rate({ present: 0, absent: 3, leave: 0 }), 0);
  assert.equal(rate({ present: 0, absent: 0, leave: 0 }), undefined);
});

test("today by class: a class with no sheet is not marked and not in the rate", () => {
  const classes = [{ classId: "a", grade: "class-1" }, { classId: "b", grade: "class-2" }, { classId: "c", grade: "class-3" }];
  const t = classesToday([day("a", "2026-11-13", 9, 1, 0), day("b", "2026-11-13", 6, 2, 2), day("c", "2026-11-12", 0, 10, 0)], classes, "2026-11-13");
  assert.equal(t.markedClasses, 2);
  assert.equal(t.classes, 3);
  assert.equal(t.rate, 75);
  assert.equal(t.byClass[2].counts, undefined);
  assert.equal(classesToday([], classes, "2026-11-13").rate, undefined);
});

test("the rate for each of the last days, over the month border", () => {
  const days = lastDays("2026-11-02", 4);
  assert.deepEqual(days, ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  const rows = rateByDay([day("a", "2026-10-31", 8, 2, 0), day("b", "2026-10-31", 10, 0, 0), day("a", "2026-11-02", 1, 1, 0)], days);
  assert.deepEqual(rows.map((r) => r.rate), [undefined, 90, undefined, 50]);
});

const exam = (heldOn: string, results: Exam["results"], totalMarks = 50): Exam => ({ examId: heldOn, version: 1, name: "Test", kind: "monthly-test", classId: "a", subject: "Maths", heldOn, totalMarks, results });

test("the class average leaves out the absent students", () => {
  assert.equal(examAverage(exam("2026-11-01", [{ studentId: "s1", marks: 40 }, { studentId: "s2", marks: 20 }, { studentId: "s3", marks: null }])), 60);
  assert.equal(examAverage(exam("2026-11-01", [{ studentId: "s3", marks: null }])), undefined);
  assert.equal(examAverage(exam("2026-11-01", [])), undefined);
});

test("the results of one student, the newest first; absent has no percent", () => {
  const list = resultsOf([exam("2026-10-01", [{ studentId: "s1", marks: 45 }]), exam("2026-11-01", [{ studentId: "s1", marks: null }]), exam("2026-11-05", [{ studentId: "s2", marks: 1 }])], "s1");
  assert.deepEqual(list.map((r) => [r.exam.heldOn, r.marks, r.percent]), [["2026-11-01", null, undefined], ["2026-10-01", 45, 90]]);
});

test("stock: 0 is out, up to 2 is low, the emptiest first", () => {
  const item = (name: string, quantity: number) => ({ itemId: name, name, unit: "box", quantity });
  assert.deepEqual(stockAlerts([item("Chalk", 2), item("Markers", 0), item("Paper", 3)]).map((i) => [i.name, i.state]), [["Markers", "out"], ["Chalk", "low"]]);
});

test("a staff member is on the sheet from the joining day to the leaving day", () => {
  const s = { joinedOn: "2026-04-01", leftOn: "2026-10-31" };
  assert.deepEqual(["2026-03-31", "2026-04-01", "2026-10-31", "2026-11-01"].map((d) => isMember(s, d)), [false, true, true, false]);
  assert.equal(isMember({ joinedOn: "2026-04-01", leftOn: null }, "2030-01-01"), true);
});

test("calendar entries by first day, and the WhatsApp link has the encoded text", () => {
  const e = (title: string, startsOn: string) => ({ entryId: title, title, kind: "event", startsOn, endsOn: startsOn });
  assert.deepEqual(entriesByDay([e("B", "2026-12-02"), e("A", "2026-12-02"), e("C", "2026-12-01")]).map((d) => [d.date, d.entries.map((x) => x.title).join("")]), [["2026-12-01", "C"], ["2026-12-02", "AB"]]);
  assert.equal(whatsAppLink({ title: "Sports day", body: "On Saturday & Sunday" }), "https://wa.me/?text=Sports%20day%0A%0AOn%20Saturday%20%26%20Sunday");
});
