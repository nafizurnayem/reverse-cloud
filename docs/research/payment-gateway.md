# Payment gateway research

Decision date: 16 October 2026

## Current product boundary

Reverse Cloud currently creates payment schedules, records externally received
payments, voids incorrect records and serves invoices. It does not collect money
online. A gateway integration should extend that model rather than replace the
existing `payment_items` and `payments` records.

## Provider comparison

| Provider | Verified capabilities | Fit for Reverse Cloud | Open commercial questions |
| --- | --- | --- | --- |
| SSLCOMMERZ | Hosted or embedded checkout, sandbox, server IPN and a transaction-validation API. Its documented flow requires the merchant to validate the notification and transaction amount before accepting payment. | Best first integration for a Bangladesh-based business that wants one hosted checkout and a clearly documented server-verification flow. | Current onboarding documents, supported international cards, settlement timing, refunds, recurring payments and the written fee quote. |
| bKash Payment Gateway | bKash advertises payment gateway APIs, tokenized checkout, subscription payments, direct charges and instant refunds for online businesses. | Strong direct option when bKash conversion, saved accounts or recurring bKash payments are a business requirement. It does not replace a multi-method card aggregator by itself. | Merchant approval, API-document access, exact webhook/verification contract, limits, settlement and pricing. |
| shurjoPay | Official documentation provides sandbox and production REST endpoints for authentication, payment initiation and payment verification. The provider also documents IPN support and card/mobile-wallet coverage. | Credible aggregator alternative with a straightforward REST flow. | Written method coverage, refund workflow, recurring support, settlement and commercial quote. |
| aamarPay | Official documentation provides sandbox and live JSON endpoints. The provider advertises local and international cards plus bKash, Rocket, Nagad and other wallets. | Broad payment-method alternative worth a commercial and technical proof of concept. | Callback authenticity, mandatory server-side verification, refunds, recurring payments, settlement and commercial quote. |
| Stripe | Stripe's current global-availability list does not include Bangladesh for merchant payment accounts. BDT is a presentment currency for supported Stripe accounts, which is different from supporting a Bangladesh-based merchant. | Do not select for the current Bangladesh entity. Reconsider only if Reverse Cloud operates a compliant legal entity and bank account in a supported country. | Legal entity, tax, banking and operating-country requirements. |

## Recommendation

Use **SSLCOMMERZ as the first provider to take through merchant onboarding and a
sandbox proof of concept**. Its published session, IPN and validation sequence
maps well to the application's server-side payment records. Obtain comparable
written quotes from SSLCOMMERZ, shurjoPay and aamarPay before signing a contract.

Choose direct bKash instead, or add it later, only when tokenized or subscription
bKash payments are a confirmed product requirement. Do not build against Stripe
for the current Bangladesh business entity.

## Required implementation contract

1. Add a `payment_attempts` table linked to `payment_items`, with a unique
   internal transaction ID, provider name, provider transaction ID, expected
   amount/currency, status, expiry and timestamps.
2. Create payment sessions on the server. Load the amount and currency from the
   database; never trust values sent by the browser.
3. Redirect clients to the provider's hosted checkout so Reverse Cloud never
   handles card credentials.
4. Treat browser success/failure redirects as display state only. Finalize a
   payment only after a server notification has been independently verified
   with the provider.
5. Make notification processing idempotent with unique provider transaction and
   delivery identifiers. Reject amount, currency or payment-item mismatches.
6. Insert the existing `payments` record through one atomic database function
   after verification, then let the existing status recalculation and outbox
   logic run.
7. Store sanitized delivery metadata and response codes for support and audit;
   do not store card, PIN, OTP or full provider payloads containing unnecessary
   personal data.
8. Add sandbox tests for success, failure, cancellation, duplicate notification,
   altered amount, invalid verification, timeout and refund/void reconciliation.

## Estimate after merchant credentials arrive

| Work | Estimate |
| --- | ---: |
| Database contract and provider adapter | 2–3 engineering days |
| Checkout, return pages and verified notification receiver | 2–3 engineering days |
| Security, idempotency and automated tests | 2–3 engineering days |
| Sandbox and merchant UAT | 1–2 engineering days |
| **Total** | **7–11 engineering days** |

Merchant approval and production credential issuance are external lead-time and
are not included in this estimate.

## Sources

- [SSLCOMMERZ integration documentation](https://developer.sslcommerz.com/doc/v4/index.html)
- [bKash business products](https://www.bkash.com/en/business)
- [shurjoPay REST API documentation](https://web2.shurjopay.com.bd/frontend-developers/direct-integration-with-api)
- [shurjoPay developer overview](https://web2.shurjopay.com.bd/frontend-developers/frontend-developers-page)
- [aamarPay JSON payment API](https://aamarpay.readme.io/reference/initiate-payment-json)
- [aamarPay payment-method coverage](https://aamarpay.com/)
- [Stripe global availability](https://stripe.com/global)
- [Stripe supported currencies](https://docs.stripe.com/currencies)
