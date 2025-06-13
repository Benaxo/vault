import { motion } from "framer-motion";
import React, { useState } from "react";
import { useAccount, useConnect } from "wagmi";

const TransactionHelper = ({
  userProfile,
  authMethod,
  children,
  onWalletConnected,
}) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [error, setError] = useState("");

  // Check if user can make transactions
  const canMakeTransaction = () => {
    return userProfile && isConnected && address;
  };

  // Connect wallet for transaction
  const handleConnectWalletForTransaction = async (connector) => {
    try {
      setIsConnectingWallet(true);
      setError("");
      await connect({ connector });

      // Wait for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (onWalletConnected) {
        onWalletConnected();
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      setError("Failed to connect wallet. Please try again.");
    } finally {
      setIsConnectingWallet(false);
    }
  };

  // If no user profile, show sign-in message
  if (!userProfile) {
    return (
      <div className="text-center py-8">
        <div className="bg-blue-50 rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            🔐 Authentication Required
          </h3>
          <p className="text-blue-700">
            Please sign in to access this feature.
          </p>
        </div>
      </div>
    );
  }

  // If wallet not connected, show connection options
  if (!isConnected) {
    return (
      <div className="max-w-md mx-auto">
        {/* Access Level Info */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Account Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Account:</span>
              <span className="text-green-600 font-medium">
                {userProfile.isAnonymous ? "Wallet User" : "✅ Connected"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Wallet:</span>
              <span className="text-red-600 font-medium">❌ Not connected</span>
            </div>
          </div>
        </div>

        {/* Error Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Wallet Connection Required */}
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-3">
            🔗 Wallet Required for Transactions
          </h3>
          <p className="text-yellow-700 mb-4">
            To make blockchain transactions, you need to connect your wallet.
            Choose your preferred wallet:
          </p>
          <div className="space-y-2">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => handleConnectWalletForTransaction(connector)}
                disabled={isConnectingWallet}
                className="w-full bg-yellow-100 hover:bg-yellow-200 disabled:bg-yellow-50 text-yellow-800 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {isConnectingWallet ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                    Connecting...
                  </div>
                ) : (
                  <>
                    <img
                      src={`https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg`}
                      alt={connector.name}
                      className="w-5 h-5 mr-2"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    Connect {connector.name}
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">
            Why do I need to connect my wallet?
          </h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Execute blockchain transactions (deposits, withdrawals)</li>
            <li>• Sign transactions securely with your private keys</li>
            <li>• Interact directly with the smart contract</li>
            <li>• Maintain full control over your funds</li>
          </ul>
        </div>
      </div>
    );
  }

  // Wallet is connected, render children (the actual transaction component)
  return (
    <div>
      {/* Access Level Info */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-4 bg-green-50 rounded-lg"
      >
        <h3 className="font-semibold text-green-800 mb-2">Account Status</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Account:</span>
            <span className="text-green-600 font-medium">
              {userProfile.isAnonymous ? "Wallet User" : "✅ Connected"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Wallet:</span>
            <span className="text-green-600 font-medium">
              ✅ {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Render children (transaction forms) */}
      {children}
    </div>
  );
};

export default TransactionHelper;
