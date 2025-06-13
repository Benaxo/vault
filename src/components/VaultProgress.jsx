import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { useAccount, useContractRead } from "wagmi";
import PiggyBankVaultABI from "../abi/PiggyBankVault.json";
import { CONTRACT_ADDRESS } from "../constants";
import { useAuth } from "../hooks/useAuth";
import { getUserGoals } from "../services/userService";

const VaultProgress = () => {
  const { address } = useAccount();
  const { user } = useAuth();
  const [userGoals, setUserGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get user's goals from blockchain
  const { data: blockchainGoals } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "getUserGoals",
    args: [address],
    enabled: Boolean(address),
  });

  // Get selected goal details from blockchain
  const { data: goalBasics, isError: isGoalError } = useContractRead({
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

  // Load user's goals from Firebase and match with blockchain
  useEffect(() => {
    const loadGoals = async () => {
      if (!user && !address) return;

      try {
        setIsLoading(true);
        let goals = [];

        if (user) {
          goals = await getUserGoals(user.uid);
        }

        // Filter goals that have blockchain IDs and match with blockchain data
        const activeGoals = goals.filter(
          (goal) => goal.blockchainGoalId && goal.isActive
        );

        setUserGoals(activeGoals);

        // Auto-select first goal if available
        if (activeGoals.length > 0 && !selectedGoalId) {
          setSelectedGoalId(activeGoals[0].blockchainGoalId);
        } else if (
          blockchainGoals &&
          blockchainGoals.length > 0 &&
          !selectedGoalId
        ) {
          // Fallback to first blockchain goal if no Firebase goals
          setSelectedGoalId(blockchainGoals[0]);
        }
      } catch (error) {
        console.error("Error loading goals:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadGoals();
  }, [user, address, blockchainGoals, selectedGoalId]);

  // Format the ETH balance
  const formatEth = (wei) => {
    if (!wei) return "0";
    return (Number(wei) / 1e18).toFixed(4);
  };

  // Calculate progress percentage
  const calculateProgress = () => {
    if (!goalBasics || !goalBasics.goal || Number(goalBasics.goal) === 0)
      return 0;
    return (Number(goalBasics.balance) / Number(goalBasics.goal)) * 100;
  };

  // Format unlock date
  const formatUnlockDate = () => {
    if (
      !goalBasics ||
      !goalBasics.unlockTimestamp ||
      Number(goalBasics.unlockTimestamp) === 0
    )
      return "Not set";

    const date = new Date(Number(goalBasics.unlockTimestamp) * 1000);
    return date.toLocaleDateString();
  };

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!goalBasics || !goalBasics.unlockTimestamp) return null;

    const unlockTime = Number(goalBasics.unlockTimestamp);
    const now = Math.floor(Date.now() / 1000);

    if (now >= unlockTime) return "Available to withdraw";

    const secondsRemaining = unlockTime - now;
    const days = Math.floor(secondsRemaining / 86400);
    const hours = Math.floor((secondsRemaining % 86400) / 3600);

    return `${days} days, ${hours} hours remaining`;
  };

  // Find matching Firebase goal for additional info
  const getMatchingFirebaseGoal = () => {
    return userGoals.find((goal) => goal.blockchainGoalId === selectedGoalId);
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

  if (isLoading) {
    return (
      <div className="bg-white shadow-xl rounded-lg p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
          Loading vault progress...
        </div>
      </div>
    );
  }

  if (isGoalError || (!goalBasics && selectedGoalId)) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
        <p className="font-bold">Error</p>
        <p>
          Unable to load goal data from the blockchain. Please try again later.
        </p>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded">
        <p className="font-bold">Wallet Required</p>
        <p>Please connect your wallet to view vault progress.</p>
      </div>
    );
  }

  if (!selectedGoalId || !goalBasics) {
    return (
      <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded">
        <p className="font-bold">No Active Goals</p>
        <p>Create a savings goal to start tracking your progress!</p>
      </div>
    );
  }

  const matchingGoal = getMatchingFirebaseGoal();
  const progress = calculateProgress();

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
        <span className="mr-3">🐷</span> Your Savings Vault
      </motion.h2>

      {!address ? (
        <motion.p
          variants={itemVariants}
          className="text-gray-600 text-center py-8"
        >
          Please connect your wallet to view your vault.
        </motion.p>
      ) : (
        <>
          {/* Progress Section */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-700 font-medium">
                Progress to Goal
              </span>
              <motion.span
                className="text-xl font-bold"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                key={progress}
              >
                {progress.toFixed(1)}%
              </motion.span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  isGoalReached ? "bg-green-500" : "bg-blue-500"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8"
          >
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Current Balance</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatEth(goalBasics?.balance)} ETH
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Goal Amount</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatEth(goalBasics?.goal)} ETH
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Unlock Date</p>
              <p className="text-2xl font-bold text-green-600">
                {formatUnlockDate()}
              </p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Time Remaining</p>
              <p className="text-2xl font-bold text-yellow-600">
                {getTimeRemaining() || "Not set"}
              </p>
            </div>
          </motion.div>

          {/* Status Message */}
          {isGoalReached && (
            <motion.div
              variants={itemVariants}
              className="bg-green-100 border-l-4 border-green-500 text-green-700 p-6 rounded-lg mb-6"
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
            >
              <div className="flex items-center">
                <span className="text-2xl mr-3">🎉</span>
                <div>
                  <p className="font-bold text-lg">Congratulations!</p>
                  <p>
                    You've reached your savings goal! You can now withdraw your
                    funds.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Tips Section */}
          <motion.div
            variants={itemVariants}
            className="bg-gray-50 p-6 rounded-lg"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              💡 Tips
            </h3>
            <ul className="space-y-2 text-gray-600">
              <li>• Regular deposits help you reach your goal faster</li>
              <li>• Early withdrawals are possible but come with a penalty</li>
              <li>• You can update your goal amount at any time</li>
            </ul>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default VaultProgress;
