---
title: "Stripe Refunds & Dispute Management"
slug: "/docs/refunds"
description: "How to issue full or partial refunds, inspect refund statuses, and manage chargebacks and payment disputes."
tags: ["refunds", "disputes", "chargebacks", "returns"]
---

# Stripe Refunds API

You can issue refunds using the Stripe Dashboard or programmatically via the **Refunds API**. Refunds can be issued for the full charge amount or a partial amount.

---

## Creating a Refund

To refund a payment, pass either the `payment_intent` ID or `charge` ID.

### Full Refund Example
```javascript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const refund = await stripe.refunds.create({
  payment_intent: 'pi_3MtwBwLkdIwHu7ix28a3tqPa',
});

console.log(`Refund status: ${refund.status}`); // 'succeeded' or 'pending'
```

### Partial Refund with Reason
```javascript
const partialRefund = await stripe.refunds.create({
  payment_intent: 'pi_3MtwBwLkdIwHu7ix28a3tqPa',
  amount: 1000, // Refund $10.00 of original charge
  reason: 'requested_by_customer', // 'duplicate', 'fraudulent', or 'requested_by_customer'
  metadata: {
    ticket_id: 'helpdesk_9921',
  },
});
```

---

## Refund Timelines and Processing

* **Credit Card Processing Time**: Card refunds typically take **5 to 10 business days** to appear on a customer's bank statement depending on their financial institution.
* **Stripe Processing Fees**: When you issue a refund, Stripe returns the original payment amount to the customer, but the original Stripe processing fee is not returned.
* **Instant Cancellation**: If a charge is refunded before the daily settlement cutoff, the charge may appear as a reversal (disappearing completely from the customer's card statement rather than showing a separate credit entry).

---

## Refunds vs Chargebacks (Disputes)

| Feature | Refund | Dispute / Chargeback |
| :--- | :--- | :--- |
| **Initiated By** | Merchant / You | Customer directly via their bank |
| **Fee Incurred** | No dispute fee | $15.00 dispute fee (refunded if you win) |
| **Resolution** | Instant credit to customer | Requires submitting formal evidence to card network |
| **Recommendation** | Always issue refunds proactively if a customer requests cancellation to avoid disputes. |
