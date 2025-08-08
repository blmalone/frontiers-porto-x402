# Porto for x402 

This hackathon project implements [x402](https://www.x402.org/) support for Porto. Our demo shows that this integration is functional _today_ and our work is ready to be upstreamed into Porto's sdk.

## TLDR x402

**x402** is an emerging web standard that enables **HTTP-based cryptocurrency payments** directly in web browsers. It allows users to pay for digital content using cryptocurrency without leaving the website.

Most x402 implementations rely on **Coinbase's centralized facilitator** to verify and settle payments. 

## Our Work

**Problem**: The x402 is gaining traction and Porto users should be able to use it. Today, most solutions use Coinbase's facilitator for payment processing, creating a centralized dependency. 

**Discovery**: Porto wallets already implement [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271), which means they can validate signatures for [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) `transferWithAuthorization` calls. The USDC contract handles the actual transfer authorization - Porto just needs to sign the authorization message and identify the typed data as an x402 payment authorization.

**Innovation**: We discovered that by combining existing Porto workflows, we could support x402 today without any smart contract changes. We have created a PR to Porto that natively supports x402 payment detection and surfaces it to the user for signing. Porto's UX can now deeply support EIP-3009 payload. This is a powerful UX improvement for Porto users.

## Porto's x402 Involvement

With our work, Porto produces x402 spec-compliant signatures that can be used with _any_ backend that supports x402. This means a Porto user can now engage with any merchant site that uses x402, whether or not that merchant has a Porto account. This works today!

## Payment Flow & How It Works

The application implements a 7-step payment flow that bypasses the facilitator:

1. **User visits merchant site** - User attempts to access paywalled content
2. **402 Payment Required** - Server responds with payment requirements (0.00075 USDC on Base Sepolia)
3. **Porto EIP-3009 Authorization** - Client creates typed data, Porto wallet identifies the signing request and presents it clearly to user
4. **X-Payment Header** - Client retries request with payment authorization
5. **Direct Contract Transaction** - Merchant calls USDC `transferWithAuthorization` function (no facilitator!)
6. **On-chain Verification** - USDC contract validates signature via Porto's ERC-1271 implementation and executes transfer
7. **Content Release** - Merchant confirms payment and releases content

<img width="3634" height="7566" alt="x402xporto" src="https://github.com/user-attachments/assets/789604d3-7625-4fcb-912f-2dc386a45b77" />

## Next Steps

1. Request a review on Porto dialog PR:
2. Create a PR to add x402 details to Porto SDK website: https://porto.sh/sdk

## Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start the server:**
   ```bash
   cd server
   pnpm dev
   ```

3. **Start the frontend:**
   ```bash
   pnpm dev
   ```

4. **Connect Porto wallet** and ensure you have Base Sepolia testnet USDC to purchase fortune readings.

## Environment Setup

### Server (.dev.vars)
```bash
MERCHANT_ADDRESS=0x50F1d3b9F5811F333e7Ef77D14B470cEAA08e905
MERCHANT_PRIVATE_KEY=0x...
```

### Frontend 
Update `SERVER_URL` in constants to point to your deployed server.

## Deployment

- **Frontend**: Deploy to Vercel
- **Server**: Deploy to Cloudflare Workers (see [server README](server/README.md))

## Disclaimer

This is a hackathon project demonstrating Porto's x402 compatibility and should not be used in production without proper security audits.
