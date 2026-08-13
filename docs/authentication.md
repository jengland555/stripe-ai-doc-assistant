---
title: "Stripe API Authentication & API Keys"
slug: "/docs/authentication"
description: "Learn how to authenticate requests to the Stripe API using secret, publishable, and restricted API keys."
tags: ["auth", "api-keys", "security", "headers"]
---

# Stripe API Authentication

The Stripe API uses API keys to authenticate requests. You can view and manage your API keys in the Stripe Dashboard under **Developers > API keys**.

Your API keys carry significant privileges, so be sure to keep them secure! Do not share your secret API keys in publicly accessible areas such as GitHub, client-side code, or blog posts.

## Types of API Keys

Stripe provides two primary types of API keys for both test and live modes:

### 1. Publishable Keys (`pk_test_...` or `pk_live_...`)
* **Purpose**: Used on client-side web and mobile apps (e.g., Stripe Elements, Stripe.js, mobile SDKs).
* **Security**: Safe to include in client-facing frontend JavaScript.
* **Function**: Tokenizes payment details without sensitive card data hitting your server.

### 2. Secret Keys (`sk_test_...` or `sk_live_...`)
* **Purpose**: Used on your backend server to perform privileged operations like creating charges, managing customers, and issuing refunds.
* **Security**: Must NEVER be exposed in frontend code or committed to version control.

### 3. Restricted API Keys (`rk_test_...` or `rk_live_...`)
* **Purpose**: Fine-grained keys configured with specific read or write permissions (e.g., read-only access to Customer data).
* **Best Practice**: Use restricted keys for internal microservices and third-party integrations following the principle of least privilege.

---

## Authenticating Requests

Authentication to the Stripe API is performed via **HTTP Bearer Authentication**. You must provide your secret API key in the `Authorization` header with every request.

### Header Format
```http
Authorization: Bearer YOUR_SECRET_KEY
```

### Example cURL Request
```bash
curl https://api.stripe.com/v1/charges \
  -H "Authorization: Bearer sk_test_51NzABC123ExampleKey" \
  -d amount=2000 \
  -d currency=usd
```

### Example Node.js Authentication
```javascript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// All subsequent calls automatically pass the authenticated key
const customer = await stripe.customers.create({
  email: 'jenna@example.com',
});
```

---

## Authentication Error Handling

If you send a request without an authentication header or with an invalid key, Stripe returns an **HTTP 401 Unauthorized** error.

```json
{
  "error": {
    "type": "invalid_request_error",
    "message": "Invalid API Key provided: sk_test_***"
  }
}
```

### Common Fixes for 401 Errors
1. **Check for Whitespace**: Ensure your `.env` file does not have accidental trailing spaces in the key.
2. **Verify Environment**: Ensure you are not passing a publishable key (`pk_`) to a backend endpoint that requires a secret key (`sk_`).
3. **Key Rollover**: If an API key was rolled in the dashboard, update your application server configuration immediately.
