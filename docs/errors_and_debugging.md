---
title: "Stripe Error Handling, Status Codes & Idempotency"
slug: "/docs/errors"
description: "A comprehensive guide to debugging Stripe API errors, interpreting decline codes, and using idempotency keys."
tags: ["errors", "debugging", "idempotency", "status-codes", "declines"]
---

# Error Handling & Debugging

The Stripe API returns standard HTTP status codes alongside structured JSON error payloads to help you diagnose and recover from failed operations.

---

## HTTP Status Code Summary

* **`200 - OK`**: Request succeeded synchronously.
* **`400 - Bad Request`**: Missing required parameters or malformed request body.
* **`401 - Unauthorized`**: Missing or invalid API key in the `Authorization` header.
* **`402 - Request Failed`**: Parameters were valid, but the operation failed (e.g., card declined or insufficient funds).
* **`404 - Not Found`**: The requested resource ID (customer, payment intent) does not exist.
* **`429 - Too Many Requests`**: Rate limits exceeded. Implement exponential backoff retry logic.
* **`500, 502, 503 - Server Errors`**: An issue occurred on Stripe's servers.

---

## Common Card Decline Codes

When a payment fails with HTTP `402`, check the `decline_code` field inside the error object:

| Decline Code | Meaning | User Message Recommendation |
| :--- | :--- | :--- |
| `insufficient_funds` | Not enough balance on card | "Your card has insufficient funds. Please try another payment method." |
| `card_declined` | Generic bank refusal | "Your bank declined the transaction. Please contact your card issuer." |
| `expired_card` | Card expiration date has passed | "Your card has expired. Please provide an active card." |
| `incorrect_cvc` | CVC / CVV digits do not match | "The security code (CVC) is incorrect. Please re-enter." |
| `processing_error` | Temporary network timeout | "A temporary error occurred. Please try submitting again in a moment." |

---

## Preventing Duplicate Charges: Idempotency Keys

Network drops or client timeouts can cause a user to click "Pay" twice. To guarantee that an operation is performed **exactly once**, pass an **`Idempotency-Key`** header.

### How It Works
If Stripe receives two requests with the same `Idempotency-Key` within 24 hours, the second request is not executed; instead, Stripe returns the exact saved response from the first request.

### Example in Node.js
```javascript
const paymentIntent = await stripe.paymentIntents.create(
  {
    amount: 5000,
    currency: 'usd',
    customer: 'cus_12345',
  },
  {
    idempotencyKey: 'checkout_session_user987_order102', // Unique string generated per checkout session
  }
);
```
