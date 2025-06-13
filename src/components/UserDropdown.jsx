import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useRef, useState } from "react";

const UserDropdown = ({
  userProfile,
  user,
  address,
  authMethod,
  hasFullAccess,
  needsWalletForTransaction,
  getUserDisplayName,
  handleLogout,
  setIsLinkWalletModalOpen,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  // Get status info
  const getConnectionStatus = () => {
    if (hasFullAccess()) {
      return { status: "Fully Connected", color: "green", icon: "✅" };
    } else if (user && !needsWalletForTransaction()) {
      return { status: "Account Only", color: "yellow", icon: "⚠️" };
    } else if (address && !user) {
      return { status: "Wallet Only", color: "blue", icon: "🔗" };
    }
    return { status: "Limited Access", color: "gray", icon: "⭕" };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        onClick={toggleDropdown}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {/* User Avatar */}
        {userProfile?.photoURL ? (
          <img
            src={userProfile.photoURL}
            alt="User"
            className="w-8 h-8 rounded-full border-2 border-gray-200"
          />
        ) : (
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shadow-sm">
            {getUserDisplayName()[0]?.toUpperCase()}
          </div>
        )}

        {/* User Info - Hidden on mobile */}
        <div className="hidden lg:block text-left">
          <p className="text-sm font-medium text-gray-800 leading-tight">
            {getUserDisplayName()}
          </p>
          {/* <p className="text-xs text-gray-500 leading-tight">
            {connectionStatus.icon} {connectionStatus.status}
          </p> */}
        </div>

        {/* Dropdown Arrow */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-gray-400"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </motion.div>
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50"
          >
            {/* User Info Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-3">
                {userProfile?.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt="User"
                    className="w-12 h-12 rounded-full border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold shadow-sm">
                    {getUserDisplayName()[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {getUserDisplayName()}
                  </p>
                  {user && !userProfile?.isAnonymous && (
                    <p className="text-sm text-gray-500 truncate">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Connection Status */}
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Connection Status
              </h3>
              <div className="space-y-2">
                {/* Account Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Account:</span>
                  <div className="flex items-center space-x-1">
                    {user ? (
                      <>
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                          {userProfile?.isAnonymous
                            ? "Wallet User"
                            : "Connected"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          Not signed in
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Wallet Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Wallet:</span>
                  <div className="flex items-center space-x-1">
                    {address ? (
                      <>
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-mono">
                          {address.slice(0, 6)}...{address.slice(-4)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                          Not connected
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Overall Status Badge */}
              {/* <div className="mt-3 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-center">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      connectionStatus.color === "green"
                        ? "bg-green-100 text-green-800"
                        : connectionStatus.color === "yellow"
                        ? "bg-yellow-100 text-yellow-800"
                        : connectionStatus.color === "blue"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {connectionStatus.icon} {connectionStatus.status}
                  </span>
                </div>
              </div> */}
            </div>

            {/* Actions */}
            <div className="py-2">
              {/* Link Wallet Action */}
              {user && needsWalletForTransaction() && (
                <button
                  onClick={() => {
                    setIsLinkWalletModalOpen(true);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-yellow-50 flex items-center space-x-3 text-yellow-700 hover:text-yellow-800 transition-colors"
                >
                  <span className="text-lg">🔗</span>
                  <div>
                    <p className="font-medium">Link Wallet</p>
                    <p className="text-xs text-yellow-600">
                      Connect wallet for transactions
                    </p>
                  </div>
                </button>
              )}

              {/* Logout Action */}
              <button
                onClick={() => {
                  handleLogout();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center space-x-3 text-red-600 hover:text-red-700 transition-colors"
              >
                <span className="text-lg">🚪</span>
                <div>
                  <p className="font-medium">Sign Out</p>
                  <p className="text-xs text-red-500">
                    Disconnect from account
                  </p>
                </div>
              </button>
            </div>

            {/* Footer Info */}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
              <p className="text-xs text-gray-500 text-center">
                {authMethod === "both"
                  ? "Full access enabled"
                  : authMethod === "firebase"
                  ? "Account only - connect wallet for transactions"
                  : authMethod === "wallet"
                  ? "Wallet only - create account to save progress"
                  : "Limited access"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserDropdown;
