import assert from "node:assert/strict";
import { test } from "node:test";
import { birthDateLimits, classGroups, currentYear, gradeLabel, schoolYearOf, stageOf, todayInPakistan, yearStarting } from "./school.ts";

test("the school year runs from April to March, in Pakistan time", () => {
  assert.deepEqual(schoolYearOf(new Date("2026-10-25T12:00:00Z")), { name: "2026-27", startsOn: "2026-04-01", endsOn: "2027-03-31" });
  assert.equal(schoolYearOf(new Date("2027-03-31T12:00:00Z")).name, "2026-27");
  assert.equal(schoolYearOf(new Date("2027-03-31T19:30:00Z")).name, "2027-28");
  assert.equal(yearStarting(2099).name, "2099-00");
});

test("grades have plain names and are in four stages", () => {
  assert.equal(gradeLabel("kg-1"), "KG-1");
  assert.equal(gradeLabel("class-10"), "Class 10");
  assert.deepEqual(["playgroup", "kg-2", "class-1", "class-5", "class-6", "class-8", "class-9", "class-10"].map(stageOf), ["Pre-primary", "Pre-primary", "Primary", "Primary", "Middle", "Middle", "Secondary", "Secondary"]);
});

test("class pickers group the classes by stage, in grade order", () => {
  const c = (classId: string, grade: string) => ({ classId, version: 1, grade, students: 0 });
  assert.deepEqual(classGroups([c("a", "class-10"), c("b", "kg-1"), c("d", "class-2"), c("e", "class-1")], undefined, ", 2026-27"), [
    { group: "Pre-primary, 2026-27", items: [{ value: "b", label: "KG-1" }] },
    { group: "Primary, 2026-27", items: [{ value: "e", label: "Class 1" }, { value: "d", label: "Class 2" }] },
    { group: "Secondary, 2026-27", items: [{ value: "a", label: "Class 10" }] },
  ]);
});

test("a date of birth gives an age of 2 to 25 on the day", () => {
  assert.deepEqual(birthDateLimits("2026-10-25"), { min: "2000-10-26", max: "2024-10-25" });
  assert.deepEqual(birthDateLimits("2028-02-29"), { min: "2002-03-01", max: "2026-02-28" });
  assert.equal(todayInPakistan(new Date("2026-10-25T18:59:00Z")), "2026-10-25");
  assert.equal(todayInPakistan(new Date("2026-10-25T19:01:00Z")), "2026-10-26");
});

test("the current year contains today; else the last year that started; else the first year to come", () => {
  const years = ["2034-35", "2027-28", "2026-27", "2025-26"].map((name) => yearStarting(Number(name.slice(0, 4))));
  assert.equal(currentYear(years, "2026-10-31").name, "2026-27");
  assert.equal(currentYear(years, "2027-04-01").name, "2027-28");
  assert.equal(currentYear(years.filter((y) => y.name !== "2027-28"), "2028-06-01").name, "2026-27");
  assert.equal(currentYear(years.slice(0, 1), "2026-10-31").name, "2034-35");
  assert.equal(currentYear([], "2026-10-31"), undefined);
});
