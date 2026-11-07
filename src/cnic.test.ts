import assert from "node:assert/strict";
import { test } from "node:test";
import { cnicAsTyped, toCnic } from "./cnic.ts";

test("13 digits become 12345-1234567-1, with or without dashes and spaces", () => {
  for (const input of ["3520212345678", "35202-1234567-8", "35202 1234567 8", " 35202-1234567-8 "]) {
    assert.equal(toCnic(input), "35202-1234567-8", input);
  }
});

test("other input stays as typed, so the server can refuse it", () => {
  assert.equal(toCnic("35202-123"), "35202-123");
  assert.equal(toCnic("3520212345678x"), "3520212345678x");
});

test("while typing, the dashes come after digit 5 and digit 12, and other characters go", () => {
  assert.equal(cnicAsTyped(""), "");
  assert.equal(cnicAsTyped("3520"), "3520");
  assert.equal(cnicAsTyped("35202"), "35202");
  assert.equal(cnicAsTyped("352021"), "35202-1");
  assert.equal(cnicAsTyped("352021234567"), "35202-1234567");
  assert.equal(cnicAsTyped("3520212345678"), "35202-1234567-8");
  assert.equal(cnicAsTyped("35202-1234567-89"), "35202-1234567-8");
  assert.equal(cnicAsTyped("35202 12a34567-8"), "35202-1234567-8");
});
