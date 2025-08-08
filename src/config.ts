import { porto } from 'porto/wagmi'
import { createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { Dialog, Mode } from 'porto'
import { SERVER_URL } from './constants'

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [porto({
    merchantRpcUrl: `${SERVER_URL}/rpc`,
    mode: Mode.dialog({
      host: 'https://localhost:5175/dialog/',
      // You might also need to configure the renderer for local development
      // renderer: Dialog.iframe({
      //   skipProtocolCheck: true, // Allows http/https mixed content
      //   skipUnsupported: true,   // Skips browser compatibility checks
      // }),
    })
  })],
  transports: {
    [baseSepolia.id]: http("https://base-sepolia.rpc.ithaca.xyz"),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}