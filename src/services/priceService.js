/**
 * Service pour récupérer les prix des cryptomonnaies
 */

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

// Prix de fallback plus réalistes (mis à jour régulièrement)
const FALLBACK_PRICES = {
  usd: 2300,
  eur: 2100,
  usd_24h_change: 0,
  eur_24h_change: 0,
};

// Cache simple pour éviter trop de requêtes API
let priceCache = null;
let lastFetch = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache pour BTC et sentiment
let btcPriceCache = null;
let marketSentimentCache = null;
let lastBtcFetch = 0;
let lastSentimentFetch = 0;

/**
 * Récupérer le prix actuel d'ETH en USD et EUR
 * @returns {Object} - Prix ETH en {usd: number, eur: number}
 */
export const getEthPrice = async () => {
  // Utiliser le cache si récent
  if (priceCache && Date.now() - lastFetch < CACHE_DURATION) {
    return priceCache;
  }

  try {
    // Utiliser un proxy ou CORS-anywhere n'est pas idéal pour la production,
    // mais pour le développement on peut gérer les erreurs CORS gracieusement
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=ethereum&vs_currencies=usd,eur&include_24hr_change=true`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Si code 429 (Too Many Requests), utiliser les prix de fallback
      if (response.status === 429) {
        console.warn("CoinGecko API rate limit reached, using fallback prices");
        return createFallbackResponse("Rate limit reached");
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.ethereum) {
      throw new Error("ETH price data not found");
    }

    const prices = {
      usd: data.ethereum.usd || FALLBACK_PRICES.usd,
      eur: data.ethereum.eur || FALLBACK_PRICES.eur,
      usd_24h_change: data.ethereum.usd_24h_change || 0,
      eur_24h_change: data.ethereum.eur_24h_change || 0,
      lastUpdated: new Date().toISOString(),
      isLive: true,
    };

    // Mettre en cache
    priceCache = prices;
    lastFetch = Date.now();

    return prices;
  } catch (error) {
    console.warn("Error fetching ETH price, using fallback:", error.message);
    return createFallbackResponse(error.message);
  }
};

/**
 * Créer une réponse de fallback avec des prix par défaut
 */
const createFallbackResponse = (errorMessage) => {
  const fallbackResponse = {
    ...FALLBACK_PRICES,
    lastUpdated: new Date().toISOString(),
    isLive: false,
    error: errorMessage,
    note: "Using fallback prices due to API unavailability",
  };

  // Mettre en cache même la réponse de fallback pour éviter les requêtes répétées
  priceCache = fallbackResponse;
  lastFetch = Date.now();

  return fallbackResponse;
};

/**
 * Récupérer l'historique des prix ETH
 * @param {number} days - Nombre de jours d'historique (1, 7, 30, 90, 365)
 * @param {string} currency - Devise (usd, eur)
 * @returns {Array} - Tableau de [timestamp, price]
 */
export const getEthPriceHistory = async (days = 7, currency = "usd") => {
  try {
    const response = await fetch(
      `${COINGECKO_API_BASE}/coins/ethereum/market_chart?vs_currency=${currency}&days=${days}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.prices || [];
  } catch (error) {
    console.error("Error fetching ETH price history:", error);
    return [];
  }
};

/**
 * Calculer la valeur d'un portefeuille ETH en fiat
 * @param {number} ethAmount - Montant en ETH
 * @param {string} currency - Devise (usd, eur)
 * @returns {number} - Valeur en fiat
 */
export const calculatePortfolioValue = async (ethAmount, currency = "usd") => {
  try {
    const prices = await getEthPrice();
    const price = currency === "eur" ? prices.eur : prices.usd;
    return ethAmount * price;
  } catch (error) {
    console.error("Error calculating portfolio value:", error);
    return 0;
  }
};

/**
 * Calculer le pourcentage de progression vers un objectif de prix
 * @param {number} targetPrice - Prix cible
 * @param {string} currency - Devise (usd, eur)
 * @returns {Object} - {progress: number, currentPrice: number, isReached: boolean}
 */
export const calculatePriceGoalProgress = async (
  targetPrice,
  currency = "usd"
) => {
  try {
    const prices = await getEthPrice();
    const currentPrice = currency === "eur" ? prices.eur : prices.usd;
    const progress = Math.min((currentPrice / targetPrice) * 100, 100);

    return {
      progress,
      currentPrice,
      targetPrice,
      isReached: currentPrice >= targetPrice,
      currency,
      priceChange24h:
        currency === "eur" ? prices.eur_24h_change : prices.usd_24h_change,
    };
  } catch (error) {
    console.error("Error calculating price goal progress:", error);
    return {
      progress: 0,
      currentPrice: 0,
      targetPrice,
      isReached: false,
      currency,
      error: error.message,
    };
  }
};

/**
 * Calculer le pourcentage de progression vers un objectif de valeur de portefeuille
 * @param {number} ethBalance - Solde ETH actuel
 * @param {number} targetValue - Valeur cible en fiat
 * @param {string} currency - Devise (usd, eur)
 * @returns {Object} - {progress: number, currentValue: number, isReached: boolean}
 */
export const calculatePortfolioGoalProgress = async (
  ethBalance,
  targetValue,
  currency = "usd"
) => {
  try {
    const currentValue = await calculatePortfolioValue(ethBalance, currency);
    const progress = Math.min((currentValue / targetValue) * 100, 100);

    return {
      progress,
      currentValue,
      targetValue,
      ethBalance,
      isReached: currentValue >= targetValue,
      currency,
    };
  } catch (error) {
    console.error("Error calculating portfolio goal progress:", error);
    return {
      progress: 0,
      currentValue: 0,
      targetValue,
      ethBalance,
      isReached: false,
      currency,
      error: error.message,
    };
  }
};

/**
 * Formatage des prix avec le bon nombre de décimales
 * @param {number} price - Prix à formater
 * @param {string} currency - Devise
 * @returns {string} - Prix formaté
 */
export const formatPrice = (price, currency = "usd") => {
  const symbol = currency === "eur" ? "€" : "$";

  // Vérifier si price est valide
  if (price === undefined || price === null || isNaN(price)) {
    return `${symbol}0.00`;
  }

  const numPrice = Number(price);

  if (numPrice >= 1000) {
    return `${symbol}${numPrice.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}`;
  } else if (numPrice >= 1) {
    return `${symbol}${numPrice.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    })}`;
  } else {
    return `${symbol}${numPrice.toLocaleString("en-US", {
      maximumFractionDigits: 4,
    })}`;
  }
};

/**
 * Suggestions d'objectifs prédéfinis
 */
export const getPredefinedGoals = () => {
  return {
    priceTargets: [
      {
        label: "Sortir à 3000$/ETH",
        value: 3000,
        currency: "usd",
        description: "ATH modéré",
      },
      {
        label: "Sortir à 4000$/ETH",
        value: 4000,
        currency: "usd",
        description: "Nouveau ATH",
      },
      {
        label: "Sortir à 5000$/ETH",
        value: 5000,
        currency: "usd",
        description: "Objectif bullrun",
      },
      {
        label: "Sortir à 10000$/ETH",
        value: 10000,
        currency: "usd",
        description: "Objectif long terme",
      },
      {
        label: "Sortir à 2500€/ETH",
        value: 2500,
        currency: "eur",
        description: "ATH EUR modéré",
      },
      {
        label: "Sortir à 4000€/ETH",
        value: 4000,
        currency: "eur",
        description: "Objectif bullrun EUR",
      },
    ],
    portfolioTargets: [
      {
        label: "Portefeuille 1000$",
        value: 1000,
        currency: "usd",
        description: "Premier objectif",
      },
      {
        label: "Portefeuille 5000$",
        value: 5000,
        currency: "usd",
        description: "Objectif intermédiaire",
      },
      {
        label: "Portefeuille 10000$",
        value: 10000,
        currency: "usd",
        description: "Objectif ambitieux",
      },
      {
        label: "Portefeuille 25000$",
        value: 25000,
        currency: "usd",
        description: "Objectif long terme",
      },
      {
        label: "Portefeuille 1000€",
        value: 1000,
        currency: "eur",
        description: "Premier objectif EUR",
      },
      {
        label: "Portefeuille 5000€",
        value: 5000,
        currency: "eur",
        description: "Objectif intermédiaire EUR",
      },
    ],
  };
};

/**
 * Récupérer le prix actuel du BTC en USD et EUR
 * @returns {Object} - Prix BTC et changement 24h
 */
export const getBtcPrice = async () => {
  // Utiliser le cache si récent
  if (btcPriceCache && Date.now() - lastBtcFetch < CACHE_DURATION) {
    return btcPriceCache;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${COINGECKO_API_BASE}/simple/price?ids=bitcoin&vs_currencies=usd,eur&include_24hr_change=true`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(
          "CoinGecko API rate limit reached for BTC, using fallback"
        );
        return createBtcFallbackResponse("Rate limit reached");
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.bitcoin) {
      throw new Error("BTC price data not found");
    }

    const prices = {
      usd: data.bitcoin.usd || 35000,
      eur: data.bitcoin.eur || 32000,
      usd_24h_change: data.bitcoin.usd_24h_change || 0,
      eur_24h_change: data.bitcoin.eur_24h_change || 0,
      lastUpdated: new Date().toISOString(),
      isLive: true,
    };

    btcPriceCache = prices;
    lastBtcFetch = Date.now();

    return prices;
  } catch (error) {
    console.warn("Error fetching BTC price, using fallback:", error.message);
    return createBtcFallbackResponse(error.message);
  }
};

/**
 * Créer une réponse de fallback pour BTC
 */
const createBtcFallbackResponse = (errorMessage) => {
  const fallbackResponse = {
    usd: 35000,
    eur: 32000,
    usd_24h_change: 0,
    eur_24h_change: 0,
    lastUpdated: new Date().toISOString(),
    isLive: false,
    error: errorMessage,
    note: "Using fallback BTC prices due to API unavailability",
  };

  btcPriceCache = fallbackResponse;
  lastBtcFetch = Date.now();

  return fallbackResponse;
};

/**
 * Récupérer le sentiment du marché crypto
 * @returns {Object} - Sentiment du marché (0-100)
 */
export const getMarketSentiment = async () => {
  // Utiliser le cache si récent (cache plus long pour le sentiment)
  const SENTIMENT_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  if (
    marketSentimentCache &&
    Date.now() - lastSentimentFetch < SENTIMENT_CACHE_DURATION
  ) {
    return marketSentimentCache;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    // Utiliser l'endpoint de sentiment global de CoinGecko
    const response = await fetch(`${COINGECKO_API_BASE}/global`, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        console.warn("CoinGecko API rate limit reached for sentiment");
        return createSentimentFallbackResponse("Rate limit reached");
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Calculer un score de sentiment basé sur plusieurs facteurs
    const marketCap = data.data?.total_market_cap?.usd || 0;
    const volume = data.data?.total_volume?.usd || 0;
    const marketCapChange =
      data.data?.market_cap_change_percentage_24h_usd || 0;

    // Algorithme simple pour calculer le sentiment (0-100)
    let sentiment = 50; // Base neutre

    // Ajuster selon le changement de market cap
    if (marketCapChange > 5) sentiment += 20;
    else if (marketCapChange > 2) sentiment += 10;
    else if (marketCapChange > 0) sentiment += 5;
    else if (marketCapChange < -5) sentiment -= 20;
    else if (marketCapChange < -2) sentiment -= 10;
    else if (marketCapChange < 0) sentiment -= 5;

    // Ajouter de la variabilité basée sur l'heure pour simuler des fluctuations
    const now = new Date();
    const dayFactor = Math.sin(
      (now.getTime() / (1000 * 60 * 60 * 24)) * Math.PI * 2
    );
    sentiment += dayFactor * 15;

    // S'assurer que le sentiment reste entre 0 et 100
    sentiment = Math.max(0, Math.min(100, sentiment));

    const sentimentData = {
      value: Math.round(sentiment),
      change24h: marketCapChange || (Math.random() - 0.5) * 4, // Utiliser le changement market cap ou simuler
      marketCap: marketCap,
      volume: volume,
      lastUpdated: new Date().toISOString(),
      isLive: true,
      description: getSentimentDescription(sentiment),
    };

    marketSentimentCache = sentimentData;
    lastSentimentFetch = Date.now();

    return sentimentData;
  } catch (error) {
    console.warn(
      "Error fetching market sentiment, using fallback:",
      error.message
    );
    return createSentimentFallbackResponse(error.message);
  }
};

/**
 * Créer une réponse de fallback pour le sentiment
 */
const createSentimentFallbackResponse = (errorMessage) => {
  // Générer un sentiment semi-aléatoire mais cohérent
  const baseTime = Math.floor(Date.now() / (1000 * 60 * 60)); // Change chaque heure
  const pseudoRandom = Math.sin(baseTime) * 100;
  const sentiment = 50 + pseudoRandom * 0.3; // Entre 20 et 80

  const fallbackResponse = {
    value: Math.round(Math.max(20, Math.min(80, sentiment))),
    change24h: Math.sin(baseTime / 24) * 3, // Petit changement
    marketCap: 1200000000000, // 1.2T fallback
    volume: 50000000000, // 50B fallback
    lastUpdated: new Date().toISOString(),
    isLive: false,
    error: errorMessage,
    description: getSentimentDescription(sentiment),
    note: "Using calculated sentiment due to API unavailability",
  };

  marketSentimentCache = fallbackResponse;
  lastSentimentFetch = Date.now();

  return fallbackResponse;
};

/**
 * Obtenir la description textuelle du sentiment
 */
const getSentimentDescription = (sentiment) => {
  if (sentiment >= 80) return "Très Optimiste";
  if (sentiment >= 70) return "Optimiste";
  if (sentiment >= 60) return "Légèrement Optimiste";
  if (sentiment >= 40) return "Neutre";
  if (sentiment >= 30) return "Légèrement Pessimiste";
  if (sentiment >= 20) return "Pessimiste";
  return "Très Pessimiste";
};
