import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { useAccount, useContractWrite, useWaitForTransaction } from "wagmi";
import PiggyBankVaultABI from "../abi/PiggyBankVault.json";
import { CONTRACT_ADDRESS } from "../constants";
import { getPredefinedGoals } from "../services/priceService";
import { createGoal, getUserGoals, updateGoal } from "../services/userService";
import { extractGoalIdFromLogs } from "../utils/contractUtils";

const GoalSelector = ({
  userProfile,
  selectedGoal,
  onGoalSelect,
  onGoalCreate,
}) => {
  const { address } = useAccount();
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGoal, setNewGoal] = useState({
    goalType: "ETH_AMOUNT", // Default to legacy type
    goalAmount: "",
    targetValue: "",
    currency: "USD",
    unlockDate: "",
    description: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [pendingGoal, setPendingGoal] = useState(null);

  // Smart contract interaction for creating goals
  const { data: createGoalData, write: writeCreateGoal } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "createGoal", // This will be changed dynamically
  });

  // For legacy goals
  const { data: createGoalLegacyData, write: writeCreateGoalLegacy } =
    useContractWrite({
      address: CONTRACT_ADDRESS,
      abi: PiggyBankVaultABI,
      functionName: "createGoalLegacy",
    });

  const { isLoading: isContractLoading, isSuccess: isContractSuccess } =
    useWaitForTransaction({
      hash: createGoalData?.hash || createGoalLegacyData?.hash,
      onSuccess: async (receipt) => {
        if (pendingGoal) {
          try {
            // Extract goalId from contract events
            const goalId = extractGoalIdFromLogs(receipt.logs);

            if (goalId !== null) {
              // Update the goal in Firebase with the blockchain goalId
              await updateGoal(pendingGoal.id, {
                blockchainGoalId: goalId,
              });

              // Update local state
              const updatedGoal = { ...pendingGoal, blockchainGoalId: goalId };
              setGoals((prev) =>
                prev.map((g) => (g.id === pendingGoal.id ? updatedGoal : g))
              );

              // Select the newly created goal
              onGoalSelect(updatedGoal);

              setPendingGoal(null);
              setError("");
            } else {
              throw new Error("Could not extract goalId from transaction");
            }
          } catch (error) {
            console.error("Error updating goal with blockchain ID:", error);
            setError(
              "Goal created on blockchain but failed to update database"
            );
          }
        }
      },
    });

  // Load user's goals
  useEffect(() => {
    const loadGoals = async () => {
      if (!userProfile) return;

      try {
        setIsLoading(false);
        const userGoals = await getUserGoals(
          userProfile.id,
          userProfile.primaryWallet
        );
        const activeGoals = userGoals.filter(
          (goal) => goal.isActive && !goal.isCompleted
        );
        setGoals(activeGoals);

        // Auto-select first goal if available and none selected
        if (activeGoals.length > 0 && !selectedGoal) {
          onGoalSelect(activeGoals[0]);
        }
      } catch (error) {
        console.error("Error loading goals:", error);
        // Only show error if it's not just an empty goals scenario
        if (error.message && !error.message.includes("No goals found")) {
          setError("Failed to load goals");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadGoals();
  }, [userProfile, selectedGoal, onGoalSelect]);

  // Handle goal creation
  const handleCreateGoal = async (e) => {
    e.preventDefault();

    // Validation based on goal type
    if (newGoal.goalType === "ETH_AMOUNT") {
      if (!newGoal.goalAmount || !newGoal.unlockDate) {
        setError("Please fill in all required fields");
        return;
      }

      const unlockDate = new Date(newGoal.unlockDate);
      if (unlockDate <= new Date()) {
        setError("Unlock date must be in the future");
        return;
      }
    } else {
      // For ETH_PRICE and PORTFOLIO_VALUE, only need target value and currency
      if (!newGoal.targetValue || !newGoal.currency) {
        setError("Please fill in all required fields");
        return;
      }
    }

    if (!address) {
      setError("Please connect your wallet to create goals on blockchain");
      return;
    }

    try {
      setIsCreating(true);
      setError("");

      let goalData;

      if (newGoal.goalType === "ETH_AMOUNT") {
        // Legacy ETH amount goal with unlock date
        const goalAmount = parseFloat(newGoal.goalAmount);
        if (goalAmount <= 0) {
          setError("Goal amount must be greater than 0");
          return;
        }

        const unlockDate = new Date(newGoal.unlockDate);
        goalData = {
          goalType: "ETH_AMOUNT",
          goalAmount: goalAmount.toString(),
          unlockDate: unlockDate,
          description: newGoal.description || `${goalAmount} ETH Goal`,
        };

        const createdGoal = await createGoal(
          userProfile.id,
          userProfile.primaryWallet || address,
          goalData
        );

        setGoals((prev) => [createdGoal, ...prev]);
        setPendingGoal(createdGoal);

        // Create legacy goal on blockchain
        const goalAmountWei = BigInt(Math.floor(goalAmount * 1e18));
        const unlockTimestamp = Math.floor(unlockDate.getTime() / 1000);

        console.log("Debug - Creating ETH_AMOUNT goal with createGoalLegacy:", {
          goalAmountWei: goalAmountWei.toString(),
          unlockTimestamp,
          description: goalData.description,
        });

        if (writeCreateGoalLegacy) {
          writeCreateGoalLegacy({
            args: [goalAmountWei, unlockTimestamp, goalData.description],
          });
        }
      } else {
        // New goal types (ETH_PRICE, PORTFOLIO_VALUE) - no unlock date needed
        const targetValue = parseFloat(newGoal.targetValue);
        if (targetValue <= 0) {
          setError("Target value must be greater than 0");
          return;
        }

        goalData = {
          goalType: newGoal.goalType,
          targetValue: targetValue,
          currency: newGoal.currency,
          unlockDate: null, // No unlock date for these types
          description:
            newGoal.description ||
            (newGoal.goalType === "ETH_PRICE"
              ? `Exit at ${targetValue} ${newGoal.currency}/ETH`
              : `Portfolio ${targetValue} ${newGoal.currency}`),
          priceAtCreation: 0, // Will be updated by priceService
        };

        const createdGoal = await createGoal(
          userProfile.id,
          userProfile.primaryWallet || address,
          goalData
        );

        setGoals((prev) => [createdGoal, ...prev]);
        setPendingGoal(createdGoal);

        // Create on blockchain using the new createGoal function with 5 parameters
        // No unlock timestamp needed for these types (will be set to 0 by contract)
        const unlockTimestamp = 0;

        // Map goal types to enum values
        const goalTypeEnum = newGoal.goalType === "ETH_PRICE" ? 1 : 2; // ETH_PRICE = 1, PORTFOLIO_VALUE = 2
        const currencyEnum = newGoal.currency === "EUR" ? 1 : 0; // USD = 0, EUR = 1

        // For price targets, we need to convert to the right format (8 decimals for price feeds)
        let targetValueForContract;
        if (newGoal.goalType === "ETH_PRICE") {
          // Price in USD/EUR with 8 decimals (like Chainlink price feeds)
          targetValueForContract = BigInt(Math.floor(targetValue * 1e8));
        } else {
          // Portfolio value in USD/EUR with 8 decimals
          targetValueForContract = BigInt(Math.floor(targetValue * 1e8));
        }

        if (writeCreateGoal) {
          console.log("Debug - Creating new goal type with createGoal:", {
            goalType: newGoal.goalType,
            goalTypeEnum,
            targetValue,
            targetValueForContract: targetValueForContract.toString(),
            currency: newGoal.currency,
            currencyEnum,
            unlockTimestamp,
            description: goalData.description,
          });

          writeCreateGoal({
            args: [
              goalTypeEnum, // GoalType enum
              targetValueForContract, // Target value with proper decimals
              currencyEnum, // Currency enum
              unlockTimestamp, // Unlock timestamp (0 for price/portfolio goals)
              goalData.description, // Description
            ],
          });
        }
      }

      // Call parent callback
      if (onGoalCreate) {
        onGoalCreate(goalData);
      }

      // Reset form
      setNewGoal({
        goalType: "ETH_AMOUNT",
        goalAmount: "",
        targetValue: "",
        currency: "USD",
        unlockDate: "",
        description: "",
      });
      setShowCreateForm(false);
    } catch (error) {
      console.error("Error creating goal:", error);
      setError("Failed to create goal. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Get predefined goal suggestions
  const getGoalSuggestions = () => {
    if (newGoal.goalType === "ETH_AMOUNT") {
      return [
        { label: "Emergency Fund", amount: "1", months: 3 },
        { label: "Vacation", amount: "2", months: 6 },
        { label: "Investment", amount: "5", months: 12 },
      ];
    }

    const predefined = getPredefinedGoals();

    if (newGoal.goalType === "ETH_PRICE") {
      return predefined.priceTargets.filter(
        (target) => target.currency.toUpperCase() === newGoal.currency
      );
    }

    if (newGoal.goalType === "PORTFOLIO_VALUE") {
      return predefined.portfolioTargets.filter(
        (target) => target.currency.toUpperCase() === newGoal.currency
      );
    }

    return [];
  };

  const formatDate = (date) => {
    return new Date(date.seconds * 1000).toLocaleDateString();
  };

  const getTimeRemaining = (unlockDate) => {
    const now = new Date();
    const unlock = unlockDate.seconds
      ? new Date(unlockDate.seconds * 1000)
      : new Date(unlockDate);
    const diffTime = unlock - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "Unlocked";
    if (diffDays === 1) return "1 day";
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months`;
    return `${Math.ceil(diffDays / 365)} years`;
  };

  const getProgress = (goal) => {
    if (goal.goalType === "ETH_AMOUNT") {
      const current = parseFloat(goal.currentBalance || 0);
      const target = parseFloat(goal.goalAmount);
      return Math.min((current / target) * 100, 100);
    } else if (goal.goalType === "ETH_PRICE") {
      // For price goals, progress would need current ETH price vs target
      // For now, show progress based on time elapsed
      return 0; // Will be implemented with real price checking
    } else if (goal.goalType === "PORTFOLIO_VALUE") {
      // For portfolio goals, would need current portfolio value vs target
      // For now, show progress based on ETH balance approximation
      const current = parseFloat(goal.currentBalance || 0);
      const approxCurrentValue = current * 2300; // Using fallback price
      const target = parseFloat(goal.targetValue);
      return Math.min((approxCurrentValue / target) * 100, 100);
    }

    // Fallback for any other goal types
    const current = parseFloat(goal.currentBalance || 0);
    const target = parseFloat(goal.goalAmount || goal.targetValue || 1);
    return Math.min((current / target) * 100, 100);
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
      {/* Error Messages */}
      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Goal Selection */}
      {goals.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-3">
            📋 Select a Goal for this Deposit
          </h3>

          {/* Info message if there are pending goals */}
          {goals.some((goal) => !goal.blockchainGoalId) && (
            <div className="mb-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
              <div className="flex items-start">
                <span className="text-yellow-500 mr-2">⏳</span>
                <div className="text-sm">
                  <p className="text-yellow-800 font-medium">
                    Objectifs en cours de création
                  </p>
                  <p className="text-yellow-700 mt-1">
                    Certains objectifs sont en cours d'enregistrement sur la
                    blockchain. Attendez quelques secondes ou rafraîchissez la
                    page pour pouvoir y déposer.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {goals.map((goal) => (
              <motion.div
                key={goal.id}
                whileHover={{ scale: 1.02 }}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedGoal?.id === goal.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => onGoalSelect(goal)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium text-gray-800 flex items-center">
                      {goal.description}
                      {!goal.blockchainGoalId && (
                        <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          Pending blockchain
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {goal.goalType === "ETH_AMOUNT" ? (
                        <>
                          Target: {goal.goalAmount} ETH •{" "}
                          {getTimeRemaining(goal.unlockDate)}
                        </>
                      ) : goal.goalType === "ETH_PRICE" ? (
                        <>
                          Price Target: {goal.targetValue} {goal.currency}/ETH •{" "}
                          <span className="text-green-600 font-medium">
                            Auto-unlock
                          </span>
                        </>
                      ) : goal.goalType === "PORTFOLIO_VALUE" ? (
                        <>
                          Portfolio Target: {goal.targetValue} {goal.currency} •{" "}
                          <span className="text-green-600 font-medium">
                            Auto-unlock
                          </span>
                        </>
                      ) : (
                        <>
                          Target: {goal.goalAmount || goal.targetValue} •{" "}
                          {goal.unlockDate ? (
                            getTimeRemaining(goal.unlockDate)
                          ) : (
                            <span className="text-green-600 font-medium">
                              Auto-unlock
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      selectedGoal?.id === goal.id
                        ? "border-blue-500 bg-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedGoal?.id === goal.id && (
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgress(goal)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{goal.currentBalance || "0"} ETH</span>
                  <span>{getProgress(goal).toFixed(1)}%</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* No Goals State */}
      {goals.length === 0 && !showCreateForm && (
        <div className="text-center p-6 bg-yellow-50 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            🎯 No Active Goals Found
          </h3>
          <p className="text-yellow-700 mb-4">
            Create your first savings goal to start making deposits!
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Create Your First Goal
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
          Create New Goal
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
              🚀 Create New Goal
            </h3>

            {/* Goal Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type d'objectif *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setNewGoal((prev) => ({
                      ...prev,
                      goalType: "ETH_AMOUNT",
                      targetValue: "",
                      currency: "USD",
                    }))
                  }
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    newGoal.goalType === "ETH_AMOUNT"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-sm">📊 Quantité ETH</div>
                  <div className="text-xs text-gray-600">
                    Objectif classique en ETH
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setNewGoal((prev) => ({
                      ...prev,
                      goalType: "ETH_PRICE",
                      goalAmount: "",
                    }))
                  }
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    newGoal.goalType === "ETH_PRICE"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-sm">🎯 Prix ETH Cible</div>
                  <div className="text-xs text-gray-600">
                    Sortir à un prix donné
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setNewGoal((prev) => ({
                      ...prev,
                      goalType: "PORTFOLIO_VALUE",
                      goalAmount: "",
                    }))
                  }
                  className={`p-3 border-2 rounded-lg text-left transition-all ${
                    newGoal.goalType === "PORTFOLIO_VALUE"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-medium text-sm">💰 Valeur Portfolio</div>
                  <div className="text-xs text-gray-600">
                    Valeur totale en fiat
                  </div>
                </button>
              </div>
            </div>

            {/* Currency Selection for new goal types */}
            {newGoal.goalType !== "ETH_AMOUNT" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Devise *
                </label>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNewGoal((prev) => ({ ...prev, currency: "USD" }))
                    }
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      newGoal.currency === "USD"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    💵 USD
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewGoal((prev) => ({ ...prev, currency: "EUR" }))
                    }
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      newGoal.currency === "EUR"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    💶 EUR
                  </button>
                </div>
              </div>
            )}

            {/* Quick Suggestions */}
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Suggestions rapides:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {getGoalSuggestions().map((suggestion, index) => (
                  <button
                    key={`${suggestion.label}-${index}`}
                    type="button"
                    onClick={() => {
                      if (newGoal.goalType === "ETH_AMOUNT") {
                        const unlockDate = new Date();
                        unlockDate.setMonth(
                          unlockDate.getMonth() + suggestion.months
                        );
                        setNewGoal((prev) => ({
                          ...prev,
                          goalAmount: suggestion.amount,
                          unlockDate: unlockDate.toISOString().split("T")[0],
                          description: suggestion.label,
                        }));
                      } else {
                        // For ETH_PRICE and PORTFOLIO_VALUE, no unlock date needed
                        setNewGoal((prev) => ({
                          ...prev,
                          targetValue: suggestion.value?.toString() || "",
                          currency: suggestion.currency?.toUpperCase() || "USD",
                          unlockDate: "", // No unlock date for these types
                          description: suggestion.label,
                        }));
                      }
                    }}
                    className="p-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <div className="font-medium">{suggestion.label}</div>
                    <div className="text-gray-600">
                      {newGoal.goalType === "ETH_AMOUNT"
                        ? `${suggestion.amount} ETH`
                        : `${
                            suggestion.value
                          } ${suggestion.currency?.toUpperCase()}`}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              {/* Goal Amount Field - Only for ETH_AMOUNT type */}
              {newGoal.goalType === "ETH_AMOUNT" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité ETH Objectif *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={newGoal.goalAmount}
                    onChange={(e) =>
                      setNewGoal((prev) => ({
                        ...prev,
                        goalAmount: e.target.value,
                      }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1.0"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Montant d'ETH à accumuler
                  </p>
                </div>
              )}

              {/* Target Value Field - For ETH_PRICE and PORTFOLIO_VALUE */}
              {newGoal.goalType !== "ETH_AMOUNT" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {newGoal.goalType === "ETH_PRICE"
                      ? `Prix Cible (${newGoal.currency}) *`
                      : `Valeur Portfolio Cible (${newGoal.currency}) *`}
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
                    placeholder={
                      newGoal.goalType === "ETH_PRICE" ? "4000" : "10000"
                    }
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {newGoal.goalType === "ETH_PRICE"
                      ? `Prix de l'ETH en ${newGoal.currency} qui déclenchera le déblocage automatique`
                      : `Valeur totale du portfolio en ${newGoal.currency} qui déclenchera le déblocage automatique`}
                  </p>
                </div>
              )}

              {/* Unlock Date Field - Only for ETH_AMOUNT type */}
              {newGoal.goalType === "ETH_AMOUNT" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date de Déverrouillage *
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
                  <p className="text-xs text-gray-500 mt-1">
                    Date à partir de laquelle vous pourrez retirer vos fonds
                  </p>
                </div>
              )}

              {/* Info Section for price/portfolio goals */}
              {newGoal.goalType !== "ETH_AMOUNT" && (
                <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded-lg">
                  <div className="flex items-start">
                    <span className="text-blue-500 mr-2">ℹ️</span>
                    <div className="text-sm">
                      <p className="text-blue-800 font-medium">
                        Déblocage automatique
                      </p>
                      <p className="text-blue-700 mt-1">
                        {newGoal.goalType === "ETH_PRICE"
                          ? "Vos fonds se débloquent automatiquement dès que le prix de l'ETH atteint votre objectif. Aucune date limite n'est nécessaire."
                          : "Vos fonds se débloquent automatiquement dès que la valeur de votre portfolio atteint votre objectif. Aucune date limite n'est nécessaire."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

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
                  placeholder={
                    newGoal.goalType === "ETH_AMOUNT"
                      ? "Emergency fund, vacation, etc."
                      : newGoal.goalType === "ETH_PRICE"
                      ? "Take profit at bull market peak"
                      : "Reach financial milestone"
                  }
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
                      Creating...
                    </div>
                  ) : (
                    "Create Goal"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewGoal({
                      goalType: "ETH_AMOUNT",
                      goalAmount: "",
                      targetValue: "",
                      currency: "USD",
                      unlockDate: "",
                      description: "",
                    });
                    setError("");
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GoalSelector;
