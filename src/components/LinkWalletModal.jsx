import { AnimatePresence, motion } from "framer-motion";
import React, { useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { linkWalletToUser } from "../services/userService";

const LinkWalletModal = ({ isOpen, onClose, user, onSuccess }) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const [isLinking, setIsLinking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Handle wallet connection and linking
  const handleConnectAndLink = async (connector) => {
    try {
      setIsLinking(true);
      setError("");

      // Connect wallet if not connected
      if (!isConnected) {
        await connect({ connector });
        // Wait a bit for the connection to establish
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Link the wallet to user account
      if (address && user) {
        await linkWalletToUser(user.uid, address);
        setSuccess("✅ Wallet successfully linked to your account!");
        onSuccess && onSuccess();

        // Close modal after success
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error("Error linking wallet:", error);
      setError(error.message || "Failed to link wallet. Please try again.");
    } finally {
      setIsLinking(false);
    }
  };

  // Handle linking existing connected wallet
  const handleLinkExistingWallet = async () => {
    if (!address || !user) return;

    try {
      setIsLinking(true);
      setError("");

      await linkWalletToUser(user.uid, address);
      setSuccess("✅ Wallet successfully linked to your account!");
      onSuccess && onSuccess();

      // Close modal after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error linking wallet:", error);
      setError(error.message || "Failed to link wallet. Please try again.");
    } finally {
      setIsLinking(false);
    }
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="bg-white rounded-lg p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">🔗 Link Wallet</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              disabled={isLinking}
            >
              ×
            </button>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
              {success}
            </div>
          )}

          {!success && (
            <>
              {/* Info */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">
                  Why link your wallet?
                </h3>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li>• Make blockchain transactions seamlessly</li>
                  <li>• Keep your savings goals and progress synced</li>
                  <li>• Access your data from any device</li>
                </ul>
              </div>

              {/* Current Status */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">
                  Current Status:
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Account:</span>
                    <span className="text-green-600 font-medium">
                      {user?.email || "Connected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Wallet:</span>
                    <span
                      className={`font-medium ${
                        isConnected ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {isConnected
                        ? `${address?.slice(0, 6)}...${address?.slice(-4)}`
                        : "Not connected"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {isConnected ? (
                  // Wallet is already connected, just link it
                  <button
                    onClick={handleLinkExistingWallet}
                    disabled={isLinking}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                  >
                    {isLinking ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Linking...
                      </div>
                    ) : (
                      "Link Current Wallet"
                    )}
                  </button>
                ) : (
                  // Show wallet connection options
                  <>
                    <h3 className="font-semibold text-gray-800 mb-3">
                      Choose your wallet:
                    </h3>
                    {connectors.map((connector) => (
                      <button
                        key={connector.id}
                        onClick={() => handleConnectAndLink(connector)}
                        disabled={isLinking}
                        className="w-full bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                      >
                        {isLinking ? (
                          <div className="flex items-center">
                            <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                            Connecting...
                          </div>
                        ) : (
                          <>
                            <img
                              src={`https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg`}
                              alt={connector.name}
                              className="w-6 h-6 mr-3"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                            Connect {connector.name}
                          </>
                        )}
                      </button>
                    ))}
                  </>
                )}

                {/* Cancel Button */}
                <button
                  onClick={onClose}
                  disabled={isLinking}
                  className="w-full bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>

              {/* Additional Info */}
              <div className="mt-6 text-xs text-gray-500 text-center">
                Your wallet will be securely linked to your account. You can
                unlink it anytime in your profile settings.
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LinkWalletModal;
