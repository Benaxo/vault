import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  calculatePortfolioGoalProgress,
  calculatePriceGoalProgress,
  formatPrice,
  getBtcPrice,
  getEthPrice,
  getMarketSentiment,
} from "../services/priceService";
import { getUserGoals } from "../services/userService";

const PortfolioOverview = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ethPrice, setEthPrice] = useState({ usd: 2200, eur: 2000 });
  const [btcPrice, setBtcPrice] = useState({
    usd: 35000,
    eur: 32000,
    usd_24h_change: 0,
  });
  const [marketSentiment, setMarketSentiment] = useState({
    value: 50,
    change24h: 0,
    description: "Neutre",
  });
  const [portfolioStats, setPortfolioStats] = useState({
    totalEthBalance: 0,
    totalValueUsd: 0,
    totalValueEur: 0,
    goalsReached: 0,
    nearGoals: 0,
  });

  // Récupérer les prix et sentiment
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        // Récupérer ETH, BTC et sentiment en parallèle
        const [ethData, btcData, sentimentData] = await Promise.all([
          getEthPrice(),
          getBtcPrice(),
          getMarketSentiment(),
        ]);

        setEthPrice(ethData);
        setBtcPrice(btcData);
        setMarketSentiment(sentimentData);
      } catch (error) {
        console.error("Error fetching market data:", error);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000); // Mise à jour toutes les 30 secondes
    return () => clearInterval(interval);
  }, []);

  // Charger les objectifs
  useEffect(() => {
    const loadGoals = async () => {
      if (!user) return;

      try {
        setIsLoading(false);
        const userGoals = await getUserGoals(user.uid, user.primaryWallet);
        setGoals(userGoals.filter((goal) => goal.isActive));

        // Calculer les statistiques du portefeuille
        const totalEth = userGoals.reduce(
          (sum, goal) => sum + parseFloat(goal.currentBalance || 0),
          0
        );
        const stats = {
          totalEthBalance: totalEth,
          totalValueUsd: totalEth * ethPrice.usd,
          totalValueEur: totalEth * ethPrice.eur,
          goalsReached: 0,
          nearGoals: 0,
        };

        // Calculer les objectifs atteints et proches
        for (const goal of userGoals) {
          let progress = 0;

          if (goal.goalType === "ETH_PRICE") {
            const currentPrice =
              goal.currency === "EUR" ? ethPrice.eur : ethPrice.usd;
            progress = (currentPrice / goal.targetValue) * 100;
          } else if (goal.goalType === "PORTFOLIO_VALUE") {
            const currentValue =
              parseFloat(goal.currentBalance || 0) *
              (goal.currency === "EUR" ? ethPrice.eur : ethPrice.usd);
            progress = (currentValue / goal.targetValue) * 100;
          } else {
            // ETH_AMOUNT (legacy)
            const current = parseFloat(goal.currentBalance || 0);
            const target = parseFloat(goal.goalAmount);
            progress = (current / target) * 100;
          }

          if (progress >= 100) stats.goalsReached++;
          else if (progress >= 80) stats.nearGoals++;
        }

        setPortfolioStats(stats);
      } catch (error) {
        console.error("Error loading goals:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadGoals();
  }, [user, ethPrice]);

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

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Chargement du portefeuille...</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Market Indicators - Nouveau Section */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Sentiment du Marché - Indicateur Principal */}
        <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white p-6 rounded-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-purple-100">
                  Sentiment Global (7j)
                </h3>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold">
                    {marketSentiment.value}
                  </span>
                  <span className="text-2xl text-purple-200">/100</span>
                </div>
                <div className="text-sm text-purple-200 mt-1">
                  {marketSentiment.description}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`flex items-center text-sm font-medium ${
                    marketSentiment.change24h >= 0
                      ? "text-green-300"
                      : "text-red-300"
                  }`}
                >
                  {marketSentiment.change24h >= 0 ? "▲" : "▼"}
                  {Math.abs(marketSentiment.change24h).toFixed(2)}% (24H)
                </div>
              </div>
            </div>

            {/* Mini graphique de sentiment */}
            <div className="mt-4">
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-500"
                  style={{ width: `${marketSentiment.value}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-purple-200 mt-1">
                <span>Pessimiste</span>
                <span>Neutre</span>
                <span>Optimiste</span>
              </div>
            </div>
          </div>

          {/* Effet de background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
        </div>

        {/* Prix Bitcoin */}
        <div className="bg-gradient-to-br from-orange-400 to-yellow-500 text-white p-6 rounded-xl relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-orange-100">
                  Prix Bitcoin
                </h3>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold">
                    ${btcPrice.usd?.toLocaleString() || "35,000"}
                  </span>
                </div>
                <div className="text-sm text-orange-200 mt-1">
                  €{btcPrice.eur?.toLocaleString() || "32,000"}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`flex items-center text-sm font-medium ${
                    (btcPrice.usd_24h_change || 0) >= 0
                      ? "text-green-200"
                      : "text-red-200"
                  }`}
                >
                  {(btcPrice.usd_24h_change || 0) >= 0 ? "▲" : "▼"}
                  {Math.abs(btcPrice.usd_24h_change || 0).toFixed(2)}% (24H)
                </div>
                {!btcPrice.isLive && (
                  <div className="text-xs text-orange-300 mt-1">
                    📡 Données hors ligne
                  </div>
                )}
              </div>
            </div>

            {/* Indicateur de tendance BTC */}
            <div className="mt-4">
              <div className="flex items-center space-x-2">
                <div className="text-2xl">₿</div>
                <div className="flex-1">
                  <div className="text-xs text-orange-200">
                    King des cryptos • Market Cap Leader
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Effet de background */}
          <div className="absolute top-0 right-0 w-28 h-28 bg-white/10 rounded-full -translate-y-14 translate-x-14"></div>
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-10 -translate-x-10"></div>
        </div>
      </motion.div>

      {/* Header avec prix ETH */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              📊 Vue d'Ensemble du Portefeuille
            </h1>
            <p className="text-purple-100">
              Suivez vos objectifs d'investissement crypto
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-purple-200">Prix ETH Actuel</div>
            <div className="text-lg font-bold">
              {formatPrice(ethPrice.usd, "usd")}
            </div>
            <div className="text-sm font-bold">
              {formatPrice(ethPrice.eur, "eur")}
            </div>
            <div
              className={`text-xs ${
                (ethPrice.usd_24h_change || 0) >= 0
                  ? "text-green-300"
                  : "text-red-300"
              }`}
            >
              {(ethPrice.usd_24h_change || 0) >= 0 ? "↗" : "↘"}{" "}
              {Math.abs(ethPrice.usd_24h_change || 0).toFixed(2)}%
            </div>
            {!ethPrice.isLive && (
              <div className="text-xs text-purple-300 mt-1">
                📡 Mode hors ligne
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Statistiques du portefeuille */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="text-2xl mb-2">💰</div>
          <div className="text-2xl font-bold text-green-600">
            {portfolioStats.totalEthBalance.toFixed(4)} ETH
          </div>
          <div className="text-sm text-gray-600">Balance Totale</div>
          <div className="text-xs text-gray-500 mt-1">
            {formatPrice(portfolioStats.totalValueUsd, "usd")} /{" "}
            {formatPrice(portfolioStats.totalValueEur, "eur")}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="text-2xl mb-2">🎯</div>
          <div className="text-2xl font-bold text-blue-600">{goals.length}</div>
          <div className="text-sm text-gray-600">Objectifs Actifs</div>
          <div className="text-xs text-gray-500 mt-1">En cours</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="text-2xl mb-2">🔥</div>
          <div className="text-2xl font-bold text-orange-600">
            {portfolioStats.goalsReached}
          </div>
          <div className="text-sm text-gray-600">Objectifs Atteints</div>
          <div className="text-xs text-gray-500 mt-1">100% complétés</div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-2xl font-bold text-yellow-600">
            {portfolioStats.nearGoals}
          </div>
          <div className="text-sm text-gray-600">Proche du But</div>
          <div className="text-xs text-gray-500 mt-1">80%+ complétés</div>
        </div>
      </motion.div>

      {/* Aide contextuelle pour les décisions d'investissement */}
      <motion.div
        variants={itemVariants}
        className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6"
      >
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          💡 Conseils d'Investissement Basés sur les Indicateurs
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              📊 Sentiment du Marché
            </h4>
            <div className="text-sm text-gray-600 space-y-2">
              {marketSentiment.value >= 70 ? (
                <div className="p-3 bg-green-100 border-l-4 border-green-500 rounded">
                  <p className="font-medium text-green-800">
                    🚀 Sentiment Optimiste ({marketSentiment.value}/100)
                  </p>
                  <p className="text-green-700">
                    Bon moment pour investir progressivement. Le marché est
                    confiant.
                  </p>
                </div>
              ) : marketSentiment.value >= 40 ? (
                <div className="p-3 bg-yellow-100 border-l-4 border-yellow-500 rounded">
                  <p className="font-medium text-yellow-800">
                    ⚖️ Sentiment Neutre ({marketSentiment.value}/100)
                  </p>
                  <p className="text-yellow-700">
                    Investissement modéré recommandé. Surveillez les tendances.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-red-100 border-l-4 border-red-500 rounded">
                  <p className="font-medium text-red-800">
                    ⚠️ Sentiment Pessimiste ({marketSentiment.value}/100)
                  </p>
                  <p className="text-red-700">
                    Opportunité d'achat à bas prix, mais investissez prudemment.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-700 flex items-center">
              ₿ Corrélation Bitcoin
            </h4>
            <div className="text-sm text-gray-600 space-y-2">
              {(btcPrice.usd_24h_change || 0) >= 2 ? (
                <div className="p-3 bg-green-100 border-l-4 border-green-500 rounded">
                  <p className="font-medium text-green-800">
                    📈 BTC en hausse (+{btcPrice.usd_24h_change?.toFixed(1)}%)
                  </p>
                  <p className="text-green-700">
                    Tendance positive pour tout le marché crypto, y compris ETH.
                  </p>
                </div>
              ) : (btcPrice.usd_24h_change || 0) <= -2 ? (
                <div className="p-3 bg-red-100 border-l-4 border-red-500 rounded">
                  <p className="font-medium text-red-800">
                    📉 BTC en baisse ({btcPrice.usd_24h_change?.toFixed(1)}%)
                  </p>
                  <p className="text-red-700">
                    Volatilité attendue sur ETH. Moment pour l'accumulation long
                    terme.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-blue-100 border-l-4 border-blue-500 rounded">
                  <p className="font-medium text-blue-800">
                    ➡️ BTC stable ({btcPrice.usd_24h_change?.toFixed(1)}%)
                  </p>
                  <p className="text-blue-700">
                    Marché en consolidation. Bon pour le DCA (Dollar Cost
                    Averaging).
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-blue-200">
          <p className="text-xs text-gray-500 flex items-center">
            <span className="mr-2">💡</span>
            Ces conseils sont basés sur l'analyse technique et le sentiment de
            marché. Toujours faire ses propres recherches avant d'investir.
          </p>
        </div>
      </motion.div>

      {/* Liste des objectifs */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-xl font-bold text-gray-800 mb-6">
          📋 Mes Objectifs d'Investissement
        </h2>

        {goals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">🎯</div>
            <p>Aucun objectif d'investissement créé.</p>
            <p className="text-sm">
              Créez votre premier objectif pour commencer !
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <GoalProgressCard key={goal.id} goal={goal} ethPrice={ethPrice} />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// Composant pour afficher le progrès d'un objectif
const GoalProgressCard = ({ goal, ethPrice }) => {
  const [progress, setProgress] = useState(0);
  const [currentValue, setCurrentValue] = useState("");
  const [targetDisplay, setTargetDisplay] = useState("");
  const [isReached, setIsReached] = useState(false);

  useEffect(() => {
    const calculateProgress = async () => {
      try {
        if (goal.goalType === "ETH_PRICE") {
          const result = await calculatePriceGoalProgress(
            goal.targetValue,
            goal.currency.toLowerCase()
          );
          setProgress(result.progress);
          setCurrentValue(
            formatPrice(result.currentPrice, goal.currency.toLowerCase())
          );
          setTargetDisplay(
            `${formatPrice(goal.targetValue, goal.currency.toLowerCase())}/ETH`
          );
          setIsReached(result.isReached);
        } else if (goal.goalType === "PORTFOLIO_VALUE") {
          const ethBalance = parseFloat(goal.currentBalance || 0);
          const result = await calculatePortfolioGoalProgress(
            ethBalance,
            goal.targetValue,
            goal.currency.toLowerCase()
          );
          setProgress(result.progress);
          setCurrentValue(
            formatPrice(result.currentValue, goal.currency.toLowerCase())
          );
          setTargetDisplay(
            formatPrice(goal.targetValue, goal.currency.toLowerCase())
          );
          setIsReached(result.isReached);
        } else {
          // ETH_AMOUNT (legacy)
          const current = parseFloat(goal.currentBalance || 0);
          const target = parseFloat(goal.goalAmount);
          const prog = target > 0 ? (current / target) * 100 : 0;
          setProgress(Math.min(prog, 100));
          setCurrentValue(`${current.toFixed(4)} ETH`);
          setTargetDisplay(`${target} ETH`);
          setIsReached(prog >= 100);
        }
      } catch (error) {
        console.error("Error calculating progress:", error);
      }
    };

    calculateProgress();
  }, [goal, ethPrice]);

  const getGoalIcon = () => {
    if (goal.goalType === "ETH_PRICE") return "🎯";
    if (goal.goalType === "PORTFOLIO_VALUE") return "💰";
    return "📊";
  };

  const getProgressColor = () => {
    if (isReached) return "bg-green-500";
    if (progress >= 80) return "bg-yellow-500";
    return "bg-blue-500";
  };

  const getTextColor = () => {
    if (isReached) return "text-green-600";
    if (progress >= 80) return "text-yellow-600";
    return "text-blue-600";
  };

  const getBadge = () => {
    if (isReached)
      return {
        text: "🔥 Objectif Atteint!",
        class: "bg-green-100 text-green-800",
      };
    if (progress >= 80)
      return {
        text: "⚡ Proche du But",
        class: "bg-yellow-100 text-yellow-800",
      };
    if (progress >= 50)
      return { text: "📈 En Bonne Voie", class: "bg-blue-100 text-blue-800" };
    return { text: "🚀 En Cours", class: "bg-gray-100 text-gray-800" };
  };

  const badge = getBadge();

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{getGoalIcon()}</div>
          <div>
            <h3 className="font-semibold text-gray-800">{goal.description}</h3>
            <p className="text-sm text-gray-600">
              {goal.goalType === "ETH_PRICE"
                ? `Prix cible: ${targetDisplay}`
                : goal.goalType === "PORTFOLIO_VALUE"
                ? `Valeur cible: ${targetDisplay}`
                : `Objectif: ${targetDisplay}`}
            </p>
          </div>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${badge.class}`}
        >
          {badge.text}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Progression</span>
          <span className={`font-semibold ${getTextColor()}`}>
            {isReached ? "100%" : `${progress.toFixed(1)}%`}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          ></div>
        </div>
      </div>

      <div className="flex justify-between text-sm">
        <div>
          <span className="text-gray-600">Valeur actuelle: </span>
          <span className="font-semibold">{currentValue}</span>
        </div>
        <div>
          <span className="text-gray-600">Balance: </span>
          <span className="font-semibold">{goal.currentBalance || 0} ETH</span>
        </div>
      </div>

      {goal.goalType === "ETH_PRICE" && (
        <div className="mt-2 text-xs text-gray-500">
          💡 Cet objectif suit le prix de l'ETH en temps réel
        </div>
      )}

      {goal.goalType === "PORTFOLIO_VALUE" && (
        <div className="mt-2 text-xs text-gray-500">
          💡 Cet objectif combine votre balance ETH et la valeur de marché
        </div>
      )}
    </motion.div>
  );
};

export default PortfolioOverview;
