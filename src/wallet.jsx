import { getDefaultWallets, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { configureChains, createConfig, WagmiConfig } from "wagmi";
import { sepolia } from "wagmi/chains";
import { jsonRpcProvider } from "wagmi/providers/jsonRpc";
import { publicProvider } from "wagmi/providers/public";

const CUSTOM_RPC_URL =
  "https://eth-sepolia.g.alchemy.com/v2/Ewv4wKShqR3fa4cKQVhKMn0WUFgEHNa2";

const WALLETCONNECT_PROJECT_ID = "a537f38e4525812ab405820836893a89";

const { chains, publicClient } = configureChains(
  [sepolia],
  [
    jsonRpcProvider({
      rpc: () => ({
        http: CUSTOM_RPC_URL,
      }),
    }),
    publicProvider(), // Fallback, moins fiable
  ]
);

const { connectors } = getDefaultWallets({
  appName: "PiggyBank MVP",
  projectId: WALLETCONNECT_PROJECT_ID,
  chains,
});

const config = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

export function WalletProvider({ children }) {
  return (
    <WagmiConfig config={config}>
      <RainbowKitProvider chains={chains}>{children}</RainbowKitProvider>
    </WagmiConfig>
  );
}
