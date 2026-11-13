import assert from "node:assert/strict";
import { test } from "node:test";
import { showMoney, toPaisa } from "./money.ts";

test("money shows as whole rupees with thousands separators, paisa only when there are any", () => {
  assert.equal(showMoney({ amount: 450000, currency: "PKR" }), "Rs 4,500");
  assert.equal(showMoney({ amount: 10000000, currency: "PKR" }), "Rs 100,000");
  assert.equal(showMoney({ amount: 450050, currency: "PKR" }), "Rs 4,500.5");
  assert.equal(showMoney({ amount: -50000, currency: "PKR" }), "Rs 500");
  assert.equal(showMoney({ amount: 0, currency: "PKR" }), "Rs 0");
});

test("typed rupees become paisa; anything else is refused", () => {
  for (const [input, paisa] of [["4500", 450000], ["4,500", 450000], ["Rs 4,500", 450000], ["rs. 10 000", 1000000], ["0", 0]] as const) {
    assert.equal(toPaisa(input), paisa, input);
  }
  for (const input of ["", "4500.50", "-100", "4.5k", "abc", "1234567890"]) assert.equal(toPaisa(input), undefined, input);
});
