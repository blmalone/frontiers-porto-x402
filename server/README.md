# Mint My Fortune - Porto Payment Server

A Hono-based server demonstrating two payment patterns using the Porto protocol for accessing paywalled fortune content.

## Overview

This server implements a paywall-as-a-service model where users can purchase access to premium fortune readings using two payment methods:

1. **Self-Payment**: Users sign their own payment transactions
2. **Delegated Payment**: Server executes payments on behalf of users with granted permissions

## Architecture

```
Frontend (React) ←→ Server (Hono) ←→ Porto Protocol ←→ Base Sepolia
```

The server validates payment signatures, executes transactions via Porto protocol, and serves protected fortune readings after payment verification.

## Environment Variables

```bash
# Required
MERCHANT_ADDRESS=0x...           # Your merchant wallet address
MERCHANT_PRIVATE_KEY=0x...       # Your merchant private key


# Cloudflare KV Namespaces
PREPARE_CALLS_STORE=...          # For payment preparation data
```

## Deployment

### Cloudflare Workers

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure Wrangler:
   ```bash
   pnpm wrangler login
   ```

3. Create KV namespaces:
   ```bash
   pnpm wrangler kv:namespace create PREPARE_CALLS_STORE
   ```

4. Set secrets:
   ```bash
   pnpm wrangler secret put MERCHANT_PRIVATE_KEY
   pnpm wrangler secret put MERCHANT_ADDRESS
   ```

5. Deploy:
   ```bash
   pnpm wrangler deploy
   ```

### Local Development

```bash
pnpm dev
```

## API Endpoints



### Protected Content
- `GET /api/self/fortune` - Fortune data via self-payment
- `GET /api/delegated/fortune` - Fortune data via delegated payment

### Utilities
- `ALL /rpc` - Porto merchant RPC endpoint

## Frontend Integration

This server works with a React frontend using wagmi for wallet connections and Porto wallet for advanced payment features.

The frontend should be configured to point to your deployed server URL and handle the two payment flows.

## Payment Flow

1. Frontend requests protected content
2. Server returns 402 with payment requirements
3. User authorizes payment (self or delegated)
4. Server validates payment and returns content

## Notes

- Uses Base Sepolia testnet
- Integrates with Porto protocol for wallet operations
- Implements X402 payment standard patterns
