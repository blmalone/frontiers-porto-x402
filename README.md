# Porto for x402 - Eliminating the Facilitator

A hackathon project demonstrating how Porto wallets can work with the [x402 payment standard](https://www.x402.org/) without requiring Coinbase's facilitator. This project showcases a key discovery: **Porto already supports x402 out of the box** through its ERC-1271 implementation.

## The Discovery

**Problem**: The [x402 standard](https://www.x402.org/) requires using Coinbase's facilitator for payment processing, creating a centralized dependency.

**Discovery**: Porto wallets already implement [ERC-1271](https://eips.ethereum.org/EIPS/eip-1271), which means they can validate signatures for EIP-3009 `transferWithAuthorization` calls. The USDC contract handles the actual transfer authorization - Porto just needs to sign the authorization message.

**Innovation**: We discovered that by combining existing Porto workflows in clever ways, we could support x402 today without any contract changes. The only Porto modifications needed were UI improvements to identify EIP-3009 signing requests and present them clearly to users.

## Why This Matters

- **Porto Discovery**: Reveals that Porto already has the capability to work with x402 out of the box
- **No Contract Changes**: Leverages existing ERC-1271 implementation in Porto
- **Decentralized x402**: Enables x402 payments without Coinbase's centralized facilitator
- **Hackathon Impact**: Shows how existing tools can be combined in innovative ways
- **Real-world Application**: Provides a template for integrating Porto with other payment standards

## Payment Flow & How It Works

The application implements a 7-step payment flow that bypasses the facilitator:

1. **User visits merchant site** - User attempts to access paywalled fortune content
2. **402 Payment Required** - Server responds with payment requirements (0.00075 USDC on Base Sepolia)
3. **Porto EIP-3009 Authorization** - Client creates typed data, Porto wallet identifies the signing request and presents it clearly to user
4. **X-Payment Header** - Client retries request with payment authorization
5. **Direct Contract Transaction** - Merchant calls USDC `transferWithAuthorization` function (no facilitator!)
6. **On-chain Verification** - USDC contract validates signature via Porto's ERC-1271 implementation and executes transfer
7. **Content Release** - Merchant confirms payment and releases fortune content

<img width="3634" height="7566" alt="x402xporto" src="https://github.com/user-attachments/assets/789604d3-7625-4fcb-912f-2dc386a45b77" />

## Project Structure

```
├── src/                    # React frontend
│   ├── App.tsx            # Main application
│   ├── PurchaseButtonSelf.tsx      # Porto x402 payment component
│   └── eip3009.ts         # EIP-3009 transfer authorization utilities
└── server/                # Hono backend
    ├── src/index.ts       # Payment server with x402 implementation (no facilitator)
    └── package.json       # Dependencies including x402 library
```

## Technology Stack

- **Frontend**: React, wagmi, **Porto wallet integration**
- **Backend**: Hono, Cloudflare Workers
- **Blockchain**: Base Sepolia testnet
- **Token**: USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e)

## Key Components

### Payment Requirements (402 Response)
When a user requests content without payment, the server returns:
```json
{
  "scheme": "exact",
  "network": "base-sepolia",
  "maxAmountRequired": "750",
  "payTo": "0x50F1d3b9F5811F333e7Ef77D14B470cEAA08e905",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "extra": {
    "name": "USDC",
    "version": "2"
  }
}
```

### Porto EIP-3009 Transfer Authorization
Users sign EIP-712 typed data with their Porto wallet, authorizing the transfer:
```json
{
  "domain": {
    "name": "USDC",
    "version": "2",
    "chainId": 84532,
    "verifyingContract": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  },
  "primaryType": "TransferWithAuthorization",
  "message": {
    "from": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
    "to": "0x50F1d3b9F5811F333e7Ef77D14B470cEAA08e905",
    "value": "750",
    "validAfter": "1703123456",
    "validBefore": "1703127056",
    "nonce": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  }
}
```

### X-Payment Header (Facilitator-Free)
Client sends payment authorization in base64-encoded header, bypassing Coinbase's facilitator:
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base-sepolia",
  "payload": {
    "signature": "0x1234567890abcdef...",
    "authorization": {
      "from": "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
      "to": "0x50F1d3b9F5811F333e7Ef77D14B470cEAA08e905",
      "value": "750",
      "validAfter": "1703123456",
      "validBefore": "1703127056",
      "nonce": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
    }
  }
}
```

## Prerequisites

- Node.js 18+
- pnpm
- **Porto wallet** with Base Sepolia testnet USDC

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

4. **Connect Porto wallet** and ensure you have Base Sepolia testnet USDC to purchase fortune readings

## Environment Setup

### Server (.env)
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

This is a hackathon project demonstrating Porto's existing x402 compatibility and should not be used in production without proper security audits.
