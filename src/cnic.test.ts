import assert from "node:assert/strict";
import { test } from "node:test";
import { toCnic } from "./cnic.ts";

test("13 digits become 12345-1234567-1, with or without dashes and spaces", () => {
  for (const input of ["3520212345678", "35202-1234567-8", "35202 1234567 8", " 35202-1234567-8 "]) {
    assert.equal(toCnic(input), "35202-1234567-8", input);
  }
});

test("other input stays as typed, so the server can refuse it", () => {
  assert.equal(toCnic("35202-123"), "35202-123");
  assert.equal(toCnic("3520212345678x"), "3520212345678x");
});
