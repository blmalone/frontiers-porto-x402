import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MerchantRpc } from 'porto/server';
import { encodeFunctionData, isHex, parseEther } from 'viem/utils';
import { baseSepolia } from 'wagmi/chains';
import { ServerActions } from 'porto/viem';
import { waitForCallsStatus, readContract } from 'viem/actions';
import { createClient, erc20Abi, http, isAddress, hashMessage, hashTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Key } from 'porto';
import {
  Network,
  PaymentRequirements,
  Price,
  Resource,
} from 'x402/types';
import { processPriceToAtomicAmount } from 'x402/shared';
import type { Context, Next } from 'hono';
import { generateSiweNonce, parseSiweMessage } from 'viem/siwe';
import { deleteCookie, setCookie, getCookie } from 'hono/cookie';
import * as jwt from 'hono/jwt';
import { JWTPayload } from 'hono/utils/jwt/types';
import { PORTO_ABI } from './abi';
import { Json } from 'ox';

interface WeatherData {
  weather: string;
  temperature: number;
  futureDate: string;
  price: number;
}

interface PrepareCallsData {
  typedData: any;
  [key: string]: any;
}

interface CallsStatus {
  statusCode: number;
  receipts?: Array<{ transactionHash: `0x${string}` }>;
}

// Instantiate a Viem Client with Porto-compatible Chain
export const client = createClient({
  chain: baseSepolia,
  transport: http('https://base-sepolia.rpc.ithaca.xyz'),
});

const app = new Hono<{ Bindings: Env }>();

/**
 * CORS configuration for the application
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
 * Middleware to require self-payment for protected resources
 */
const requireSelfPayment = (amount: string) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const host = c.req.header('host') || c.req.header('Host');
    const protocol = c.req.url.startsWith('https') ? 'https' : 'http';
    const resource = `${protocol}://${host}${c.req.path}` as Resource;
    const merchantSigningKeyAddress = privateKeyToAccount(c.env.MERCHANT_PRIVATE_KEY as `0x${string}`).address;

    const signature = c.req.header("X-PAYMENT") as `0x${string}`;
    const userAddress = c.req.header("X-USER-ADDRESS") as `0x${string}`;
    
    if (!signature || !isHex(signature)) {
      return await handleMissingPayment(c, amount, resource, merchantSigningKeyAddress, userAddress);
    }

    if (!userAddress) {
      return c.json({ error: 'User address is required' }, 401);
    }

    return await processPayment(c, userAddress, signature, amount, next);
  };
};

/**
 * Handles cases where payment is missing and returns payment requirements
 */
const handleMissingPayment = async (
  c: Context<{ Bindings: Env }>,
  amount: string,
  resource: Resource,
  merchantSigningKeyAddress: `0x${string}`,
  userAddress: `0x${string}`
) => {
  const price = createPriceObject(amount);
  const paymentRequirements = createExactPaymentRequirements(
    price,
    "base-sepolia",
    resource,
    "Access to weather data (async)",
    merchantSigningKeyAddress,
  );

  const superAdminKey = await readContract(client, {
    address: userAddress as `0x${string}`,
    abi: PORTO_ABI,
    functionName: 'keyAt',
    args: [BigInt(0)],
  });

  const { prepareCallsResponse, digest } = await selfPaymentPrepareCalls(
    client, 
    parseEther(amount), 
    superAdminKey, 
    userAddress, 
    c.env.MERCHANT_ADDRESS
  );

  const stringifiedPrepareCalls = Json.stringify(prepareCallsResponse);
  await c.env.PREPARE_CALLS_STORE.put(userAddress, stringifiedPrepareCalls, { expirationTtl: 600 });

  return c.json({
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: paymentRequirements,
    prepareCalls: stringifiedPrepareCalls,
    digest: digest,
  }, 402);
};

/**
 * Processes the payment signature and executes the transaction
 */
const processPayment = async (
  c: Context<{ Bindings: Env }>,
  userAddress: `0x${string}`,
  signature: `0x${string}`,
  amount: string,
  next: Next
) => {
  const storedPrepareCalls = await c.env.PREPARE_CALLS_STORE.get(userAddress);
  const parsedPrepareCalls: PrepareCallsData = Json.parse(storedPrepareCalls || null);

  if (!parsedPrepareCalls) {
    return c.json({ error: 'Server unaware of payment. Please try again.' }, 401);
  }

  const typedData = parsedPrepareCalls.typedData;
  const typedDataHash = hashTypedData(typedData);

  const { valid } = await ServerActions.verifySignature(client, {
    address: userAddress,
    digest: typedDataHash,
    signature,
  });

  if (!valid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const response = await ServerActions.sendPreparedCalls(client, {
    ...parsedPrepareCalls,
    signature,
    chain: baseSepolia,
  } as any); // TODO: fix this type error

  const status = await waitForCallsStatus(client, {
    id: response.id,
    status: (status: CallsStatus) => status.statusCode === 200,
    timeout: 20_000,
  });

  if (status.statusCode !== 200) {
    throw new Error('Payment failed');
  }

  await c.env.PREPARE_CALLS_STORE.delete(userAddress);
  await next();
};

/**
 * Middleware to require delegated payment for protected resources
 */
const requireDelegatedPayment = (serverSpendLimit: string, contentPrice: string) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const host = c.req.header('host') || c.req.header('Host');
    const protocol = c.req.url.startsWith('https') ? 'https' : 'http';
    const resource = `${protocol}://${host}${c.req.path}` as Resource;

    let userAddress: `0x${string}`;
    try {
      const user = await verifyAuth(c);
      userAddress = user.sub as `0x${string}`;
    } catch (error) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const merchantKeyPair = Key.fromSecp256k1({
      privateKey: c.env.MERCHANT_PRIVATE_KEY as `0x${string}`,
    });

    try {
      const sendCallsResponse = await ServerActions.sendCalls(client, {
        account: userAddress,
        calls: [{
          to: "0x29f45fc3ed1d0ffafb5e2af9cc6c3ab1555cd5a2" as `0x${string}`,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [c.env.MERCHANT_ADDRESS, parseEther(contentPrice)]
          }),
          value: 0n // No ETH value for ERC20 transfers 
        }],
        key: merchantKeyPair,
        feeToken: "0x29f45fc3ed1d0ffafb5e2af9cc6c3ab1555cd5a2"
      });

      const status = await waitForCallsStatus(client, {
        id: sendCallsResponse.id,
        status: (status: CallsStatus) => status.statusCode === 200,
        timeout: 20_000,
      });

      if (status.statusCode !== 200) {
        return c.json({ error: 'Payment failed' }, 500);
      }

      await next();
    } catch (error: any) {
      return await handleDelegatedPaymentError(c, serverSpendLimit, resource);
    }
  };
};

/**
 * Handles delegated payment errors by returning payment requirements
 */
const handleDelegatedPaymentError = async (
  c: Context<{ Bindings: Env }>,
  serverSpendLimit: string,
  resource: Resource
) => {
  const merchantSigningKeyAddress = privateKeyToAccount(c.env.MERCHANT_PRIVATE_KEY as `0x${string}`).address;
  const totalServerSpendDetails = createPriceObject(serverSpendLimit);

  const paymentRequirements = createExactPaymentRequirements(
    totalServerSpendDetails,
    "base-sepolia",
    resource,
    "Access to weather data (async)",
    merchantSigningKeyAddress,
  );

  return c.json({
    x402Version: 1,
    error: "X-PAYMENT header is required",
    accepts: paymentRequirements,
  }, 402);
};

/**
 * Creates a price object with the standard token configuration
 */
const createPriceObject = (amount: string): Price => {
  return {
    amount: parseEther(amount).toString(),
    asset: {
      address: "0x29f45fc3ed1d0ffafb5e2af9cc6c3ab1555cd5a2" as `0x${string}`,
      decimals: 18,  // Correct decimals for Exp token
      eip712: {
        name: "Exp",  // Correct name for Exp token
        version: "1", // Default version
      },
    },
  };
};

/**
 * Creates exact payment requirements for the specified price and resource
 */
function createExactPaymentRequirements(
  price: Price,
  network: Network,
  resource: Resource,
  description = "",
  recipient: `0x${string}`
): PaymentRequirements {
  const atomicAmountForAsset = processPriceToAtomicAmount(price, network);
  if ("error" in atomicAmountForAsset) {
    throw new Error(atomicAmountForAsset.error);
  }
  const { maxAmountRequired, asset } = atomicAmountForAsset;

  return {
    scheme: "exact",
    network,
    maxAmountRequired,
    resource,
    description,
    mimeType: "",
    payTo: recipient,
    maxTimeoutSeconds: 60,
    asset: asset.address,
    outputSchema: undefined,
    extra: {
      name: asset.eip712.name,
      version: asset.eip712.version,
    },
  };
}

/**
 * Prepares calls for self-payment scenarios
 */
const selfPaymentPrepareCalls = async (
  client: any,
  amount: bigint,
  superAdminKey: any,
  fromAddress: `0x${string}`,
  toAddress: `0x${string}`
) => {
  const prepareCallsResponse = await ServerActions.prepareCalls(client, {
    account: fromAddress as `0x${string}`,
    calls: [{
      to: toAddress as `0x${string}`,
      value: amount,
      data: '0x' as `0x${string}`,
    }],
    key: {
      publicKey: superAdminKey.publicKey,
      type: "webauthn-p256",
    },
    feeToken: '0x29f45fc3ed1d0ffafb5e2af9cc6c3ab1555cd5a2',
    chain: baseSepolia,
  }) as any;

  const hashedTypedData = hashTypedData(prepareCallsResponse.typedData);
  return { prepareCallsResponse, digest: hashedTypedData };
};

/**
 * Verifies JWT authentication from cookie
 */
const verifyAuth = async (c: Context<{ Bindings: Env }>): Promise<JWTPayload> => {
  const authCookie = getCookie(c, 'auth');
  if (!authCookie) {
    throw new Error('No auth cookie found');
  }
  return await jwt.verify(authCookie, c.env.JWT_SECRET);
};

/**
 * Generates mock weather data for the specified price
 */
const getWeather = async (c: Context<{ Bindings: Env }>, price: number): Promise<Response> => {
  const weatherConditions = ['sunny', 'cloudy', 'rainy', 'snowy', 'foggy', 'windy', 'stormy', 'partly cloudy'];
  const randomWeather = weatherConditions[Math.floor(Math.random() * weatherConditions.length)];
  const randomTemperature = Math.floor(Math.random() * 80) + 20; // Random temp between 20-99°F

  const weatherData: WeatherData = {
    weather: randomWeather,
    temperature: randomTemperature,
    futureDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    price: price,
  };

  return c.json(weatherData);
};

/**
 * RPC endpoint for merchant operations
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
 * Generate SIWE nonce for authentication
 */
app.get('/siwe/nonce', async (c) => {
  const nonce = generateSiweNonce();
  
  // Store nonce for this session (10 minutes)
  await c.env.NONCE_STORE.put(nonce, 'valid', { expirationTtl: 600 });

  return c.json({ nonce });
});

/**
 * Verify SIWE signature and create authenticated session
 */
app.post('/siwe', async (c) => {
  const { message, signature } = await c.req.json();
  const { address, chainId, nonce } = parseSiweMessage(message);

  if (!nonce) return c.json({ error: 'Nonce is required' }, 400);

  const storedNonce = await c.env.NONCE_STORE.get(nonce);
  if (!storedNonce) return c.json({ error: 'Invalid or expired nonce' }, 401);
  await c.env.NONCE_STORE.delete(nonce);

  const validResponse = await ServerActions.verifySignature(client, {
    address: address!,
    digest: hashMessage(message),
    signature,
  });

  if (!validResponse || !validResponse.valid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const token = await jwt.sign({ exp, sub: address }, c.env.JWT_SECRET);

  setCookie(c, 'auth', token, {
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge,
  });

  return c.json({ success: true });
});

/**
 * Logout endpoint - clears authentication cookie
 */
app.post('/logout', async (c) => {
  deleteCookie(c, 'auth');
  return c.json({ success: true });
});

/**
 * Get authenticated user information
 */
app.get('/api/me', async (c) => {
  try {
    const user = await verifyAuth(c);
    return c.json({ user: user });
  } catch (error) {
    return c.json({ error: 'Authentication failed' }, 401);
  }
});

/**
 * Protected weather endpoint using delegated payment
 */
app.get('/api/delegated/weather',
  requireDelegatedPayment('2', '0.001'),
  async (c) => {
    return getWeather(c, 0.001);
  }
);

/**
 * Protected weather endpoint using self-payment
 */
app.get('/api/self/weather',
  requireSelfPayment('0.001'),
  async (c) => {
    return getWeather(c, 0.001);
  }
);

export default app;