---
title: "Stripe Customers & Saved Payment Methods"
slug: "/docs/customers"
description: "How to create Customer objects, store reusable payment methods, and manage subscription billing."
tags: ["customers", "subscriptions", "cards", "profiles"]
---

# Customers & Reusable Payment Methods

A **Customer object** represents a business or individual using your service. Creating Customers allows you to:
* Save payment methods (credit cards, bank accounts) for future recurring billing.
* Track customer payment history and invoices over time.
* Attach metadata (such as internal user IDs or CRM references).

---

## Creating a Customer

Create a Customer record on your backend as soon as a user registers on your application or initiates their first checkout.

### Node.js Example
```javascript
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const customer = await stripe.customers.create({
  name: 'Jenna England',
  email: 'jenna@example.com',
  description: 'Technical Writing Specialist',
  metadata: {
    internal_user_id: 'usr_abc12345',
    plan_tier: 'enterprise_pro',
  },
});

console.log(`Created customer: ${customer.id}`); // e.g., cus_N5zQ8L4k
```

---

## Attaching a Payment Method to a Customer

To charge a customer in the future (for off-session recurring payments or one-click checkouts), attach a `PaymentMethod` to their `Customer` record.

### Attaching via API
```javascript
// Attach PaymentMethod to Customer
await stripe.paymentMethods.attach('pm_123456789', {
  customer: 'cus_N5zQ8L4k',
});

// Set as default invoice payment method
await stripe.customers.update('cus_N5zQ8L4k', {
  invoice_settings: {
    default_payment_method: 'pm_123456789',
  },
});
```

---

## Charging a Saved Customer (Off-Session)

When charging a customer without them actively being on your website (e.g., subscription renewal):
* Set `customer: 'cus_...'`
* Set `payment_method: 'pm_...'`
* Set `off_session: true`
* Set `confirm: true`

```javascript
const paymentIntent = await stripe.paymentIntents.create({
  amount: 4900, // $49.00 USD
  currency: 'usd',
  customer: 'cus_N5zQ8L4k',
  payment_method: 'pm_123456789',
  off_session: true,
  confirm: true,
});
```

> **Note on Off-Session Declines**: If the customer's bank requires 3D Secure authentication for an off-session charge, the `PaymentIntent` status becomes `requires_action`. You should email the customer a link to complete verification.
