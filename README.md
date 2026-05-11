# Amazon Angular Workshop

![CI](https://img.shields.io/github/actions/workflow/status/your-org/amazon-angular-workshop/ci.yml?label=CI)

An Angular 17 storefront app with:

- Guarded routes and sign-in flow
- Multi-tenant product filtering
- Centralized app state (cart, UI flags, theme)
- Local and Amplify-ready auth modes
- Playwright end-to-end tests
- GitHub Actions CI workflow

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Run the app (development config):

```bash
npm run start
```

3. Open:

```text
http://localhost:4200
```

You will be redirected to `/sign-in` when not authenticated.

## Sign-In Modes

### Development mode (default)

- Feature flag `useAmplifyAuth` is `false` in `src/environments/environment.development.ts`.
- Any username/password works with local persisted auth.
- You can also use demo buttons on the sign-in form.

### Amplify/Cognito mode

1. Set real Cognito values in `src/aws-exports.ts`.
2. Ensure `useAmplifyAuth` is `true` in your target environment file.
3. Build/serve with that environment.

## Feature Flags

Feature flags live in:

- `src/environments/environment.ts`
- `src/environments/environment.development.ts`
- `src/environments/environment.staging.ts`

Current flags:

- `useAmplifyAuth`
- `enableInstrumentation`
- `allowSimulatedFailureToggle`
- `simulateBackendFailuresDefault`

## Theme Toggle

- Use the `Toggle Theme` button in the header.
- Theme persists in localStorage.

## End-to-End Tests (Playwright)

Install browser binaries (first time):

```bash
npx playwright install chromium
```

Run E2E tests:

```bash
npm run e2e
```

Run headed mode:

```bash
npm run e2e:headed
```

Current E2E coverage includes:

- Add to cart updates badge
- Search filters products
- Cart persists after reload

## Deterministic Checkout Test Steps

Use these manual steps to verify race-safe checkout behavior without relying on random failures.

1. Sign in and open the product list.
2. Enable Simulate backend failures.
3. Set Checkout failure mode to one of:
	- none
	- checkout-unavailable
	- stock-changed

### Verify Successful Reservation (mode = none)

1. Keep mode as none.
2. Add a product with a visible stock count to cart.
3. Complete checkout.
4. Confirm order success.
5. Open Admin and verify the product stock decreased by purchased quantity.

### Verify Typed Unavailable Failure (mode = checkout-unavailable)

1. Set mode to checkout-unavailable.
2. Attempt checkout.
3. Confirm checkout fails with: Checkout is temporarily unavailable. Please try again.
4. Confirm cart still contains the items.

### Verify Typed Stock Conflict Failure (mode = stock-changed)

1. Set mode to stock-changed.
2. Attempt checkout.
3. Confirm checkout fails with a stock-changed message showing requested vs available quantity.
4. Confirm cart still contains the items.

### Verify Real Server-Side Stock Conflict (mode = none)

1. Keep mode as none.
2. Add a low-stock item to cart.
3. Before placing order, reduce that item's stock in Admin (or from another session) to below cart quantity.
4. Place order.
5. Confirm checkout fails with typed insufficient-stock message.

## CI Workflow

GitHub Actions workflow is at:

- `.github/workflows/ci.yml`

It runs:

1. `npm ci`
2. Playwright browser install
3. `npm run build`
4. `npm run e2e`

## Build

```bash
npm run build
```

## My Copilot + Engineering Journey

I used Copilot as a pair-programming assistant while intentionally owning the architecture decisions.

What I focused on:

1. Customer-facing reliability first: route guards, error handling, persisted sessions, and cart persistence.
2. Maintainability over speed: introduced AppState service to reduce component coupling and output-event sprawl.
3. Progressive architecture: started with local auth, then made auth pluggable with Amplify-ready integration.
4. Quality mindset: added Playwright E2E tests for critical flows and a CI pipeline to catch regressions.
5. Learning in public: as a non-expert in Angular/TypeScript, I treated each feature as a chance to improve patterns, not just ship code.

Outcome:

- The app now has a clearer architecture boundary between UI, state, auth, and data access.
- New features can be layered in with less refactor risk.
- PRs can be validated automatically with build + E2E checks.
