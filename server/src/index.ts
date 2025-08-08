import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MerchantRpc } from 'porto/server';
import { baseSepolia } from 'wagmi/chains';
import { createClient, http } from 'viem';
import type { Context } from 'hono';
import { Key } from 'porto';
import { ServerActions } from 'porto/viem';
import { waitForCallsStatus } from 'viem/actions';
import { encodeFunctionData } from 'viem/utils';

interface FortuneData {
  fortune: string;
  category: string;
  luckyNumber: number;
  price: number;
}

interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  outputSchema?: any;
  extra?: any;
}

interface CallsStatus {
  statusCode: number;
  receipts?: Array<{ transactionHash: `0x${string}` }>;
}

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

// Viem Client for Porto compatibility
export const client = createClient({
  chain: baseSepolia,
  transport: http('https://base-sepolia.rpc.ithaca.xyz'),
});

const app = new Hono<{ Bindings: Env }>();

/**
 * CORS configuration
 */
app.use('/*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'https://localhost:5173',
      'https://stg.id.porto.sh',
      'https://porto.blainemalone.com',
      'http://porto.blainemalone.com'
    ];
    
    if (!origin || !allowedOrigins.includes(origin)) {
      return null;
    }
    return origin;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-PAYMENT', 'X-USER-ADDRESS']
}));

/**
 * Generates random fortune data
 */
const getFortune = async (c: Context<{ Bindings: Env }>, price: number): Promise<Response> => {
  const fortunes = [
    "A great adventure awaits you in the digital realm.",
    "Your blockchain investments will flourish like a digital garden.",
    "The stars align for your next smart contract deployment.",
    "Fortune favors the bold - mint your destiny today.",
    "Your wallet will overflow with unexpected tokens.",
    "A mysterious NFT will bring you great joy.",
    "The oracle speaks: hodl strong, prosperity comes.",
    "Your next transaction will unlock hidden treasures.",
    "The cryptographic winds blow in your favor.",
    "A decentralized future awaits your participation.",
    "Your private keys will unlock doors to abundance.",
    "The blockchain remembers your good deeds - rewards follow.",
    "A wise trader you shall become, young padawan.",
    "Your digital footprint leads to golden opportunities.",
    "The metaverse calls your name - answer with courage."
  ];
  
  const categories = ['Love', 'Wealth', 'Health', 'Career', 'Adventure', 'Wisdom', 'Luck', 'Success'];
  
  const randomFortune = fortunes[Math.floor(Math.random() * fortunes.length)];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const randomLuckyNumber = Math.floor(Math.random() * 100) + 1;

  const fortuneData: FortuneData = {
    fortune: randomFortune,
    category: randomCategory,
    luckyNumber: randomLuckyNumber,
    price: price,
  };

  return c.json(fortuneData);
};

/**
 * RPC endpoint for Porto merchant operations
 */
app.all('/rpc', (c) => {
  return MerchantRpc.requestHandler({
    address: c.env.MERCHANT_ADDRESS as `0x${string}`,
    key: c.env.MERCHANT_PRIVATE_KEY as `0x${string}`,
    chains: [baseSepolia],
    transports: {
      [baseSepolia.id]: http('https://base-sepolia.rpc.ithaca.xyz'),
    },
    sponsor(request) {
      return true;
    },
  })(c.req.raw);
});

/**
 * Fortune endpoint with payment requirement check
 */
app.get('/api/self/fortune', async (c) => {
  // Check for X-PAYMENT header
  const paymentHeader = c.req.header('X-PAYMENT');
  
  if (!paymentHeader || paymentHeader.trim() === '') {
    // Return 402 with payment requirements
    const host = c.req.header('host') || c.req.header('Host') || 'localhost:8787';
    const protocol = c.req.url.startsWith('https') ? 'https' : 'http';
    const resource = `${protocol}://${host}${c.req.path}`;
    
    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: "base-sepolia", 
      maxAmountRequired: "750", 
      resource: resource,
      description: "Access to fortune",
      mimeType: "application/json",
      payTo: "0x50F1d3b9F5811F333e7Ef77D14B470cEAA08e905", // Blaine's hot wallet
      maxTimeoutSeconds: 60,
      asset: USDC_BASE_SEPOLIA, // Base Sepolia USDC
      extra: {
        name: "USDC",
        version: "2"
      }
    };
    
    return c.json(paymentRequirements, 402);
  }
  
  // Payment header exists, decode and execute the transfer
  console.log('Payment header received (base64):', paymentHeader);
  
  let paymentData;
  try {
    // Decode base64 JSON
    const decodedPayment = atob(paymentHeader);
    paymentData = JSON.parse(decodedPayment);
    console.log('Decoded payment data:', paymentData);
  } catch (error) {
    return c.json({ error: 'Invalid payment header format' }, 400);
  }
  
  // Validate payment data structure
  if (!paymentData.payload || !paymentData.payload.signature || !paymentData.payload.authorization) {
    return c.json({ error: 'Invalid payment data structure' }, 400);
  }
  
  const { signature, authorization } = paymentData.payload;
  console.log('Authorization details:', authorization);
  
  const merchantKeyPair = Key.fromSecp256k1({
    privateKey: c.env.MERCHANT_PRIVATE_KEY as `0x${string}`,
  });

  try {
    // Encode the transferWithAuthorization function call
    const transferData = encodeFunctionData({
      abi: [{
        name: 'transferWithAuthorization',
        type: 'function',
        inputs: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
          { name: 'signature', type: 'bytes' }
        ]
      }],
      functionName: 'transferWithAuthorization',
      args: [
        authorization.from,           // address
        authorization.to,             // address  
        BigInt(authorization.value),  // uint256 -> BigInt
        BigInt(authorization.validAfter),  // uint256 -> BigInt
        BigInt(authorization.validBefore), // uint256 -> BigInt
        authorization.nonce,          // bytes32
        signature                     // bytes
      ]
    });
    
    // Execute the EIP-3009 transfer using the signature
    const sendCallsResponse = await ServerActions.sendCalls(client, {
      account: c.env.MERCHANT_ADDRESS as `0x${string}`,
      calls: [{
        to: USDC_BASE_SEPOLIA as `0x${string}`, // USDC contract
        data: transferData,
        value: 0n
      }],
      key: merchantKeyPair,
      feeToken: USDC_BASE_SEPOLIA
    });

    const status = await waitForCallsStatus(client, {
      id: sendCallsResponse.id,
      status: (status: CallsStatus) => status.statusCode === 200,
      timeout: 20_000,
    });

    if (status.statusCode !== 200) {
      return c.json({ error: 'Payment failed' }, 500);
    }

    // Payment successful, return fortune data
    return getFortune(c, 0.001);
  } catch (error: any) {
    console.error('Payment execution failed:', error);
    return c.json({ error: 'Payment execution failed' }, 500);
  }
});

export default app;