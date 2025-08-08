import { porto } from 'porto/wagmi'
import { createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { Mode } from 'porto'
import { SERVER_URL } from './constants'

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  multiInjectedProviderDiscovery: false,
  connectors: [porto({ merchantRpcUrl: `${SERVER_URL}/rpc`, mode: Mode.dialog(), authUrl: SERVER_URL })],
  transports: {
    [baseSepolia.id]: http("https://base-sepolia.rpc.ithaca.xyz"),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}