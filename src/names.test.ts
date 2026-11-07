import assert from "node:assert/strict";
import { test } from "node:test";
import { capitalizeWords } from "./names.ts";

test("the first letter of each word becomes a capital, the other letters stay as typed", () => {
  assert.equal(capitalizeWords("muhammad ali"), "Muhammad Ali");
  assert.equal(capitalizeWords("ayesha  khan "), "Ayesha  Khan ");
  assert.equal(capitalizeWords("syed-zain McDonald"), "Syed-Zain McDonald");
  assert.equal(capitalizeWords("ALI"), "ALI");
  assert.equal(capitalizeWords(""), "");
});
