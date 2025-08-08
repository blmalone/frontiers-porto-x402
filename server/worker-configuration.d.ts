declare namespace Cloudflare {
    interface Env {
      MERCHANT_ADDRESS: `0x${string}`
      MERCHANT_PRIVATE_KEY: `0x${string}`
      NONCE_STORE: KVNamespace
      JWT_SECRET: string
      PREPARE_CALLS_STORE: KVNamespace
    }
  }
interface Env extends Cloudflare.Env {}