import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useContractWrite,
  useWaitForTransaction,
} from "wagmi";
import PiggyBankVaultABI from "../abi/PiggyBankVault.json";
import {
  CONTRACT_ADDRESS,
  DEFAULT_TOKEN,
  SUPPORTED_TOKENS,
  TOKEN_METADATA,
} from "../constants";
import { useAuth } from "../hooks/useAuth";
import { formatPrice } from "../services/priceService";
import {
  recordDepositTransaction,
  updateGoalBalance,
} from "../services/userService";
import GoalSelector from "./GoalSelector";

export const DepositForm = () => {
  const { address } = useAccount();
  const { user } = useAuth();
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(DEFAULT_TOKEN);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // Get user's ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Get user's BTC balance
  const { data: btcBalance } = useBalance({
    address: address,
    token: SUPPORTED_TOKENS.BTC,
  });

  // Get current token balance
  const getCurrentTokenBalance = () => {
    switch (selectedToken) {
      case SUPPORTED_TOKENS.BTC:
        return btcBalance;
      case SUPPORTED_TOKENS.ETH:
      default:
        return ethBalance;
    }
  };

  const currentTokenBalance = getCurrentTokenBalance();
  const currentTokenMetadata = TOKEN_METADATA[selectedToken];

  useEffect(() => {
    if (user) {
      setUserProfile({
        id: user.uid,
        primaryWallet: user.primaryWallet || address,
      });
    }
  }, [user, address]);

  const amountInWei = amount
    ? BigInt(
        Math.floor(
          parseFloat(amount) *
            Math.pow(10, currentTokenMetadata?.decimals || 18)
        )
      )
    : 0n;

  const { data, write } = useContractWrite({
    address: CONTRACT_ADDRESS,
    abi: PiggyBankVaultABI,
    functionName: "deposit",
  });

  const { isLoading: isConfirming, isSuccess } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess: async () => {
      try {
        // Calculer la valeur du dépôt avec des prix de fallback
        const depositAmount = parseFloat(amount);
        const fallbackPrices = { usd: 2300, eur: 2100 };
        const depositValueUsd = depositAmount * fallbackPrices.usd;
        const depositValueEur = depositAmount * fallbackPrices.eur;

        // Enregistrer la transaction
        await recordDepositTransaction(user.uid, address, selectedGoal.id, {
          amount: amount,
          valueUsd: depositValueUsd,
          valueEur: depositValueEur,
          ethPriceAtTime: fallbackPrices,
          blockchainGoalId: selectedGoal.blockchainGoalId,
          transactionHash: data?.hash,
          tokenSymbol: currentTokenMetadata?.symbol,
        });

        // Mettre à jour le solde du goal
        const newBalance = (
          parseFloat(selectedGoal.currentBalance || 0) + depositAmount
        ).toString();
        await updateGoalBalance(selectedGoal.id, newBalance);

        setSuccess(
          `Dépôt de ${amount} ${currentTokenMetadata?.symbol} réussi ! ` +
            `Valeur approximative: ${formatPrice(
              depositValueUsd,
              "usd"
            )} / ${formatPrice(depositValueEur, "eur")}`
        );
        setAmount("");
        setError("");
      } catch (error) {
        console.error("Error recording transaction:", error);
        setError("Deposit successful but failed to update records");
      }
    },
  });

  const isValidAmount = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) return false;

    // Check if user has enough balance (leave some for gas)
    if (currentTokenBalance && currentTokenBalance.value) {
      const maxAmount = parseFloat(currentTokenBalance.formatted) - 0.001;
      return amountNum <= maxAmount;
    }

    return amountNum <= 100; // Fallback maximum
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log("Debug - handleSubmit called");
    console.log("Debug - selectedGoal:", selectedGoal);
    console.log("Debug - write function available:", !!write);
    console.log("Debug - blockchainGoalId:", selectedGoal?.blockchainGoalId);
    console.log("Debug - selectedToken:", selectedToken);

    if (!selectedGoal) {
      setError("Veuillez sélectionner ou créer un objectif d'abord");
      return;
    }

    if (!isValidAmount()) {
      const balanceFormatted = currentTokenBalance
        ? parseFloat(currentTokenBalance.formatted)
        : 0;
      setError(
        `Montant invalide. Balance disponible: ${balanceFormatted.toFixed(4)} ${
          currentTokenMetadata?.symbol
        } (0.001 réservé pour les frais)`
      );
      return;
    }

    if (!address) {
      setError("Veuillez connecter votre wallet pour effectuer un dépôt");
      return;
    }

    if (!write) {
      setError(
        "Fonction de dépôt non disponible. Vérifiez votre connexion blockchain."
      );
      console.error("Debug - write function is not available");
      return;
    }

    if (!selectedGoal.blockchainGoalId) {
      setError(
        "Cet objectif n'est pas encore enregistré sur la blockchain. Veuillez attendre ou créer un nouvel objectif."
      );
      console.error(
        "Debug - selectedGoal.blockchainGoalId is missing:",
        selectedGoal
      );
      return;
    }

    try {
      setError("");
      setSuccess("");

      console.log("Debug - Attempting to call write with args:", {
        tokenAddress: selectedToken,
        goalId: selectedGoal.blockchainGoalId,
        value: amountInWei.toString(),
      });

      write({
        args: [selectedToken, selectedGoal.blockchainGoalId],
        value: amountInWei,
      });
    } catch (error) {
      console.error("Error calling write function:", error);
      setError(
        "Erreur lors de l'appel de la fonction de dépôt: " + error.message
      );
    }
  };

  const handleGoalCreate = (newGoal) => {
    setSelectedGoal(newGoal);
    setError("");
  };

  // Get quick amount suggestions based on balance
  const getAmountSuggestions = () => {
    if (!currentTokenBalance || !currentTokenBalance.value)
      return ["0.001", "0.01", "0.1"];

    const balanceAmount = parseFloat(currentTokenBalance.formatted);
    const maxAmount = balanceAmount - 0.001; // Reserve for gas

    if (maxAmount <= 0) return [];

    return [
      (maxAmount * 0.1).toFixed(3),
      (maxAmount * 0.25).toFixed(3),
      (maxAmount * 0.5).toFixed(3),
      maxAmount.toFixed(3),
    ].filter((amount) => parseFloat(amount) > 0);
  };

  // Calculer la valeur du dépôt en temps réel (optionnel, sans API)
  const getDepositValue = () => {
    if (!amount || !isValidAmount()) return null;

    const amountNum = parseFloat(amount);
    // Utiliser des prix de fallback pour l'affichage approximatif
    const fallbackPrices = { usd: 2300, eur: 2100 };
    const valueUsd = amountNum * fallbackPrices.usd;
    const valueEur = amountNum * fallbackPrices.eur;

    return { valueUsd, valueEur, isApproximate: true };
  };

  // Format goal information based on type
  const getGoalTypeIcon = (goalType) => {
    switch (goalType) {
      case "ETH_PRICE":
        return "📈";
      case "PORTFOLIO_VALUE":
        return "💼";
      default:
        return "🎯";
    }
  };

  const getGoalTypeDescription = (goal) => {
    if (!goal) return "";

    switch (goal.goalType) {
      case "ETH_PRICE":
        const targetPrice = goal.targetPrice || 0;
        const priceCurrency = goal.currency?.toLowerCase() || "usd";
        return `Prix cible: ${formatPrice(targetPrice, priceCurrency)}/ETH`;
      case "PORTFOLIO_VALUE":
        const portfolioValue = goal.portfolioValue || 0;
        const portfolioCurrency = goal.currency?.toLowerCase() || "usd";
        return `Valeur cible: ${formatPrice(
          portfolioValue,
          portfolioCurrency
        )}`;
      default:
        const goalAmount = goal.goalAmount || 0;
        return `Objectif: ${goalAmount} ETH`;
    }
  };

  const getUnlockCondition = (goal) => {
    if (!goal) return "";

    switch (goal.goalType) {
      case "ETH_PRICE":
        return "Déblocage automatique quand le prix cible est atteint";
      case "PORTFOLIO_VALUE":
        return "Déblocage automatique quand la valeur du portfolio est atteinte";
      default:
        return goal.unlockDate
          ? `Déblocage: ${new Date(
              goal.unlockDate.seconds
                ? goal.unlockDate.seconds * 1000
                : goal.unlockDate
            ).toLocaleDateString()}`
          : "Date de déblocage non définie";
    }
  };

  const depositValue = getDepositValue();
  const amountSuggestions = getAmountSuggestions();

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

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
        <span className="mr-3">💰</span>
        Faire un Dépôt
      </motion.h2>

      {/* Token Selection */}
      <motion.div variants={itemVariants} className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Token à déposer
        </label>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(SUPPORTED_TOKENS).map(([key, tokenAddress]) => {
            const metadata = TOKEN_METADATA[tokenAddress];
            const balance = key === "BTC" ? btcBalance : ethBalance;
            const isSelected = selectedToken === tokenAddress;

            return (
              <button
                key={tokenAddress}
                type="button"
                onClick={() => setSelectedToken(tokenAddress)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                disabled={isLoading || isConfirming}
              >
                <div className="text-center">
                  <img
                    src={metadata.logo}
                    alt={metadata.symbol}
                    className={
                      metadata.symbol === "ETH"
                        ? "h-7 w-4 mx-auto mb-1"
                        : "w-8 h-8 mx-auto mb-1"
                    }
                  />
                  <div className="font-medium text-sm">{metadata.symbol}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {balance
                      ? `${parseFloat(balance.formatted).toFixed(4)}`
                      : "0.0000"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Note about wrapping ETH */}
        {selectedToken === SUPPORTED_TOKENS.ETH && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start">
              <span className="text-blue-600 mr-2">ℹ️</span>
              <div className="text-sm text-blue-800">
                <p className="font-medium">Info :</p>
                <p>
                  Vous déposez de l'ETH natif sur Sepolia. Les frais de gaz sont
                  prélevés en ETH.
                </p>
              </div>
            </div>
          </div>
        )}
        {selectedToken === SUPPORTED_TOKENS.BTC && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <span className="text-yellow-600 mr-2">⚠️</span>
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Note :</p>
                <p>
                  Vous déposez du BTC tokenisé sur Sepolia. Vérifiez que vous
                  avez le bon token BTC.
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Current Token Balance Display */}
      {currentTokenBalance && (
        <motion.div
          variants={itemVariants}
          className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl mr-3">
                {currentTokenMetadata?.symbol === "ETH" ? (
                  <img
                    src="/Ethereum_logo.png"
                    alt="Ethereum Logo"
                    className="h-7 w-4 inline-block align-middle mr-2"
                  />
                ) : (
                  currentTokenMetadata?.logo
                )}
              </span>
              <div>
                <p className="text-green-800 font-medium">
                  Balance {currentTokenMetadata?.symbol}
                </p>
                <p className="text-green-700 text-lg font-semibold">
                  {parseFloat(currentTokenBalance.formatted).toFixed(4)}{" "}
                  {currentTokenMetadata?.symbol}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-green-600 text-sm">Disponible pour dépôt</p>
              <p className="text-green-700 font-medium">
                {Math.max(
                  0,
                  parseFloat(currentTokenBalance.formatted) - 0.001
                ).toFixed(4)}{" "}
                {currentTokenMetadata?.symbol}
              </p>
              <p className="text-xs text-green-600">
                (0.001 réservé pour les frais)
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Goal Selection */}
      <motion.div variants={itemVariants} className="mb-6">
        <GoalSelector
          userProfile={userProfile}
          selectedGoal={selectedGoal}
          onGoalSelect={setSelectedGoal}
          onGoalCreate={handleGoalCreate}
        />
      </motion.div>

      {/* Info Section about Price Approximation */}
      <motion.div
        variants={itemVariants}
        className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg"
      >
        <div className="flex items-start">
          <span className="text-blue-500 mr-2">ℹ️</span>
          <div className="text-sm">
            <p className="text-blue-800 font-medium">
              Information sur les prix
            </p>
            <p className="text-blue-700 mt-1">
              Les valeurs affichées sont approximatives. Les prix exacts et les
              conversions seront calculés au moment de la transaction sur la
              blockchain.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Deposit Form */}
      {selectedGoal && (
        <motion.form
          variants={itemVariants}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Montant à déposer ({currentTokenMetadata?.symbol})
            </label>

            {/* Quick Amount Suggestions */}
            {amountSuggestions.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="text-sm text-gray-600 mr-2">Suggestions:</span>
                {amountSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setAmount(suggestion)}
                    className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm transition-colors"
                    disabled={isLoading || isConfirming}
                  >
                    {suggestion} {currentTokenMetadata?.symbol}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <input
                type="number"
                id="amount"
                step="0.001"
                min="0.001"
                max={
                  currentTokenBalance
                    ? Math.max(
                        0,
                        parseFloat(currentTokenBalance.formatted) - 0.001
                      )
                    : 100
                }
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.1"
                disabled={isLoading || isConfirming}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-gray-500 font-medium">
                  {currentTokenMetadata?.symbol}
                </span>
              </div>
            </div>

            {/* Real-time value display */}
            {depositValue && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  Valeur du dépôt (estimation):
                </div>
                <div className="flex space-x-4 mt-1">
                  <span className="font-semibold text-green-600">
                    ~{formatPrice(depositValue.valueUsd, "usd")}
                  </span>
                  <span className="font-semibold text-blue-600">
                    ~{formatPrice(depositValue.valueEur, "eur")}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  * Prix approximatifs, valeurs réelles calculées lors du dépôt
                </div>
              </div>
            )}
          </div>

          {/* Goal Progress Info */}
          {selectedGoal && (
            <motion.div
              variants={itemVariants}
              className="p-4 bg-blue-50 rounded-lg"
            >
              <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                <span className="mr-2">
                  {getGoalTypeIcon(selectedGoal.goalType)}
                </span>
                {selectedGoal.description || "Objectif d'épargne"}
              </h4>
              <div className="text-sm text-gray-600 space-y-1">
                <div>{getGoalTypeDescription(selectedGoal)}</div>
                {selectedGoal.goalType === "ETH_AMOUNT" && (
                  <div>
                    Balance actuelle: {selectedGoal.currentBalance || 0} ETH
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-2">
                  {getUnlockCondition(selectedGoal)}
                </div>
              </div>
            </motion.div>
          )}

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

          <motion.button
            variants={itemVariants}
            type="submit"
            disabled={
              !isValidAmount() ||
              isLoading ||
              isConfirming ||
              !selectedGoal ||
              !write
            }
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition duration-200 transform hover:scale-105 disabled:hover:scale-100"
          >
            {isConfirming
              ? "Confirmation en cours..."
              : isLoading
              ? "Traitement..."
              : `Déposer ${currentTokenMetadata?.symbol}`}
          </motion.button>
        </motion.form>
      )}

      {!address && (
        <motion.div
          variants={itemVariants}
          className="text-center py-8 text-gray-600"
        >
          Connectez votre wallet pour effectuer un dépôt.
        </motion.div>
      )}
    </motion.div>
  );
};
