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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Get selected goal details from blockchain using the new contract functions
  const { data: goalDetails } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "getGoalDetails",
    args: [selectedGoalId],
    enabled: Boolean(selectedGoalId),
  });

  const { data: canWithdrawResult } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "canWithdraw",
    args: [selectedGoalId],
    enabled: Boolean(selectedGoalId),
  });

  const { data: goalProgress } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "getGoalProgress",
    args: [selectedGoalId],
    enabled: Boolean(selectedGoalId),
  });

  // Debug logging
  useEffect(() => {
    console.log("🔍 WithdrawForm Debug Info:");
    console.log("- selectedGoalId:", selectedGoalId);
    console.log("- goalDetails:", goalDetails);
    console.log("- canWithdrawResult:", canWithdrawResult);
    console.log("- goalProgress:", goalProgress);
    console.log("- userGoals:", userGoals);
    console.log("- address:", address);

    if (goalDetails) {
      console.log("📊 Goal Details:");
      console.log("- balance:", goalDetails[0]?.toString());
      console.log("- goalType:", goalDetails[1]?.toString());
      console.log("- targetValue:", goalDetails[2]?.toString());
      console.log("- currency:", goalDetails[3]?.toString());
      console.log("- unlockTimestamp:", goalDetails[4]?.toString());
      console.log("- owner:", goalDetails[5]);
      console.log("- isActive:", goalDetails[6]);
      console.log("- description:", goalDetails[7]);
      console.log("- createdAt:", goalDetails[8]?.toString());
      console.log("- isCompleted:", goalDetails[9]);
      console.log("- completedAt:", goalDetails[10]?.toString());
    }
  }, [
    selectedGoalId,
    goalDetails,
    canWithdrawResult,
    goalProgress,
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

          console.log(`📋 Goal ${goal.id} filter check:`, {
            hasBlockchainId,
            isActive,
            blockchainGoalId: goal.blockchainGoalId,
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

  // Contract write for withdrawal
  const { data: withdrawData, write: withdrawWrite } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "withdraw",
  });

  // Wait for transaction
  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: withdrawData?.hash,
    onSuccess: () => {
      setSuccess("Retrait effectué avec succès !");
      setError("");
    },
  });

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
    if (!goalDetails || !goalDetails[4]) {
      console.log("⏰ No goalDetails or unlockTimestamp");
      return null;
    }

    const unlockTime = Number(goalDetails[4]);
    const now = Math.floor(Date.now() / 1000);

    console.log("⏰ Time calculation:");
    console.log("- unlockTimestamp:", unlockTime);
    console.log("- current time:", now);
    console.log("- difference:", unlockTime - now);

    if (now >= unlockTime) return "Disponible pour retrait";

    const secondsRemaining = unlockTime - now;
    const days = Math.floor(secondsRemaining / 86400);
    const hours = Math.floor((secondsRemaining % 86400) / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);

    if (days > 0) {
      return `${days} jour(s), ${hours} heure(s) restantes`;
    } else if (hours > 0) {
      return `${hours} heure(s), ${minutes} minute(s) restantes`;
    } else {
      return `${minutes} minute(s) restantes`;
    }
  };

  // Check if withdrawal is allowed
  const isWithdrawalAllowed = () => {
    if (!canWithdrawResult) return false;
    return canWithdrawResult[0]; // First element is the boolean
  };

  // Get withdrawal reason
  const getWithdrawalReason = () => {
    if (!canWithdrawResult) return "Vérification en cours...";
    return canWithdrawResult[1]; // Second element is the reason string
  };

  // Get max amount for withdrawal
  const getMaxAmount = () => {
    if (!goalDetails) return "0";
    return formatEth(goalDetails[0]); // balance
  };

  // Get matching Firebase goal
  const getMatchingFirebaseGoal = () => {
    return userGoals.find((goal) => goal.blockchainGoalId === selectedGoalId);
  };

  // Handle withdrawal submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!selectedGoalId) {
      setError("Veuillez sélectionner un objectif");
      return;
    }

    if (!isWithdrawalAllowed()) {
      setError(getWithdrawalReason());
      return;
    }

    if (!withdrawWrite) {
      setError("Fonction de retrait non disponible");
      return;
    }

    try {
      setError("");
      setSuccess("");

      console.log("🔍 Attempting withdrawal for goal:", selectedGoalId);
      withdrawWrite({
        args: [selectedGoalId],
      });
    } catch (error) {
      console.error("Error calling withdraw:", error);
      setError("Erreur lors du retrait: " + error.message);
    }
  };

  // Get goal type description
  const getGoalTypeDescription = () => {
    if (!goalDetails) return "";

    const goalType = Number(goalDetails[1]);
    const targetValue = goalDetails[2];
    const currency = Number(goalDetails[3]);

    switch (goalType) {
      case 0: // ETH_AMOUNT
        return `Objectif: ${formatEth(targetValue)} ETH`;
      case 1: // ETH_PRICE
        const price = (Number(targetValue) / 1e8).toFixed(2);
        return `Prix cible: $${price} ${currency === 0 ? "USD" : "EUR"}`;
      case 2: // PORTFOLIO_VALUE
        const value = (Number(targetValue) / 1e8).toFixed(2);
        return `Valeur cible: $${value} ${currency === 0 ? "USD" : "EUR"}`;
      default:
        return "Type d'objectif inconnu";
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

  if (isLoading) {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des objectifs...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-white rounded-xl shadow-lg p-6"
    >
      <motion.h2
        variants={itemVariants}
        className="text-2xl font-bold mb-6 text-gray-800 flex items-center"
      >
        <span className="mr-3">💸</span>
        Retirer des Fonds
      </motion.h2>

      {userGoals.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className="text-center py-8 text-gray-600"
        >
          <p className="mb-4">Aucun objectif disponible pour le retrait.</p>
          <p className="text-sm">
            Créez d'abord un objectif et effectuez des dépôts pour pouvoir
            retirer.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Goal Selection */}
          <motion.div variants={itemVariants} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Sélectionner un objectif
            </label>
            <select
              value={selectedGoalId || ""}
              onChange={(e) =>
                setSelectedGoalId(
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choisir un objectif...</option>
              {userGoals.map((goal) => (
                <option key={goal.id} value={goal.blockchainGoalId}>
                  {goal.description || "Objectif d'épargne"} -{" "}
                  {goal.blockchainGoalId}
                </option>
              ))}
            </select>
          </motion.div>

          {/* Goal Details */}
          {selectedGoalId && goalDetails && (
            <motion.div variants={itemVariants} className="space-y-6">
              {/* Goal Information */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Détails de l'objectif
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Description:</span>
                    <span className="font-medium">
                      {goalDetails[7] || "Aucune description"}
                    </span>
                  </div>
            <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">
                      {getGoalTypeDescription()}
              </span>
            </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Progression:</span>
                    <span className="font-medium">
                      {goalProgress ? `${goalProgress}%` : "Calcul..."}
              </span>
                  </div>
                  {goalDetails[4] > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Déblocage:</span>
                      <span className="font-medium">{getTimeRemaining()}</span>
                    </div>
                  )}
            </div>
          </div>

              {/* Balance Information */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-800 mb-2">
                  Solde disponible
                </h3>
                <div className="text-2xl font-bold text-green-600">
                  {getMaxAmount()} ETH
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Montant total déposé dans cet objectif
                </p>
              </div>

              {/* Withdrawal Status */}
              <div
                className={`rounded-lg p-4 ${
                  isWithdrawalAllowed()
                    ? "bg-green-50 border border-green-200"
                    : "bg-yellow-50 border border-yellow-200"
                }`}
              >
                <h3 className="font-semibold text-gray-800 mb-2">
                  Statut du retrait
                </h3>
                <div className="flex items-center">
                  <span
                    className={`text-2xl mr-3 ${
                      isWithdrawalAllowed()
                        ? "text-green-500"
                        : "text-yellow-500"
                    }`}
                  >
                    {isWithdrawalAllowed() ? "✅" : "⏳"}
                  </span>
                  <div>
                    <p
                      className={`font-medium ${
                        isWithdrawalAllowed()
                          ? "text-green-800"
                          : "text-yellow-800"
                      }`}
                    >
                      {isWithdrawalAllowed()
                        ? "Retrait autorisé"
                        : "Retrait en attente"}
                    </p>
                    <p
                      className={`text-sm ${
                        isWithdrawalAllowed()
                          ? "text-green-700"
                          : "text-yellow-700"
                      }`}
                    >
                      {getWithdrawalReason()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Error and Success Messages */}
              {error && (
                <motion.div
                  variants={itemVariants}
                  className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg"
                >
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  variants={itemVariants}
                  className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg"
                >
                  {success}
                </motion.div>
              )}

              {/* Withdrawal Button */}
              <motion.button
                variants={itemVariants}
                onClick={handleSubmit}
              disabled={
                  !isWithdrawalAllowed() || isConfirming || !withdrawWrite
                }
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 transform hover:scale-105 disabled:hover:scale-100"
              >
                {isConfirming
                  ? "Confirmation en cours..."
                  : isWithdrawalAllowed()
                  ? `Retirer ${getMaxAmount()} ETH`
                  : "Retrait non autorisé"}
              </motion.button>
            </motion.div>
          )}

          {!selectedGoalId && (
            <motion.div
              variants={itemVariants}
              className="text-center py-8 text-gray-600"
            >
              Sélectionnez un objectif pour voir les détails et effectuer un
              retrait.
            </motion.div>
          )}
        </>
      )}

      {!address && (
        <motion.div
          variants={itemVariants}
          className="text-center py-8 text-gray-600"
        >
          Connectez votre wallet pour effectuer un retrait.
        </motion.div>
      )}
    </motion.div>
  );
};

export default WithdrawForm;
