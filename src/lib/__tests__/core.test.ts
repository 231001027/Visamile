import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encryptField, decryptField } from "../encryption";
import { calculateTopupFee } from "../paymentFees";
import { rateLimit } from "../rateLimit";

describe("encryption", () => {
  it("passes through when ENCRYPTION_KEY is unset", () => {
    const plain = "P1234567";
    assert.equal(decryptField(plain), plain);
  });

  it("round-trips when ENCRYPTION_KEY is set", () => {
    process.env.ENCRYPTION_KEY = "test-secret-key-at-least-32-chars-long!!";
    const plain = "P9876543";
    const enc = encryptField(plain);
    assert.notEqual(enc, plain);
    assert.equal(decryptField(enc), plain);
    delete process.env.ENCRYPTION_KEY;
  });
});

describe("paymentFees", () => {
  it("matches PayU screenshot figures for ₹10,000 UPI top-up", () => {
    const fee = calculateTopupFee(10_000, "UPI");
    assert.equal(fee.gatewayFee, 2);
    assert.equal(fee.gatewayGst, 0.36);
    assert.equal(fee.totalPayable, 10_002.36);
  });
});

describe("rateLimit", () => {
  it("blocks after limit exceeded", () => {
    const key = `test-${Date.now()}`;
    assert.equal(rateLimit(key, { limit: 2, windowMs: 60_000 }).ok, true);
    assert.equal(rateLimit(key, { limit: 2, windowMs: 60_000 }).ok, true);
    assert.equal(rateLimit(key, { limit: 2, windowMs: 60_000 }).ok, false);
  });
});
