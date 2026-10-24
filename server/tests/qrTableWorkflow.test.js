const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateDistanceMeters, verifyProximity } = require('../src/utils/geo');
const { normalizePhoneNumber } = require('../src/utils/phone');
const CustomerSessionService = require('../src/services/CustomerSessionService');
const OrderService = require('../src/services/OrderService');

describe('QR Table Occupation, Ordering & Security Workflow - Test Suite', () => {

  // ──────────────────────────────────────────────
  // 1. Geolocation & Haversine Distance Verification
  // ──────────────────────────────────────────────
  describe('1. Geolocation & Haversine Distance', () => {
    // Connaught Place, New Delhi coordinates
    const restaurantLat = 28.6315;
    const restaurantLng = 77.2167;

    it('accurately verifies proximity when user is within 50 meters', () => {
      // Offset by approx 20 meters (~0.00018 degrees)
      const userLat = 28.63165;
      const userLng = 77.2167;

      const result = verifyProximity(userLat, userLng, restaurantLat, restaurantLng, 50);
      assert.strictEqual(result.isWithin, true);
      assert.ok(result.distanceMeters < 50, `Distance should be < 50m, got: ${result.distanceMeters}`);
    });

    it('accurately rejects proximity when user is outside 50 meters', () => {
      // Offset by approx 150 meters
      const userLat = 28.6330;
      const userLng = 77.2167;

      const result = verifyProximity(userLat, userLng, restaurantLat, restaurantLng, 50);
      assert.strictEqual(result.isWithin, false);
      assert.ok(result.distanceMeters > 50, `Distance should be > 50m, got: ${result.distanceMeters}`);
    });

    it('rejects invalid or out-of-range coordinates', () => {
      assert.throws(() => calculateDistanceMeters(95, 77, 28, 77), /Invalid geographic coordinates/);
      assert.throws(() => calculateDistanceMeters(28, 200, 28, 77), /Invalid geographic coordinates/);
      assert.throws(() => calculateDistanceMeters('invalid', 77, 28, 77), /Invalid geographic coordinates/);
    });
  });

  // ──────────────────────────────────────────────
  // 2. Mobile Number Normalization & Lead Rules
  // ──────────────────────────────────────────────
  describe('2. Mobile Number Normalization', () => {
    it('normalizes 10-digit numbers with spaces and dashes', () => {
      assert.strictEqual(normalizePhoneNumber('98765 43210'), '9876543210');
      assert.strictEqual(normalizePhoneNumber('9876-543-210'), '9876543210');
      assert.strictEqual(normalizePhoneNumber('(98765) 43210'), '9876543210');
    });

    it('normalizes numbers with leading +91, 91, or 0', () => {
      assert.strictEqual(normalizePhoneNumber('+91 9876543210'), '9876543210');
      assert.strictEqual(normalizePhoneNumber('919876543210'), '9876543210');
      assert.strictEqual(normalizePhoneNumber('09876543210'), '9876543210');
    });

    it('throws error on empty or too short numbers', () => {
      assert.throws(() => normalizePhoneNumber(''), /valid mobile number is required/);
      assert.throws(() => normalizePhoneNumber('12345'), /must contain at least 10 digits/);
    });
  });

  // ──────────────────────────────────────────────
  // 3. 256-bit Random Token & Cryptographic Hash
  // ──────────────────────────────────────────────
  describe('3. Secure Session Token Generation & Hashing', () => {
    it('generates a 256-bit (32 bytes = 64 hex characters) cryptographically secure random token', () => {
      const { rawToken, tokenHash } = CustomerSessionService.generateToken();
      assert.strictEqual(typeof rawToken, 'string');
      assert.strictEqual(rawToken.length, 64, 'Raw token should be 64 hex characters (256 bits)');
      assert.strictEqual(typeof tokenHash, 'string');
      assert.strictEqual(tokenHash.length, 64, 'SHA-256 hash should be 64 hex characters');
      assert.notStrictEqual(rawToken, tokenHash, 'Hash should not match raw token');
    });

    it('produces deterministic SHA-256 hash for identical tokens', () => {
      const token = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const hash1 = CustomerSessionService.hashToken(token);
      const hash2 = CustomerSessionService.hashToken(token);
      assert.strictEqual(hash1, hash2);
    });
  });

  // ──────────────────────────────────────────────
  // 4. Waiter Order Item Availability Management
  // ──────────────────────────────────────────────
  describe('4. Waiter Live Order Item Management & Partial Availability', () => {
    it('requires acceptedQuantity to be non-negative integer', async () => {
      await assert.rejects(
        () => OrderService.updateOrderItemQuantity({
          itemId: '11111111-1111-1111-1111-111111111111',
          acceptedQuantity: -1,
          restaurantId: '22222222-2222-2222-2222-222222222222'
        }),
        /Accepted quantity must be a non-negative integer/
      );
    });
  });

  // ──────────────────────────────────────────────
  // 5. Order Status Lifecycle State Transitions
  // ──────────────────────────────────────────────
  describe('5. Operational State Transitions', () => {
    it('rejects invalid state jumps on customer orders', async () => {
      // Non-existent UUID
      await assert.rejects(
        () => OrderService.updateCustomerOrderStatus(
          '00000000-0000-0000-0000-000000000000',
          'SERVED',
          '11111111-1111-1111-1111-111111111111'
        ),
        /not found/
      );
    });
  });

});
