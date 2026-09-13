# Prepared Paws

GitHub Pages website for Prepared Paws pet first aid and CPR training.

## Live registration system

The website uses a Cloudflare Worker and D1 database for live classes, student registrations, payment-status tracking, and paid-student CSV exports.

Before the system is used, add these secrets in the Cloudflare Worker settings:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET` (a new random value, at least 32 characters)

When Chase QuickAccept payment links are ready, add these secrets as well:

- `CHASE_CLASS_LINK`
- `CHASE_CLASS_KIT_LINK`
- `CHASE_KIT_LINK`

The Worker source and D1 schema are in [worker](worker/). It is configured to use the production Worker at `https://prepared-paws-api.salcido-heriberto.workers.dev`.

## Publishing the website

Commit and push the repository with GitHub Desktop. GitHub Pages then publishes the public site at `https://salseedoh.github.io/pfawebsite/`.
