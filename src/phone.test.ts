import assert from "node:assert/strict";
import { test } from "node:test";
import { isMobile, phoneAsTyped, toE164, toLocal } from "./phone.ts";

test("typing keeps only digits, stops at 11 and puts a space after the first 4", () => {
  assert.equal(phoneAsTyped("0300"), "0300");
  assert.equal(phoneAsTyped("03001"), "0300 1");
  assert.equal(phoneAsTyped("03001234567"), "0300 1234567");
  assert.equal(phoneAsTyped("0300 12345678999"), "0300 1234567");
  assert.equal(phoneAsTyped("0300-123 45a67"), "0300 1234567");
  assert.equal(phoneAsTyped(""), "");
});

test("a pasted +92 or 0092 number becomes the local form", () => {
  for (const input of ["+92 300 1234567", "923001234567", "0092 300 1234567"]) assert.equal(phoneAsTyped(input), "0300 1234567", input);
});

test("only 03 and 9 more digits is a mobile number", () => {
  assert.equal(isMobile("0300 1234567"), true);
  assert.equal(isMobile("03001234567"), true);
  for (const input of ["0300 123456", "0400 1234567", "1300 1234567", "+923001234567", "0300 12345678", "042 35761234", ""]) assert.equal(isMobile(input), false, input);
});

test("a mobile number becomes E.164; other input stays as typed, so the server can refuse it", () => {
  assert.equal(toE164("0300 1234567"), "+923001234567");
  assert.equal(toE164("0300 123"), "0300123");
  assert.equal(toE164("+442079460958"), "+442079460958");
});

test("a saved Pakistani number shows as typed in the office, and goes back to the same E.164", () => {
  assert.equal(toLocal("+923001234567"), "0300 1234567");
  assert.equal(toE164(toLocal("+923001234567")), "+923001234567");
  assert.equal(phoneAsTyped(toLocal("+923001234567")), "0300 1234567");
  assert.equal(toLocal("+442079460958"), "+442079460958");
});
