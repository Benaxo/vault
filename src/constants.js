// Contract address on Sepolia network
export const CONTRACT_ADDRESS = "0xeE017A3036dD12Ef8d74BaFB66DDFacB87595b8C";

// ETH native address (zero address)
export const ETH_ADDRESS = "0x0000000000000000000000000000000000000000";
// BTC token address on Sepolia (à remplacer par la vraie adresse si besoin)
export const BTC_ADDRESS = "0xBtcTokenAddressOnSepolia"; // <-- À remplacer !

// Supported tokens on Sepolia
export const SUPPORTED_TOKENS = {
  ETH: ETH_ADDRESS,
  BTC: BTC_ADDRESS,
};

// Token metadata for display
export const TOKEN_METADATA = {
  [SUPPORTED_TOKENS.ETH]: {
    symbol: "ETH",
    name: "Ethereum",
    decimals: 18,
    logo: "/Ethereum_logo.png",
  },
  [SUPPORTED_TOKENS.BTC]: {
    symbol: "BTC",
    name: "Bitcoin",
    decimals: 18, // à adapter si le token BTC a une autre décimale
    logo: "/Bitcoin_logo.png",
  },
};

// Default token for deposits
export const DEFAULT_TOKEN = SUPPORTED_TOKENS.ETH;
 