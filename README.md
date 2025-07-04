# PiggyBank Vault MVP

A decentralized savings application built on Ethereum (Sepolia testnet) that allows users to set savings goals, deposit funds, and lock them until specific conditions are met.

## Features

- Connect your Ethereum wallet via RainbowKit
- Deposit ETH into your personal vault
- Set savings goals and lock periods
- View progress towards your goals
- Withdraw funds after lock period or with early withdrawal fees
- Dollar Cost Averaging (DCA) capability

## Tech Stack

- React + Vite for the frontend
- TailwindCSS for styling
- ethers.js and wagmi for blockchain interaction
- RainbowKit for wallet connection

## Getting Started

### Prerequisites

- Node.js & npm
- An Ethereum wallet (MetaMask, Coinbase Wallet, etc.)

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd piggybank-mvp
```

2. Install dependencies

```bash
npm install
```

3. Start the development server

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Contract Deployment

The smart contract address is currently set to a placeholder in the code. Before using the application, you need to:

1. Deploy the PiggyBankVault contract to Sepolia testnet
2. Update the `CONTRACT_ADDRESS` variable in the following files:
   - `src/components/VaultProgress.jsx`
   - `src/components/DepositForm.jsx`
   - `src/components/WithdrawForm.jsx`
   - `src/components/GoalSetting.jsx`

## Usage

1. Connect your wallet using the Connect Wallet button
2. Set your savings goal and unlock date
3. Deposit ETH to your vault
4. Track your progress towards your goal
5. Withdraw when your goal is reached or your lock period has ended

## Development

This is an MVP (Minimum Viable Product) implementation. Additional features planned for future releases include:

- Support for ERC20 tokens
- Multiple vaults per user
- Interest-bearing strategies
- Social features and gamification
- Mobile app

## License

MIT License

## Acknowledgements

- Solidity and Ethereum documentation
- wagmi & RainbowKit teams
- Vite & React communities
#   v a u l t  
 