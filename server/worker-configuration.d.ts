declare namespace Cloudflare {
    interface Env {
      MERCHANT_ADDRESS: `0x${string}`
      MERCHANT_PRIVATE_KEY: `0x${string}`
    }
  }
interface Env extends Cloudflare.Env {}