import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { useAccount, useContractWrite, useWaitForTransaction } from "wagmi";
import PiggyBankVaultABI from "../abi/PiggyBankVault.json";
import { CONTRACT_ADDRESS } from "../constants";
import { useAuth } from "../hooks/useAuth";
import { createGoal, getUserGoals, updateGoal } from "../services/userService";
import { extractGoalIdFromLogs } from "../utils/contractUtils";

const GoalSetting = ({ userProfile }) => {
  const { address } = useAccount();
  const { user } = useAuth();

  // États pour le formulaire
  const [goalType, setGoalType] = useState("ETH_AMOUNT"); // Type d'objectif
  const [goalAmount, setGoalAmount] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [portfolioValue, setPortfolioValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [unlockDate, setUnlockDate] = useState("");
  const [description, setDescription] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [userGoals, setUserGoals] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch user's existing goals
  useEffect(() => {
    const fetchGoals = async () => {
      if (user) {
        try {
          const goals = await getUserGoals(user.uid);
          setUserGoals(goals);
        } catch (error) {
          console.error("Error fetching goals:", error);
        }
      }
    };

    fetchGoals();
  }, [user]);

  // Smart contract interaction for setting goal
  const { data: createGoalData, write: writeCreateGoal } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "createGoal",
  });

  const { isLoading: isConfirming, isSuccess: isContractSuccess } =
    useWaitForTransaction({
      hash: createGoalData?.hash,
      onSuccess: async (receipt) => {
        try {
          // Extract goalId from contract events
          const goalId = extractGoalIdFromLogs(receipt.logs);

          if (goalId !== null) {
            // Update the latest goal with blockchain ID
            const updatedGoals = await getUserGoals(user.uid);
            if (updatedGoals.length > 0) {
              const latestGoal = updatedGoals[0];
              await updateGoal(latestGoal.id, {
                blockchainGoalId: goalId,
              });
            }

            const goalTypeTexts = {
              ETH_AMOUNT: "d'accumulation ETH",
              ETH_PRICE: "de prix ETH",
              PORTFOLIO_VALUE: "de valeur de portfolio",
            };

            setSuccess(
              `🎉 Objectif ${goalTypeTexts[goalType]} créé avec succès sur la blockchain ! Vous pouvez maintenant commencer à déposer.`
            );
          } else {
            throw new Error("Could not extract goalId from transaction");
          }
        } catch (error) {
          console.error("Error updating goal with blockchain ID:", error);
          setSuccess(
            "Objectif créé sur la blockchain mais erreur de mise à jour de la base de données"
          );
        }
      },
    });

  // Convert date to timestamp
  const getUnlockTimestamp = () => {
    if (!unlockDate || goalType !== "ETH_AMOUNT") return 0;
    return Math.floor(new Date(unlockDate).getTime() / 1000);
  };

  // Get target value based on goal type
  const getTargetValue = () => {
    switch (goalType) {
      case "ETH_AMOUNT":
        return BigInt(Math.floor(parseFloat(goalAmount) * 1e18)); // Convert to Wei
      case "ETH_PRICE":
        return BigInt(Math.floor(parseFloat(targetPrice) * 1e8)); // Prix avec 8 decimales
      case "PORTFOLIO_VALUE":
        return BigInt(Math.floor(parseFloat(portfolioValue) * 1e8)); // Valeur avec 8 decimales
      default:
        return 0n;
    }
  };

  // Predefined suggestions based on goal type
  const getGoalSuggestions = () => {
    switch (goalType) {
      case "ETH_AMOUNT":
        return [
          { label: "Fonds d'urgence", amount: "1.0", duration: "6 months" },
          { label: "Épargne vacances", amount: "2.0", duration: "12 months" },
          { label: "Achat tech", amount: "0.5", duration: "3 months" },
        ];
      case "ETH_PRICE":
        return [
          {
            label: "Prix conservateur",
            price: "3000",
            description: "Objectif $3,000/ETH",
          },
          {
            label: "Prix optimiste",
            price: "5000",
            description: "Objectif $5,000/ETH",
          },
          {
            label: "Prix ambitieux",
            price: "10000",
            description: "Objectif $10,000/ETH",
          },
        ];
      case "PORTFOLIO_VALUE":
        return [
          {
            label: "Objectif modeste",
            value: "1000",
            description: "Portfolio $1,000",
          },
          {
            label: "Objectif moyen",
            value: "5000",
            description: "Portfolio $5,000",
          },
          {
            label: "Objectif ambitieux",
            value: "10000",
            description: "Portfolio $10,000",
          },
        ];
      default:
        return [];
    }
  };

  const durationSuggestions = [
    { label: "1 Mois", value: 1 },
    { label: "3 Mois", value: 3 },
    { label: "6 Mois", value: 6 },
    { label: "12 Mois", value: 12 },
  ];

  // Handle goal submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user || !address) {
      setError(
        "Veuillez connecter votre wallet et vous connecter pour définir des objectifs"
      );
      return;
    }

    // Validation according to goal type
    if (goalType === "ETH_AMOUNT") {
      if (!goalAmount || !unlockDate) {
        setError("Veuillez remplir tous les champs obligatoires");
        return;
      }
      const goalAmountNum = parseFloat(goalAmount);
      if (goalAmountNum <= 0) {
        setError("Le montant de l'objectif doit être supérieur à 0");
        return;
      }
      const unlockTimestamp = getUnlockTimestamp();
      if (unlockTimestamp <= Date.now() / 1000) {
        setError("La date de déblocage doit être dans le futur");
        return;
      }
    } else if (goalType === "ETH_PRICE") {
      if (!targetPrice) {
        setError("Veuillez spécifier un prix cible");
        return;
      }
      const priceNum = parseFloat(targetPrice);
      if (priceNum <= 0) {
        setError("Le prix cible doit être supérieur à 0");
        return;
      }
    } else if (goalType === "PORTFOLIO_VALUE") {
      if (!portfolioValue) {
        setError("Veuillez spécifier une valeur de portfolio cible");
        return;
      }
      const valueNum = parseFloat(portfolioValue);
      if (valueNum <= 0) {
        setError("La valeur du portfolio doit être supérieure à 0");
        return;
      }
    }

    try {
      setIsLoading(true);
      setError("");
      setSuccess("");

      // Prepare goal data for Firebase
      const goalData = {
        goalType: goalType,
        goalAmount: goalType === "ETH_AMOUNT" ? goalAmount : null,
        targetPrice: goalType === "ETH_PRICE" ? targetPrice : null,
        portfolioValue: goalType === "PORTFOLIO_VALUE" ? portfolioValue : null,
        currency: currency,
        unlockDate: goalType === "ETH_AMOUNT" ? new Date(unlockDate) : null,
        description: description || "",
      };

      const savedGoal = await createGoal(user.uid, address, goalData);
      console.log("Goal saved to Firebase:", savedGoal);

      // Prepare contract parameters
      const targetValue = getTargetValue();
      const unlockTimestamp = getUnlockTimestamp();
      const goalTypeEnum =
        goalType === "ETH_AMOUNT" ? 0 : goalType === "ETH_PRICE" ? 1 : 2;
      const currencyEnum = currency === "USD" ? 0 : 1;

      if (writeCreateGoal) {
        writeCreateGoal({
          args: [
            goalTypeEnum,
            targetValue,
            currencyEnum,
            unlockTimestamp,
            goalData.description || "",
          ],
        });
      }

      // Update local goals list
      const updatedGoals = await getUserGoals(user.uid);
      setUserGoals(updatedGoals);

      setSuccess(
        "Objectif créé avec succès ! Création sur la blockchain en cours..."
      );

      // Reset form
      setGoalAmount("");
      setTargetPrice("");
      setPortfolioValue("");
      setUnlockDate("");
      setDescription("");
    } catch (error) {
      console.error("Error creating goal:", error);
      setError(
        error.message ||
          "Erreur lors de la création de l'objectif. Veuillez réessayer."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle suggestion clicks
  const applySuggestion = (suggestion) => {
    switch (goalType) {
      case "ETH_AMOUNT":
        setGoalAmount(suggestion.amount);
        setDescription(suggestion.label);
        break;
      case "ETH_PRICE":
        setTargetPrice(suggestion.price);
        setDescription(suggestion.label);
        break;
      case "PORTFOLIO_VALUE":
        setPortfolioValue(suggestion.value);
        setDescription(suggestion.label);
        break;
    }
  };

  const applyDuration = (months) => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + months);
    setUnlockDate(futureDate.toISOString().split("T")[0]);
  };

  // Format date for display
  const formatDate = (date) => {
    if (!date) return "";
    return new Date(
      date.seconds ? date.seconds * 1000 : date
    ).toLocaleDateString();
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

  const goalTypeOptions = [
    {
      value: "ETH_AMOUNT",
      label: "💰 Accumulation ETH",
      description: "Économiser une quantité fixe d'ETH avec date limite",
    },
    {
      value: "ETH_PRICE",
      label: "📈 Prix ETH",
      description: "Débloquer quand ETH atteint un prix cible",
    },
    {
      value: "PORTFOLIO_VALUE",
      label: "💼 Valeur Portfolio",
      description: "Débloquer quand le portfolio atteint une valeur cible",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Existing Goals */}
      {userGoals.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-lg shadow-md p-6"
        >
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            Vos Objectifs Actuels
          </h3>
          <div className="grid gap-4">
            {userGoals.map((goal) => (
              <div
                key={goal.id}
                className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-800">
                      {goal.description || "Objectif d'épargne"}
                    </h4>
                    <p className="text-gray-600">
                      {goal.goalType === "ETH_AMOUNT" &&
                        `Cible: ${goal.goalAmount} ETH`}
                      {goal.goalType === "ETH_PRICE" &&
                        `Prix cible: ${goal.targetPrice} ${goal.currency}`}
                      {goal.goalType === "PORTFOLIO_VALUE" &&
                        `Valeur cible: ${goal.portfolioValue} ${goal.currency}`}
                    </p>
                    {goal.unlockDate && (
                      <p className="text-gray-600">
                        Déblocage: {formatDate(goal.unlockDate)}
                      </p>
                    )}
                  </div>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                    Actif
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Create New Goal */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-lg shadow-md p-8"
      >
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
          <span className="mr-3">🎯</span> Définir Votre Objectif d'Épargne
      </h2>

        {!user || !address ? (
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">
              Veuillez connecter votre wallet et vous connecter pour définir des
              objectifs d'épargne.
            </p>
          </div>
      ) : (
        <>
            {/* Error/Success Messages */}
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

            {/* Goal Type Selection */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Type d'Objectif
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {goalTypeOptions.map((option) => (
                  <motion.button
                    key={option.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`p-4 rounded-lg text-center border-2 transition-colors ${
                      goalType === option.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-200"
                    }`}
                    onClick={() => setGoalType(option.value)}
                    disabled={isLoading}
                  >
                    <div className="text-lg font-bold text-blue-600 mb-2">
                      {option.label}
                    </div>
                    <div className="text-sm text-gray-600">
                      {option.description}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Quick Suggestions */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Suggestions Populaires
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {getGoalSuggestions().map((suggestion, index) => (
                  <motion.button
                    key={index}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gray-50 hover:bg-blue-50 p-4 rounded-lg text-center border-2 border-transparent hover:border-blue-200 transition-colors"
                    onClick={() => applySuggestion(suggestion)}
                    disabled={isLoading}
                  >
                    <div className="text-sm font-medium text-blue-600 mb-1">
                      {suggestion.label}
                    </div>
                    <div className="text-xs text-gray-600">
                      {suggestion.description ||
                        `${suggestion.amount} ETH` ||
                        `${suggestion.price} USD` ||
                        `${suggestion.value} USD`}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Goal Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Goal-specific fields */}
                {goalType === "ETH_AMOUNT" && (
                  <>
                    <div>
                <label
                  htmlFor="goalAmount"
                        className="block text-sm font-medium text-gray-700 mb-2"
                >
                        Montant Objectif (ETH) *
                </label>
                <input
                  type="number"
                  id="goalAmount"
                        step="0.001"
                        min="0.001"
                  value={goalAmount}
                  onChange={(e) => setGoalAmount(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="ex: 1.5"
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="unlockDate"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Date de Déblocage *
                      </label>
                      <input
                        type="date"
                        id="unlockDate"
                        value={unlockDate}
                        onChange={(e) => setUnlockDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </>
                )}

                {goalType === "ETH_PRICE" && (
                  <>
                    <div>
                      <label
                        htmlFor="targetPrice"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Prix Cible ({currency}) *
                      </label>
                      <input
                        type="number"
                        id="targetPrice"
                        step="0.01"
                        min="0.01"
                        value={targetPrice}
                        onChange={(e) => setTargetPrice(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="ex: 3000"
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="currency"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Devise *
                      </label>
                      <select
                        id="currency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                        required
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </>
                )}

                {goalType === "PORTFOLIO_VALUE" && (
                  <>
                    <div>
                      <label
                        htmlFor="portfolioValue"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Valeur Portfolio Cible ({currency}) *
                      </label>
                      <input
                        type="number"
                        id="portfolioValue"
                        step="0.01"
                        min="0.01"
                        value={portfolioValue}
                        onChange={(e) => setPortfolioValue(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="ex: 5000"
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="currency"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Devise *
                      </label>
                      <select
                        id="currency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                        required
                      >
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Duration Suggestions - only for ETH_AMOUNT */}
              {goalType === "ETH_AMOUNT" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Durée Rapide
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {durationSuggestions.map((duration) => (
              <button
                        key={duration.value}
                        type="button"
                        onClick={() => applyDuration(duration.value)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm transition-colors"
                        disabled={isLoading}
                      >
                        {duration.label}
              </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
          <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Description (Optionnel)
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Pour quoi épargnez-vous ?"
                  disabled={isLoading}
                />
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading || isConfirming}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                {isLoading || isConfirming ? (
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
                    {isConfirming
                      ? "Création sur Blockchain..."
                      : "Création Objectif..."}
                </div>
                ) : (
                  "Créer Objectif d'Épargne"
              )}
              </motion.button>
            </form>

            {/* Info Section */}
            <div className="mt-8 bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                💡 Guide des Types d'Objectifs
              </h3>
              <div className="space-y-3 text-gray-600">
                <div className="flex items-start space-x-2">
                  <span className="text-blue-600 font-bold">💰</span>
                  <div>
                    <strong>Accumulation ETH:</strong> Définir une quantité
                    d'ETH à atteindre avec une date limite. Parfait pour
                    épargner vers un objectif spécifique.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-green-600 font-bold">📈</span>
                  <div>
                    <strong>Prix ETH:</strong> Les fonds se débloquent
                    automatiquement quand ETH atteint votre prix cible. Idéal
                    pour profiter des hausses de prix.
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-purple-600 font-bold">💼</span>
                  <div>
                    <strong>Valeur Portfolio:</strong> Se débloque quand la
                    valeur totale de vos ETH atteint le montant cible en
                    USD/EUR.
                  </div>
                </div>
              </div>
          </div>
        </>
      )}
      </motion.div>
    </motion.div>
  );
};

export default GoalSetting;
