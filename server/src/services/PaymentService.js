/**
 * Provider-Agnostic Payment Service Abstraction
 * Handles subscription checkout sessions, webhook signature verification,
 * and pending payment states. Ready for Razorpay or Stripe configuration.
 */
class PaymentService {
  constructor() {
    this.provider = process.env.PAYMENT_PROVIDER || 'manual'; // 'manual' | 'razorpay' | 'stripe'
  }

  /**
   * Initializes a pending payment transaction for a plan upgrade/renewal
   */
  async createPaymentSession({ restaurantId, plan, billingCycle, ownerEmail, ownerPhone }) {
    const amountPaise = billingCycle === 'yearly' ? plan.yearlyPricePaise : plan.monthlyPricePaise;
    const amountRupees = Math.round(amountPaise / 100);

    // If manual / pending payment flow
    return {
      success: true,
      provider: this.provider,
      mode: 'pending_approval',
      paymentSessionId: `sess_${Date.now()}_${restaurantId}`,
      planId: plan.planId,
      billingCycle,
      amountPaise,
      amountRupees,
      currency: 'INR',
      instructions: 'Subscription request recorded. Once processed or confirmed by platform admin, your plan limits and features will be activated immediately.'
    };
  }

  /**
   * Verifies incoming webhook signature safely
   */
  verifyWebhookSignature(payload, signature, secret) {
    if (!signature || !secret) return false;
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}

module.exports = new PaymentService();
