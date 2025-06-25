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

  // Get selected goal details from blockchain using the new contract functions
  const { data: goalDetails, isError: isGoalError } = useContractRead({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "getGoalDetails",
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
    if (!goalProgress) return 0;
    return Number(goalProgress);
  };

  // Format unlock date
  const formatUnlockDate = () => {
    if (!goalDetails || !goalDetails[4] || Number(goalDetails[4]) === 0)
      return "Non défini";

    const date = new Date(Number(goalDetails[4]) * 1000);
    return date.toLocaleDateString();
  };

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!goalDetails || !goalDetails[4]) return null;

    const unlockTime = Number(goalDetails[4]);
    const now = Math.floor(Date.now() / 1000);

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
          Chargement du progrès du vault...
        </div>
      </div>
    );
  }

  if (isGoalError || (!goalDetails && selectedGoalId)) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
        <p className="font-bold">Erreur</p>
        <p>
          Impossible de charger les données de l'objectif depuis la blockchain.
          Veuillez réessayer plus tard.
        </p>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded">
        <p className="font-bold">Wallet Requis</p>
        <p>Veuillez connecter votre wallet pour voir le progrès du vault.</p>
      </div>
    );
  }

  if (!selectedGoalId || !goalDetails) {
    return (
      <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded">
        <p className="font-bold">Aucun Objectif Actif</p>
        <p>
          Créez un objectif d'épargne pour commencer à suivre votre progrès !
        </p>
      </div>
    );
  }

  const matchingGoal = getMatchingFirebaseGoal();
  const progress = calculateProgress();
  const timeRemaining = getTimeRemaining();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="bg-white shadow-xl rounded-lg p-8 max-w-4xl mx-auto"
    >
      <motion.h2
        variants={itemVariants}
        className="text-3xl font-bold text-gray-800 mb-6 flex items-center"
      >
        <span className="mr-3">📊</span>
        Progrès du Vault
      </motion.h2>

      {/* Goal Selection */}
      {userGoals.length > 1 && (
        <motion.div variants={itemVariants} className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Sélectionner un objectif
          </label>
          <select
            value={selectedGoalId || ""}
            onChange={(e) =>
              setSelectedGoalId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {userGoals.map((goal) => (
              <option key={goal.id} value={goal.blockchainGoalId}>
                {goal.description || "Objectif d'épargne"} -{" "}
                {goal.blockchainGoalId}
              </option>
            ))}
          </select>
        </motion.div>
      )}

      {/* Progress Overview */}
      <motion.div
        variants={itemVariants}
        className="grid md:grid-cols-2 gap-6 mb-8"
      >
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 text-white p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-4">Progrès Global</h3>
          <div className="text-4xl font-bold mb-2">{progress.toFixed(1)}%</div>
          <div className="w-full bg-white/20 rounded-full h-3 mb-2">
            <div
              className="bg-white rounded-full h-3 transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <p className="text-blue-100 text-sm">
            {progress >= 100 ? "Objectif atteint ! 🎉" : "En cours..."}
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-teal-600 text-white p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-4">Solde Actuel</h3>
          <div className="text-4xl font-bold mb-2">
            {formatEth(goalDetails[0])} ETH
          </div>
          <p className="text-green-100 text-sm">Montant total déposé</p>
        </div>
      </motion.div>

      {/* Goal Details */}
      <motion.div
        variants={itemVariants}
        className="bg-gray-50 rounded-lg p-6 mb-6"
      >
        <h3 className="text-xl font-semibold text-gray-800 mb-4">
          Détails de l'Objectif
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600 text-sm">Description</p>
            <p className="font-medium">
              {goalDetails[7] ||
                matchingGoal?.description ||
                "Aucune description"}
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Type d'objectif</p>
            <p className="font-medium">{getGoalTypeDescription()}</p>
          </div>
          {goalDetails[4] > 0 && (
            <>
              <div>
                <p className="text-gray-600 text-sm">Date de déblocage</p>
                <p className="font-medium">{formatUnlockDate()}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Temps restant</p>
                <p className="font-medium">{timeRemaining}</p>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Status Indicators */}
      <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-4">
        <div
          className={`p-4 rounded-lg text-center ${
            isGoalReached
              ? "bg-green-100 text-green-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          <div className="text-2xl mb-2">{isGoalReached ? "✅" : "⏳"}</div>
          <div className="font-semibold">
            {isGoalReached ? "Objectif Atteint" : "En Cours"}
          </div>
        </div>

        <div className="bg-blue-100 text-blue-800 p-4 rounded-lg text-center">
          <div className="text-2xl mb-2">💰</div>
          <div className="font-semibold">Actif</div>
        </div>

        <div className="bg-purple-100 text-purple-800 p-4 rounded-lg text-center">
          <div className="text-2xl mb-2">🔒</div>
          <div className="font-semibold">
            {progress >= 100 ? "Débloqué" : "Verrouillé"}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default VaultProgress;
