---
title: "Stripe Webhooks & Event Handling"
slug: "/docs/webhooks"
description: "How to securely receive and verify asynchronous Stripe events (webhooks) to fulfill orders and handle recurring billing."
tags: ["webhooks", "events", "security", "signatures", "fulfillment"]
---

# Stripe Webhooks

Webhooks allow your server to receive real-time notifications when events happen in your Stripe account. Because payments are often asynchronous (e.g., customer bank delays, 3D Secure challenges, recurring subscriptions), webhooks are the only guaranteed way to fulfill orders reliably.

## Essential Webhook Events

| Event Type | Trigger Description | Recommended Action |
| :--- | :--- | :--- |
| `payment_intent.succeeded` | Payment was successfully captured | Fulfill order and deliver digital products |
| `payment_intent.payment_failed` | Payment attempt was declined | Notify customer to update payment method |
| `charge.refunded` | A full or partial refund was completed | Update accounting and revoke license if applicable |
| `customer.subscription.deleted` | Subscription canceled or unpaid | Downgrade customer account tier |

---

## Verifying Webhook Signatures

To ensure incoming webhook requests genuinely originate from Stripe and were not tampered with in transit, always verify the **`Stripe-Signature`** header using your endpoint's signing secret (`whsec_...`).

> **Critical**: Do not parse the incoming request body as JSON before verification. The verification method requires the **raw body buffer**.

### Node.js (Express) Webhook Receiver Example
```javascript
import express from 'express';
import Stripe from 'stripe';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Starts with whsec_

// Use express.raw() to preserve raw byte body
app.post('/webhook', express.raw({ type: 'application/json' }), (request, response) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    console.error(`⚠️ Webhook signature verification failed: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle verified event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log(`💰 PaymentIntent succeeded: ${paymentIntent.id}`);
      fulfillOrder(paymentIntent);
      break;

    case 'payment_intent.payment_failed':
      const failedIntent = event.data.object;
      console.warn(`❌ Payment failed: ${failedIntent.last_payment_error?.message}`);
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  // Acknowledge receipt immediately with HTTP 200
  response.status(200).json({ received: true });
});
```

---

## Best Practices for Webhook Reliability

1. **Acknowledge Quickly**: Return an HTTP `200 OK` response within 3 seconds. Offload long-running background tasks (e.g., sending emails or generating PDFs) to a task queue.
2. **Handle Duplicate Events (Idempotency)**: Stripe occasionally retries event delivery. Store processed `event.id` values in your database to ensure you do not fulfill an order twice.
3. **Local Testing with Stripe CLI**:
   ```bash
   # Listen to local server events
   stripe listen --forward-to localhost:3000/webhook
   
   # Trigger a test event
   stripe trigger payment_intent.succeeded
   ```
