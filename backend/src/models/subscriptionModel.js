const { query } = require("../config/db");

const SubscriptionModel = {
  // Called once, right after a company signs up — starts them on a free trial.
  async createTrial(companyId, trialDays) {
    const res = await query(
      `INSERT INTO subscriptions (company_id, status, trial_ends_at)
       VALUES ($1, 'trial', now() + ($2 || ' days')::interval)
       RETURNING *`,
      [companyId, trialDays]
    );
    return res.rows[0];
  },

  async findByCompany(companyId) {
    const res = await query(`SELECT * FROM subscriptions WHERE company_id = $1`, [companyId]);
    return res.rows[0];
  },

  async findByRazorpaySubscriptionId(razorpaySubscriptionId) {
    const res = await query(`SELECT * FROM subscriptions WHERE razorpay_subscription_id = $1`, [razorpaySubscriptionId]);
    return res.rows[0];
  },

  async attachRazorpaySubscription(companyId, { razorpayCustomerId, razorpaySubscriptionId, razorpayPlanId, quantity }) {
    const res = await query(
      `UPDATE subscriptions
       SET razorpay_customer_id = $2, razorpay_subscription_id = $3, razorpay_plan_id = $4,
           quantity = $5, updated_at = now()
       WHERE company_id = $1
       RETURNING *`,
      [companyId, razorpayCustomerId, razorpaySubscriptionId, razorpayPlanId, quantity]
    );
    return res.rows[0];
  },

  async updateStatus(companyId, status, currentPeriodEnd) {
    const res = await query(
      `UPDATE subscriptions
       SET status = $2, current_period_end = COALESCE($3, current_period_end), updated_at = now()
       WHERE company_id = $1
       RETURNING *`,
      [companyId, status, currentPeriodEnd]
    );
    return res.rows[0];
  },

  async updateStatusByRazorpaySubscriptionId(razorpaySubscriptionId, status, currentPeriodEnd) {
    const res = await query(
      `UPDATE subscriptions
       SET status = $2, current_period_end = COALESCE($3, current_period_end), updated_at = now()
       WHERE razorpay_subscription_id = $1
       RETURNING *`,
      [razorpaySubscriptionId, status, currentPeriodEnd]
    );
    return res.rows[0];
  },

  async updateQuantity(companyId, quantity) {
    const res = await query(
      `UPDATE subscriptions SET quantity = $2, updated_at = now() WHERE company_id = $1 RETURNING *`,
      [companyId, quantity]
    );
    return res.rows[0];
  },
};

module.exports = SubscriptionModel;
