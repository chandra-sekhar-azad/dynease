/**
 * Mobile Number Normalization Utility
 * Normalizes phone numbers to standard canonical format for leads identification
 */

/**
 * Normalizes an Indian or international mobile number.
 * Removes spaces, hyphens, parentheses, and leading +91 or 0 for standard 10-digit Indian numbers.
 * @param {string} rawPhone
 * @returns {string} Normalized phone number
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    throw new Error('A valid mobile number is required.');
  }

  // Remove all non-numeric characters except leading '+' if international
  let digits = rawPhone.trim().replace(/[^\d+]/g, '');

  // Strip international prefix '+91' or '91' for 10-digit Indian numbers
  if (digits.startsWith('+91') && digits.length === 13) {
    digits = digits.substring(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.substring(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.substring(1);
  }

  // Final validation: must be at least 10 digits
  if (digits.replace(/\D/g, '').length < 10) {
    throw new Error('Mobile number must contain at least 10 digits.');
  }

  return digits;
}

module.exports = {
  normalizePhoneNumber
};
