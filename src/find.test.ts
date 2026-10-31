import assert from "node:assert/strict";
import test from "node:test";
import { findsStudent } from "./find.ts";

const usman = { admissionNumber: "2026-0006", firstName: "Usman", lastName: "Sheikh", fatherName: "Second Father", guardian: { name: "Nadia Sheikh", phone: "+923007778899" } };

test("finds a student by name, father name, guardian and admission number", () => {
  for (const query of ["usman", "Usman Sheikh", "second father", "nadia", "2026-0006", "0006", "  USMAN "]) assert.ok(findsStudent(usman, query), query);
});

test("finds a student by phone in any format", () => {
  for (const query of ["0300 777", "03007778899", "+92 300 7778899", "923007778899", "7778899"]) assert.ok(findsStudent(usman, query), query);
});

test("does not find a student that does not match", () => {
  for (const query of ["ayesha", "0321", "12", "2025-0006"]) assert.ok(!findsStudent(usman, query), query);
});
