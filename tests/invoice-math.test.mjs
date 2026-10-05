import test from 'node:test';
import assert from 'node:assert/strict';
import { hundredths, lineTotal, taxTotal, outstandingBalance } from '../lib/domain/invoice-math.ts';

test('decimal input rejects ambiguous, negative, excessive and over-precise amounts', () => {
  for (const value of ['-1', '1e3', '1,000', ' 1', '1.001', 'NaN', 'Infinity', '.1', '1.']) {
    assert.equal(hundredths(value, 9999999n), null, value);
  }
  assert.equal(hundredths('9999999.00', 9999999n), 999999900n);
  assert.equal(hundredths('9999999.01', 9999999n), null);
  assert.equal(hundredths('0.1', 9999999n), 10n);
});
test('decimal addition and tax avoid floating point drift', () => {
  const subtotal = hundredths('0.10', 9999999n) + hundredths('0.20', 9999999n);
  assert.equal(subtotal, 30n);
  assert.equal(subtotal + taxTotal(subtotal, 1000n), 33n);
});
test('fractional quantities round each charge half up', () => {
  assert.equal(lineTotal(150n, 101n), 152n);
  assert.equal(lineTotal(750n, 2700n), 20250n);
  assert.equal(lineTotal(0n, 2700n), 0n);
  assert.throws(() => lineTotal(-1n, 100n), RangeError);
});
test('TCS sample remains 486 dollars, and narrative amounts total 33.61 with 10% tax', () => {
  const sample = [750n, 0n, 200n, 150n, 600n, 100n].reduce((sum, quantity) => sum + lineTotal(quantity, 2700n), 0n);
  assert.equal(sample, 48600n);
  assert.equal(taxTotal(sample, 0n), 0n);
  const subtotal = 1025n + 2030n;
  assert.equal(taxTotal(subtotal, 1000n), 306n);
  assert.equal(subtotal + taxTotal(subtotal, 1000n), 3361n);
});
test('tax boundaries and half cent rounding are explicit', () => {
  assert.equal(taxTotal(5n, 1000n), 1n);
  assert.equal(taxTotal(100n, 10000n), 100n);
  assert.throws(() => taxTotal(100n, 10001n), RangeError);
  assert.throws(() => taxTotal(-1n, 0n), RangeError);
});
test('partial payments leave the exact balance and overpayments are rejected', () => {
  assert.equal(outstandingBalance(3361n, [1000n, 1000n]), 1361n);
  assert.equal(outstandingBalance(3361n, [3361n]), 0n);
  assert.throws(() => outstandingBalance(3361n, [3362n]), RangeError);
  assert.throws(() => outstandingBalance(3361n, [-1n]), RangeError);
});
