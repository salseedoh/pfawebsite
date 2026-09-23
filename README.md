# Prepared Paws

GitHub Pages website for Prepared Paws pet first aid and CPR training.

## Live registration system

The website uses a Cloudflare Worker and D1 database for live classes, student registrations, payment-status tracking, and paid-student CSV exports.

Before the system is used, add these secrets in the Cloudflare Worker settings:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET` (a new random value, at least 32 characters)
- `TURNSTILE_SECRET_KEY` (the existing customer-form Turnstile secret)

To protect the admin login, also add these Worker variables:

- `ADMIN_TURNSTILE_SITE_KEY` (the public site key for a new admin-login Turnstile widget)
- `ADMIN_TURNSTILE_SECRET_KEY` (the corresponding secret key)

For Stripe Checkout, add these secrets as well:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

The Worker source and D1 schema are in [worker](worker/). It is configured to use the production Worker at `https://prepared-paws-api.salcido-heriberto.workers.dev`.

## Stripe test environment

Stripe Checkout is tested with the separate `prepared-paws-api-test` Worker and `prepared-paws-test` D1 database. The test Worker configuration is in [worker/wrangler.test.jsonc](worker/wrangler.test.jsonc). Initialize a new test database from the current schema with `npm.cmd run db:init:test`, then deploy the test Worker with `npm.cmd run deploy:test`.

Keep Stripe sandbox credentials out of Git. Add them only as Cloudflare Worker secrets to the test Worker when the test deployment is ready.

## Publishing the website

Commit and push the repository with GitHub Desktop. GitHub Pages then publishes the public site at `https://salseedoh.github.io/pfawebsite/`.
