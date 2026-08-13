---
title: "Testing Stripe Integrations & Card Numbers"
slug: "/docs/testing"
description: "Simulate payments, declines, 3D Secure authentication challenges, and webhooks in Stripe test mode."
tags: ["testing", "cards", "sandbox", "3ds-test", "cli"]
---

# Testing in Stripe Test Mode

Stripe provides a full sandbox environment called **Test Mode**. No actual money moves when using test API keys (`pk_test_...` and `sk_test_...`).

---

## Test Payment Card Numbers

Use these special card numbers in your test checkout flows. You may use any future expiration date (e.g., `12/34`) and any 3-digit CVC (e.g., `123`).

| Scenario | Card Number | Expected Result |
| :--- | :--- | :--- |
| **Successful Charge (Visa)** | `4242 4242 4242 4242` | Status `succeeded` immediately |
| **Successful Charge (Mastercard)** | `5555 5555 5555 4444` | Status `succeeded` immediately |
| **3D Secure Authentication Challenge** | `4000 0027 6000 3184` | Status `requires_action` (triggers test modal) |
| **Generic Card Decline** | `4000 0000 0000 0002` | HTTP 402 with `card_declined` |
| **Insufficient Funds Decline** | `4000 0000 0000 9995` | HTTP 402 with `insufficient_funds` |
| **Expired Card Decline** | `4000 0000 0000 0069` | HTTP 402 with `expired_card` |

---

## Testing Webhooks Locally with the Stripe CLI

To test your webhook endpoint without deploying to a public server:

1. **Install the Stripe CLI**:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```
2. **Authenticate with Stripe**:
   ```bash
   stripe login
   ```
3. **Forward Webhook Events to your Local Port**:
   ```bash
   stripe listen --forward-to localhost:3000/webhook
   ```
   *The CLI will output a webhook signing secret (`whsec_...`) to paste into your local `.env` file.*

4. **Trigger Mock Events**:
   ```bash
   stripe trigger payment_intent.succeeded
   ```
