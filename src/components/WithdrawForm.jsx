import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  useAccount,
  useContractRead,
  useContractWrite,
  useWaitForTransaction,
} from "wagmi";
import PiggyBankVaultABI from "../abi/PiggyBankVault.json";
import { CONTRACT_ADDRESS } from "../constants";
import { useAuth } from "../hooks/useAuth";
import { getUserGoals } from "../services/userService";

export const WithdrawForm = () => {
  const { address } = useAccount();
  const { user } = useAuth();
  const [userGoals, setUserGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [amount, setAmount] = useState("");
  const [isEarlyWithdrawal, setIsEarlyWithdrawal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Get selected goal details from blockchain
  const { data: goalBasics } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "getGoalBasics",
    args: [selectedGoalId],
    enabled: Boolean(selectedGoalId),
  });

  const { data: goalDescription } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "getGoalDescription",
    args: [selectedGoalId],
    enabled: Boolean(selectedGoalId),
  });

  const { data: isGoalReached } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "isGoalReached",
    args: [selectedGoalId],
    enabled: Boolean(selectedGoalId),
  });

  // Debug logging
  useEffect(() => {
    console.log("🔍 WithdrawForm Debug Info:");
    console.log("- selectedGoalId:", selectedGoalId);
    console.log("- goalBasics:", goalBasics);
    console.log("- goalDescription:", goalDescription);
    console.log("- isGoalReached:", isGoalReached);
    console.log("- userGoals:", userGoals);
    console.log("- address:", address);

    if (goalBasics) {
      console.log("📊 Goal Basics Details:");
      console.log("- balance (index 0):", goalBasics[0]?.toString());
      console.log("- goalType (index 1):", goalBasics[1]?.toString());
      console.log("- targetValue (index 2):", goalBasics[2]?.toString());
      console.log("- currency (index 3):", goalBasics[3]?.toString());
      console.log("- unlockTimestamp (index 4):", goalBasics[4]?.toString());
      console.log("- owner (index 5):", goalBasics[5]);
      console.log("- isActive (index 6):", goalBasics[6]);
    }
  }, [
    selectedGoalId,
    goalBasics,
    goalDescription,
    isGoalReached,
    userGoals,
    address,
  ]);

  // Load user's goals with blockchain IDs
  useEffect(() => {
    const loadGoals = async () => {
      if (!user && !address) return;

      try {
        setIsLoading(true);
        let goals = [];

        console.log("📋 Loading goals for withdrawal...");
        console.log("- user:", user?.uid);
        console.log("- address:", address);

        if (user) {
          goals = await getUserGoals(user.uid);
          console.log("📋 Firebase goals loaded:", goals);
        }

        // Filter goals that have blockchain IDs and are active
        const withdrawableGoals = goals.filter((goal) => {
          const hasBlockchainId = Boolean(goal.blockchainGoalId);
          const isActive = Boolean(goal.isActive);
          const hasBalance = parseFloat(goal.currentBalance || 0) > 0;

          console.log(`📋 Goal ${goal.id} filter check:`, {
            hasBlockchainId,
            isActive,
            hasBalance,
            blockchainGoalId: goal.blockchainGoalId,
            currentBalance: goal.currentBalance,
            description: goal.description,
          });

          return hasBlockchainId && isActive;
        });

        console.log("📋 Withdrawable goals after filter:", withdrawableGoals);
        setUserGoals(withdrawableGoals);

        // Auto-select first goal if available
        if (withdrawableGoals.length > 0 && !selectedGoalId) {
          const firstGoalId = withdrawableGoals[0].blockchainGoalId;
          console.log("📋 Auto-selecting goal ID:", firstGoalId);
          setSelectedGoalId(firstGoalId);
        }
      } catch (error) {
        console.error("❌ Error loading goals:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadGoals();
  }, [user, address, selectedGoalId]);

  // Contract writes
  const { data: withdrawData, write: withdrawWrite } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "withdraw",
    args: [selectedGoalId],
    enabled: Boolean(selectedGoalId),
  });

  const { data: earlyWithdrawData, write: earlyWithdrawWrite } =
    useContractWrite({
      address: CONTRACT_ADDRESS,
      abi: PiggyBankVaultABI,
      functionName: "withdrawEarly",
      args: [
        selectedGoalId,
        amount ? BigInt(parseFloat(amount) * 1e18) : BigInt(0),
      ],
      enabled: Boolean(selectedGoalId && amount),
    });

  // Wait for transactions
  const { isLoading: isConfirmingWithdraw, isSuccess: isWithdrawSuccess } =
    useWaitForTransaction({
      hash: withdrawData?.hash,
    });

  const {
    isLoading: isConfirmingEarlyWithdraw,
    isSuccess: isEarlyWithdrawSuccess,
  } = useWaitForTransaction({
    hash: earlyWithdrawData?.hash,
  });

  // Combined loading and success states
  const isTransactionLoading =
    isConfirmingWithdraw || isConfirmingEarlyWithdraw;
  const isSuccess = isWithdrawSuccess || isEarlyWithdrawSuccess;

  // Format the ETH balance
  const formatEth = (wei) => {
    if (!wei) return "0";
    const weiStr = wei.toString();
    console.log("💰 Formatting ETH - Wei input:", weiStr);
    const ethValue = (Number(weiStr) / 1e18).toFixed(4);
    console.log("💰 Formatted ETH output:", ethValue);
    return ethValue;
  };

  // Calculate time remaining until unlock
  const getTimeRemaining = () => {
    if (!goalBasics || !goalBasics[4]) {
      console.log("⏰ No goalBasics or unlockTimestamp");
      return null;
    }

    const unlockTime = Number(goalBasics[4]);
    const now = Math.floor(Date.now() / 1000);

    console.log("⏰ Time calculation:");
    console.log("- unlockTimestamp:", unlockTime);
    console.log("- current time:", now);
    console.log("- difference:", unlockTime - now);

    if (now >= unlockTime) return "Available to withdraw";

    const secondsRemaining = unlockTime - now;
    const days = Math.floor(secondsRemaining / 86400);
    const hours = Math.floor((secondsRemaining % 86400) / 3600);

    return `${days} days, ${hours} hours remaining`;
  };

  // Check if withdrawal is allowed
  const isWithdrawalAllowed = () => {
    if (!goalBasics) {
      console.log("🚫 No goalBasics for withdrawal check");
      return false;
    }
    const unlockTime = Number(goalBasics[4]);
    const now = Math.floor(Date.now() / 1000);
    const allowed = now >= unlockTime;
    console.log("🚫 Withdrawal allowed:", allowed);
    return allowed;
  };

  // Calculate penalty amount (10% penalty for early withdrawal)
  const calculatePenalty = () => {
    if (!amount || !goalBasics) return "0";
    const penalty = Number(amount) * 0.1;
    return penalty.toFixed(4);
  };

  // Get max withdrawable amount
  const getMaxAmount = () => {
    if (!goalBasics) {
      console.log("💸 No goalBasics for max amount");
      return 0;
    }
    const maxAmount = parseFloat(formatEth(goalBasics[0]));
    console.log("💸 Max withdrawable amount:", maxAmount);
    return maxAmount;
  };

  // Find matching Firebase goal for additional info
  const getMatchingFirebaseGoal = () => {
    return userGoals.find((goal) => goal.blockchainGoalId === selectedGoalId);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!selectedGoalId) {
      alert("Please select a goal to withdraw from");
      return;
    }

    if (isEarlyWithdrawal) {
      if (!amount || parseFloat(amount) <= 0) {
        alert("Please enter a valid amount");
        return;
      }
      if (parseFloat(amount) > getMaxAmount()) {
        alert("Amount exceeds available balance");
        return;
      }
      if (earlyWithdrawWrite) {
        earlyWithdrawWrite();
      }
    } else {
      if (!isWithdrawalAllowed()) {
        alert("Your goal hasn't reached its unlock date yet");
        return;
      }
      if (withdrawWrite) {
        withdrawWrite();
      }
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-white shadow-xl rounded-lg p-8 max-w-2xl mx-auto"
    >
      <motion.h2
        variants={itemVariants}
        className="text-3xl font-bold text-gray-800 mb-6 flex items-center"
      >
        <span className="mr-3">💸</span> Withdraw Funds
      </motion.h2>

      {!address ? (
        <motion.p
          variants={itemVariants}
          className="text-gray-600 text-center py-8"
        >
          Please connect your wallet to withdraw funds.
        </motion.p>
      ) : isLoading ? (
        <motion.div variants={itemVariants} className="text-center py-8">
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
            Loading your goals...
          </div>
        </motion.div>
      ) : userGoals.length === 0 ? (
        <motion.div variants={itemVariants} className="text-center py-8">
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-6 rounded">
            <p className="font-bold">No Withdrawable Goals</p>
            <p>You don't have any goals with funds available for withdrawal.</p>
            <p className="mt-2 text-sm">
              Create goals and make deposits to start saving!
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Goal Selection */}
          {userGoals.length > 1 && (
            <motion.div variants={itemVariants} className="mb-6">
              <h3 className="font-bold text-gray-800 mb-3 text-lg">
                Select Goal to Withdraw From
              </h3>
              <div className="grid gap-3">
                {userGoals.map((goal) => (
                  <motion.button
                    key={goal.id}
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      selectedGoalId === goal.blockchainGoalId
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedGoalId(goal.blockchainGoalId)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-800">
                          {goal.description || "Savings Goal"}
                        </h4>
                        <p className="text-sm text-gray-600">
                          Balance: {goal.currentBalance || "0"} ETH
                        </p>
            </div>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          selectedGoalId === goal.blockchainGoalId
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        }`}
              >
                        {selectedGoalId === goal.blockchainGoalId && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
            </div>
          </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Goal Status */}
          {selectedGoalId && (
            <motion.div
              variants={itemVariants}
              className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg"
            >
              <h3 className="font-bold text-gray-800 mb-4 text-lg">
                {getMatchingFirebaseGoal()?.description ||
                  goalDescription ||
                  "Goal"}{" "}
                Status
              </h3>

              {/* Debug info */}
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-gray-600">
                <strong>Debug Info:</strong>
                <br />
                Selected Goal ID: {selectedGoalId}
                <br />
                Goal Basics Available: {goalBasics ? "Yes" : "No"}
                <br />
                {goalBasics && (
                  <>
                    Raw Balance: {goalBasics[0]?.toString() || "undefined"}
                    <br />
                    Raw Timestamp: {goalBasics[4]?.toString() || "undefined"}
                    <br />
                    Goal Type: {goalBasics[1]?.toString() || "undefined"}
                    <br />
                    Is Active: {goalBasics[6]?.toString() || "undefined"}
                    <br />
                    Owner: {goalBasics[5] || "undefined"}
                  </>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <span className="text-gray-600 block mb-1">
                    Current Balance
                  </span>
                  <span className="text-2xl font-bold text-blue-600">
                    {goalBasics ? formatEth(goalBasics[0]) : "Loading..."} ETH
                  </span>
                  {!goalBasics && (
                    <div className="text-sm text-gray-500 mt-1">
                      Waiting for blockchain data...
                    </div>
                  )}
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <span className="text-gray-600 block mb-1">
                    Time Remaining
                  </span>
                  <span className="text-2xl font-bold text-purple-600">
                    {goalBasics
                      ? getTimeRemaining() || "Not set"
                      : "Loading..."}
                  </span>
                  {!goalBasics && (
                    <div className="text-sm text-gray-500 mt-1">
                      Waiting for blockchain data...
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Withdrawal Options */}
          <motion.div variants={itemVariants} className="mb-8">
            <h3 className="font-bold text-gray-800 mb-4 text-lg">
              Withdrawal Options
            </h3>

            {/* Withdrawal Type Selection */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-4 rounded-lg text-center transition-colors ${
                  !isEarlyWithdrawal
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setIsEarlyWithdrawal(false)}
              >
                <div className="text-lg font-bold mb-1">Regular Withdrawal</div>
                <div className="text-sm opacity-80">
                  Available when goal is reached
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`p-4 rounded-lg text-center transition-colors ${
                  isEarlyWithdrawal
                    ? "bg-yellow-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                onClick={() => setIsEarlyWithdrawal(true)}
              >
                <div className="text-lg font-bold mb-1">Early Withdrawal</div>
                <div className="text-sm opacity-80">10% penalty applies</div>
              </motion.button>
            </div>

            {/* Withdrawal Form */}
            <motion.form
              variants={itemVariants}
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {isEarlyWithdrawal && (
                <div>
                  <label
                    htmlFor="amount"
                    className="block text-gray-700 text-sm font-bold mb-2"
                  >
                    Amount to Withdraw (ETH)
                  </label>
                  <div className="relative">
                  <input
                    type="number"
                    id="amount"
                      className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      placeholder={`Max: ${formatEth(goalBasics?.[0])}`}
                    step="0.01"
                    min="0"
                      max={formatEth(goalBasics?.[0])}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                      disabled={isTransactionLoading}
                  />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-500">ETH</span>
                    </div>
                  </div>

                  {/* Penalty Warning */}
                  {amount && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-700 rounded-lg"
                    >
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">⚠️</span>
                        <div>
                          <p className="font-bold">Early Withdrawal Penalty</p>
                          <p>
                            You will be charged {calculatePenalty()} ETH (10%)
                            as a penalty.
                          </p>
                          <p className="mt-1 text-sm">
                            You will receive:{" "}
                            {(
                              Number(amount) - Number(calculatePenalty())
                            ).toFixed(4)}{" "}
                            ETH
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              type="submit"
                className={`w-full ${
                  isEarlyWithdrawal
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-green-600 hover:bg-green-700"
                } text-white font-bold py-3 px-6 rounded-lg transition-colors ${
                  isTransactionLoading || (!isEarlyWithdrawal && !isGoalReached)
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={
                  isTransactionLoading || (!isEarlyWithdrawal && !isGoalReached)
                }
              >
                {isTransactionLoading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Processing...
                  </div>
                ) : isEarlyWithdrawal ? (
                  "Withdraw with Penalty"
                ) : (
                  "Withdraw Funds"
                )}
              </motion.button>

            {isSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-green-100 text-green-700 rounded-lg"
                >
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">🎉</span>
                    <div>
                      <p className="font-bold">Withdrawal Successful!</p>
                      <p>Your funds have been sent to your wallet.</p>
                    </div>
              </div>
                </motion.div>
            )}
            </motion.form>
          </motion.div>

          {/* Tips Section */}
          <motion.div
            variants={itemVariants}
            className="bg-gray-50 p-6 rounded-lg"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              💡 Withdrawal Tips
            </h3>
            <ul className="space-y-2 text-gray-600">
              <li>
                • Regular withdrawals are available when you reach your goal
              </li>
              <li>• Early withdrawals come with a 10% penalty</li>
              <li>• Make sure you have enough ETH for gas fees</li>
              <li>
                • You can withdraw your entire balance or a partial amount
              </li>
            </ul>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default WithdrawForm;
