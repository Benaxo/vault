import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { useAccount, useContractWrite, useWaitForTransaction } from "wagmi";
import PiggyBankVaultABI from "../abi/PiggyBankVault.json";
import { CONTRACT_ADDRESS } from "../constants";
import {
  formatPrice,
  getEthPrice,
  getPredefinedGoals,
} from "../services/priceService";
import { createGoal, getUserGoals, updateGoal } from "../services/userService";
import { extractGoalIdFromLogs } from "../utils/contractUtils";

const GoalTypeSelector = ({
  userProfile,
  selectedGoal,
  onGoalSelect,
  onGoalCreate,
}) => {
  const { address } = useAccount();
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [goalType, setGoalType] = useState("ETH_PRICE");
  const [currency, setCurrency] = useState("USD");
  const [ethPrice, setEthPrice] = useState({ usd: 2200, eur: 2000 });
  const [newGoal, setNewGoal] = useState({
    targetValue: "",
    unlockDate: "",
    description: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [pendingGoal, setPendingGoal] = useState(null);

  // Smart contract interaction
  const { data: createGoalData, write: writeCreateGoal } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "createGoal",
  });

  const { isLoading: isContractLoading } = useWaitForTransaction({
    hash: createGoalData?.hash,
    onSuccess: async (receipt) => {
      if (pendingGoal) {
        try {
          const goalId = extractGoalIdFromLogs(receipt.logs);

          if (goalId !== null) {
            await updateGoal(pendingGoal.id, { blockchainGoalId: goalId });
            const updatedGoal = { ...pendingGoal, blockchainGoalId: goalId };
            setGoals((prev) =>
              prev.map((g) => (g.id === pendingGoal.id ? updatedGoal : g))
            );
            onGoalSelect(updatedGoal);
            setPendingGoal(null);
            setError("");
          }
        } catch (error) {
          console.error("Error updating goal:", error);
          setError("Goal created but failed to update database");
        }
      }
    },
  });

  // Fetch ETH price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const price = await getEthPrice();
        setEthPrice(price);
      } catch (error) {
        console.error("Error fetching ETH price:", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load goals
  useEffect(() => {
    const loadGoals = async () => {
      if (!userProfile) return;

      try {
        setIsLoading(true);
        const userGoals = await getUserGoals(
          userProfile.id,
          userProfile.primaryWallet
        );
        setGoals(
          userGoals.filter((goal) => goal.isActive && !goal.isCompleted)
        );

        if (userGoals.length > 0 && !selectedGoal) {
          onGoalSelect(userGoals[0]);
        }
      } catch (error) {
        console.error("Error loading goals:", error);
        setError("Failed to load goals");
      } finally {
        setIsLoading(false);
      }
    };

    loadGoals();
  }, [userProfile, selectedGoal, onGoalSelect]);

  // Handle goal creation
  const handleCreateGoal = async (e) => {
    e.preventDefault();

    if (!newGoal.targetValue || !newGoal.unlockDate) {
      setError("Please fill in all required fields");
      return;
    }

    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    const targetValue = parseFloat(newGoal.targetValue);
    if (targetValue <= 0) {
      setError("Target value must be greater than 0");
      return;
    }

    const unlockDate = new Date(newGoal.unlockDate);
    if (unlockDate <= new Date()) {
      setError("Unlock date must be in the future");
      return;
    }

    try {
      setIsCreating(true);
      setError("");

      const goalData = {
        goalType,
        targetValue,
        currency,
        unlockDate,
        description: newGoal.description || getDefaultDescription(),
        priceAtCreation:
          goalType === "ETH_PRICE"
            ? currency === "EUR"
              ? ethPrice.eur
              : ethPrice.usd
            : null,
      };

      const createdGoal = await createGoal(
        userProfile.id,
        userProfile.primaryWallet || address,
        goalData
      );
      setGoals((prev) => [createdGoal, ...prev]);
      setPendingGoal(createdGoal);

      const unlockTimestamp = Math.floor(unlockDate.getTime() / 1000);
      let contractTargetValue;

      if (goalType === "ETH_AMOUNT") {
        contractTargetValue = BigInt(Math.floor(targetValue * 1e18));
      } else {
        contractTargetValue = BigInt(Math.floor(targetValue * 1e8));
      }

      if (writeCreateGoal) {
        const goalTypeEnum =
          goalType === "ETH_AMOUNT" ? 0 : goalType === "ETH_PRICE" ? 1 : 2;
        const currencyEnum = currency === "USD" ? 0 : 1;

        writeCreateGoal({
          args: [
            goalTypeEnum,
            contractTargetValue,
            currencyEnum,
            unlockTimestamp,
            goalData.description,
          ],
        });
      }

      if (onGoalCreate) onGoalCreate(createdGoal);

      setNewGoal({ targetValue: "", unlockDate: "", description: "" });
      setShowCreateForm(false);
    } catch (error) {
      console.error("Error creating goal:", error);
      setError("Failed to create goal");
    } finally {
      setIsCreating(false);
    }
  };

  const getDefaultDescription = () => {
    if (goalType === "ETH_PRICE") {
      return `Sortir à ${formatPrice(
        parseFloat(newGoal.targetValue || 0),
        currency.toLowerCase()
      )}/ETH`;
    } else if (goalType === "PORTFOLIO_VALUE") {
      return `Portefeuille de ${formatPrice(
        parseFloat(newGoal.targetValue || 0),
        currency.toLowerCase()
      )}`;
    }
    return `${newGoal.targetValue || 0} ETH Goal`;
  };

  const applySuggestion = (suggestion) => {
    setNewGoal({
      targetValue: suggestion.value.toString(),
      unlockDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      description: suggestion.label,
    });
    setCurrency(suggestion.currency.toUpperCase());
  };

  const getSuggestions = () => {
    const predefined = getPredefinedGoals();
    return goalType === "ETH_PRICE"
      ? predefined.priceTargets
      : predefined.portfolioTargets;
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
          Loading goals...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ETH Price Display */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">📈 Prix ETH Actuel</h3>
            <div className="flex space-x-4 mt-1">
              <span className="text-lg font-bold text-green-600">
                {formatPrice(ethPrice.usd, "usd")}
              </span>
              <span className="text-lg font-bold text-blue-600">
                {formatPrice(ethPrice.eur, "eur")}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-sm ${
                (ethPrice.usd_24h_change || 0) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {(ethPrice.usd_24h_change || 0) >= 0 ? "↗" : "↘"}{" "}
              {Math.abs(ethPrice.usd_24h_change || 0).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Existing Goals */}
      {goals.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">
            📋 Sélectionner un Objectif
          </h3>
          <div className="space-y-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                isSelected={selectedGoal?.id === goal.id}
                onSelect={() => onGoalSelect(goal)}
                ethPrice={ethPrice}
              />
            ))}
          </div>
        </div>
      )}

      {/* No Goals State */}
      {goals.length === 0 && !showCreateForm && (
        <div className="text-center p-6 bg-yellow-50 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            🎯 Aucun Objectif Actif
          </h3>
          <p className="text-yellow-700 mb-4">
            Créez votre premier objectif d'investissement pour commencer !
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Créer Votre Premier Objectif
          </button>
        </div>
      )}

      {/* Create Goal Button */}
      {goals.length > 0 && !showCreateForm && (
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center"
        >
          <span className="mr-2">➕</span>
          Créer Nouvel Objectif
        </button>
      )}

      {/* Create Goal Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white border-2 border-blue-200 rounded-lg p-6"
          >
            <h3 className="font-semibold text-gray-800 mb-4">
              🚀 Créer Nouvel Objectif
            </h3>

            {/* Goal Type Selection */}
            <div className="mb-6">
              <h4 className="font-medium text-gray-700 mb-3">
                Type d'Objectif
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    goalType === "ETH_PRICE"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setGoalType("ETH_PRICE")}
                >
                  <div className="font-semibold text-gray-800">
                    🎯 Prix ETH Cible
                  </div>
                  <div className="text-sm text-gray-600">
                    Sortir quand ETH atteint un prix
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    goalType === "PORTFOLIO_VALUE"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setGoalType("PORTFOLIO_VALUE")}
                >
                  <div className="font-semibold text-gray-800">
                    💰 Valeur Portefeuille
                  </div>
                  <div className="text-sm text-gray-600">
                    Atteindre une valeur totale
                  </div>
                </motion.button>
              </div>
            </div>

            {/* Suggestions */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Suggestions populaires:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {getSuggestions()
                  .slice(0, 6)
                  .map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => applySuggestion(suggestion)}
                      className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <div className="font-medium">{suggestion.label}</div>
                      <div className="text-gray-600">
                        {suggestion.description}
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {goalType === "ETH_PRICE" ? "Prix Cible" : "Valeur Cible"} *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={newGoal.targetValue}
                    onChange={(e) =>
                      setNewGoal((prev) => ({
                        ...prev,
                        targetValue: e.target.value,
                      }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={goalType === "ETH_PRICE" ? "4000" : "10000"}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Devise *
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date de Déblocage *
                </label>
                <input
                  type="date"
                  value={newGoal.unlockDate}
                  onChange={(e) =>
                    setNewGoal((prev) => ({
                      ...prev,
                      unlockDate: e.target.value,
                    }))
                  }
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newGoal.description}
                  onChange={(e) =>
                    setNewGoal((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={getDefaultDescription()}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg font-medium transition-colors"
                >
                  {isCreating ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Création...
                    </div>
                  ) : (
                    "Créer Objectif"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewGoal({
                      targetValue: "",
                      unlockDate: "",
                      description: "",
                    });
                    setError("");
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Goal Card Component
const GoalCard = ({ goal, isSelected, onSelect, ethPrice }) => {
  const getProgress = () => {
    if (goal.goalType === "ETH_PRICE") {
      const currentPrice =
        goal.currency === "EUR" ? ethPrice.eur : ethPrice.usd;
      return Math.min((currentPrice / goal.targetValue) * 100, 100);
    } else if (goal.goalType === "PORTFOLIO_VALUE") {
      const ethBalance = parseFloat(goal.currentBalance || 0);
      const currentPrice =
        goal.currency === "EUR" ? ethPrice.eur : ethPrice.usd;
      const currentValue = ethBalance * currentPrice;
      return Math.min((currentValue / goal.targetValue) * 100, 100);
    } else {
      const current = parseFloat(goal.currentBalance || 0);
      const target = parseFloat(goal.goalAmount);
      return Math.min((current / target) * 100, 100);
    }
  };

  const getCurrentValue = () => {
    if (goal.goalType === "ETH_PRICE") {
      const currentPrice =
        goal.currency === "EUR" ? ethPrice.eur : ethPrice.usd;
      return formatPrice(
        currentPrice || 0,
        goal.currency?.toLowerCase() || "usd"
      );
    } else if (goal.goalType === "PORTFOLIO_VALUE") {
      const ethBalance = parseFloat(goal.currentBalance || 0);
      const currentPrice =
        goal.currency === "EUR" ? ethPrice.eur : ethPrice.usd;
      const currentValue = ethBalance * (currentPrice || 0);
      return formatPrice(currentValue, goal.currency?.toLowerCase() || "usd");
    } else {
      return `${goal.currentBalance || "0"} ETH`;
    }
  };

  const getTargetDisplay = () => {
    if (goal.goalType === "ETH_PRICE") {
      return `Cible: ${formatPrice(
        goal.targetValue || 0,
        goal.currency?.toLowerCase() || "usd"
      )}/ETH`;
    } else if (goal.goalType === "PORTFOLIO_VALUE") {
      return `Cible: ${formatPrice(
        goal.targetValue || 0,
        goal.currency?.toLowerCase() || "usd"
      )}`;
    } else {
      return `Cible: ${goal.goalAmount || 0} ETH`;
    }
  };

  const progress = getProgress();

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-medium text-gray-800">
            {goal.goalType === "ETH_PRICE"
              ? "🎯"
              : goal.goalType === "PORTFOLIO_VALUE"
              ? "💰"
              : "📊"}{" "}
            {goal.description}
          </h4>
          <p className="text-sm text-gray-600">{getTargetDisplay()}</p>
        </div>
        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"
          }`}
        >
          {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            progress >= 100
              ? "bg-green-500"
              : progress >= 80
              ? "bg-yellow-500"
              : "bg-blue-500"
          }`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{getCurrentValue()}</span>
        <span
          className={`font-medium ${
            progress >= 100
              ? "text-green-600"
              : progress >= 80
              ? "text-yellow-600"
              : "text-blue-600"
          }`}
        >
          {progress >= 100 ? "🔥 Objectif Atteint!" : `${progress.toFixed(1)}%`}
        </span>
      </div>
    </motion.div>
  );
};

export default GoalTypeSelector;
