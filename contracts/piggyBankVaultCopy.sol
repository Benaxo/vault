// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {AggregatorV3Interface} from "@chainlink/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// Interface pour le token de gouvernance
interface IPiggyGovernanceToken {
    function updateUserScore(address user, uint256 newScore) external;
    function distributeMonthlyRewards(address user) external returns (uint256);
    function markMonthlyDistribution() external;
}

contract PiggyBankVault is Ownable {

    // Types d'objectifs supportés
    enum GoalType {
        ETH_AMOUNT,      // Objectif basé sur la quantité d'ETH (avec contrainte de temps)
        ETH_PRICE,       // Objectif basé sur le prix cible d'ETH (sans contrainte de temps)
        PORTFOLIO_VALUE  // Objectif basé sur la valeur totale du portefeuille (sans contrainte de temps)
    }

    // Devises supportées pour les objectifs fiat
    enum Currency {
        USD,
        EUR
    }

    // Structure principale pour un objectif d'épargne
    struct Vault {
        uint256 balance;                // Solde en ETH (en Wei)
        GoalType goalType;              // Type d'objectif
        uint256 targetValue;            // Valeur cible (ETH en Wei, prix en USD/EUR avec 8 decimals, ou valeur portfolio)
        Currency currency;              // Devise pour les objectifs fiat
        uint256 unlockTimestamp;        // Timestamp de déblocage (utilisé seulement pour ETH_AMOUNT, 0 pour les autres)
        address owner;                  // Propriétaire
        bool isActive;                  // Statut actif
        string description;             // Description
        uint256 createdAt;              // Timestamp de création
        bool isCompleted;               // Objectif complété
        uint256 completedAt;            // Timestamp de completion
    }

    // Structure pour le score utilisateur
    struct UserStats {
        uint256 goalsCreated;           // Nombre d'objectifs créés
        uint256 goalsCompleted;         // Nombre d'objectifs complétés
        uint256 goalsFailed;            // Nombre d'objectifs échoués
        uint256 totalDeposited;         // Montant total déposé (en Wei)
        uint256 totalLocked;            // Montant actuellement verrouillé
        uint256 joinTimestamp;          // Date d'inscription
        uint256 lastActivityTimestamp;  // Dernière activité
        uint256 lastScoreUpdate;        // Dernière mise à jour du score
        uint256 currentScore;           // Score actuel
        uint256 totalRewardsEarned;     // Total des récompenses gagnées
    }

    // Configuration DCA (Dollar Cost Averaging)
    struct DCAConfig {
        uint256 amount;
        uint256 interval;
        uint256 maxIterations;
        uint256 iterationCount;
        uint256 lastTimestamp;
    }

    // Configuration des prix pour les stratégies automatiques
    struct PriceConfig {
        uint256 targetPrice;
        uint256 stopBuyPrice;
        address targetToken;
    }

    // Mappings principaux
    mapping(address => uint256) public earlyWithdrawalFees;
    mapping(address => uint256) public loyaltyRewards;
    mapping(address => bool) public allowedTokens;
    mapping(address => AggregatorV3Interface) public priceFeeds;
    
    // Mappings pour les objectifs
    mapping(uint256 => Vault) public vaults;  // goalId => Vault
    mapping(address => uint256[]) public userGoals;  // user => goalIds[]
    mapping(address => uint256) public userGoalCount;  // user => nombre d'objectifs
    
    // Mappings pour les configurations avancées (optionnelles)
    mapping(uint256 => DCAConfig) public dcaConfigs;  // goalId => DCAConfig
    mapping(uint256 => PriceConfig) public priceConfigs;  // goalId => PriceConfig

    // Mappings pour le système de scoring
    mapping(address => UserStats) public userStats;
    mapping(address => uint256) public lastMonthlyRewardClaim; // Dernière réclamation mensuelle
    
    // Contrôle de distribution des récompenses
    uint256 public lastGlobalRewardDistribution;
    uint256 public constant REWARD_DISTRIBUTION_INTERVAL = 30 days;

    // Price feed pour ETH/USD (Oracle Chainlink)
    AggregatorV3Interface public ethUsdPriceFeed;
    // Price feed pour EUR/USD pour conversion
    AggregatorV3Interface public eurUsdPriceFeed;
    
    // Token de gouvernance
    IPiggyGovernanceToken public governanceToken;

    uint256 private nextGoalId = 1;

    // Events optimisés
    event GoalCreated(address indexed user, uint256 indexed goalId, GoalType goalType, uint256 targetValue, Currency currency);
    event GoalCreatedWithDescription(address indexed user, uint256 indexed goalId, string description);
    event DepositToGoal(address indexed user, uint256 indexed goalId, uint256 amount);
    event GoalReached(address indexed user, uint256 indexed goalId, uint256 totalAmount);
    event WithdrawFromGoal(address indexed user, uint256 indexed goalId, uint256 amount);
    event EarlyWithdrawal(address indexed user, uint256 indexed goalId, uint256 amount, uint256 fee);
    
    // Events DCA
    event DCASetup(address indexed user, uint256 indexed goalId, uint256 amount, uint256 interval);
    event DCATriggered(address indexed user, uint256 indexed goalId, uint256 amount, uint256 iteration);
    
    // Events Prix
    event TargetPriceSet(address indexed user, uint256 indexed goalId, uint256 price);
    event StopBuySet(address indexed user, uint256 indexed goalId, uint256 price);
    event SaleTriggered(address indexed user, uint256 indexed goalId, uint256 amount);
    
    // Events système
    event UnlockTimestampSet(address indexed user, uint256 indexed goalId, uint256 timestamp);
    event LoyaltyRewardAdded(address user, uint256 reward);
    event TokenAllowed(address token, address feed);
    
    // Events pour le système de score
    event UserScoreUpdated(address indexed user, uint256 newScore);
    event MonthlyRewardsClaimed(address indexed user, uint256 amount);
    event GoalCompleted(address indexed user, uint256 indexed goalId);
    event GoalFailed(address indexed user, uint256 indexed goalId);

    constructor(
        address[] memory _tokens,
        address[] memory _priceFeeds,
        address _ethUsdPriceFeed,
        address _eurUsdPriceFeed,
        address _governanceToken
    ) Ownable(msg.sender) {
        require(_tokens.length == _priceFeeds.length, "Length mismatch");

        for (uint256 i = 0; i < _tokens.length; i++) {
            allowedTokens[_tokens[i]] = true;
            priceFeeds[_tokens[i]] = AggregatorV3Interface(_priceFeeds[i]);
            emit TokenAllowed(_tokens[i], _priceFeeds[i]);
        }

        // Initialiser les price feeds pour les conversions fiat
        ethUsdPriceFeed = AggregatorV3Interface(_ethUsdPriceFeed);
        eurUsdPriceFeed = AggregatorV3Interface(_eurUsdPriceFeed);
        
        // Initialiser le token de gouvernance (peut être address(0) initialement)
        if (_governanceToken != address(0)) {
            governanceToken = IPiggyGovernanceToken(_governanceToken);
        }
        
        lastGlobalRewardDistribution = block.timestamp;
    }

    modifier onlyAllowedToken(address tokenAddress) {
        require(allowedTokens[tokenAddress], "Token not allowed");
        _;
    }

    modifier onlyGoalOwner(uint256 goalId) {
        require(vaults[goalId].owner == msg.sender, "Not your goal");
        require(vaults[goalId].isActive, "Goal not active");
        _;
    }

    // === FONCTIONS PRINCIPALES ===

    function createGoal(
        GoalType _goalType,
        uint256 _targetValue,
        Currency _currency,
        uint256 _unlockTimestamp,
        string memory _description
    ) external returns (uint256) {
        require(_targetValue > 0, "Target value must be greater than 0");
        
        // Vérifier la contrainte de temps seulement pour les objectifs ETH_AMOUNT
        if (_goalType == GoalType.ETH_AMOUNT) {
            require(_unlockTimestamp > block.timestamp, "Unlock time must be in future for ETH_AMOUNT goals");
        } else {
            // Pour les objectifs de prix et de valeur, ignorer le timestamp (mettre à 0)
            _unlockTimestamp = 0;
        }
        
        uint256 goalId = nextGoalId++;
        
        vaults[goalId] = Vault({
            balance: 0,
            goalType: _goalType,
            targetValue: _targetValue,
            currency: _currency,
            unlockTimestamp: _unlockTimestamp,
            owner: msg.sender,
            isActive: true,
            description: _description,
            createdAt: block.timestamp,
            isCompleted: false,
            completedAt: 0
        });
        
        userGoals[msg.sender].push(goalId);
        userGoalCount[msg.sender]++;
        
        // Mettre à jour les stats utilisateur
        _updateUserStatsOnGoalCreation(msg.sender);
        
        emit GoalCreated(msg.sender, goalId, _goalType, _targetValue, _currency);
        emit GoalCreatedWithDescription(msg.sender, goalId, _description);
        return goalId;
    }

    // Fonction legacy pour compatibilité
    function createGoalLegacy(
        uint256 _goalAmount,
        uint256 _unlockTimestamp,
        string memory _description
    ) external returns (uint256) {
        require(_goalAmount > 0, "Goal amount must be greater than 0");
        require(_unlockTimestamp > block.timestamp, "Unlock time must be in future");
        
        uint256 goalId = nextGoalId++;
        
        vaults[goalId] = Vault({
            balance: 0,
            goalType: GoalType.ETH_AMOUNT,
            targetValue: _goalAmount,
            currency: Currency.USD,
            unlockTimestamp: _unlockTimestamp,
            owner: msg.sender,
            isActive: true,
            description: _description,
            createdAt: block.timestamp,
            isCompleted: false,
            completedAt: 0
        });
        
        userGoals[msg.sender].push(goalId);
        userGoalCount[msg.sender]++;
        
        // Mettre à jour les stats utilisateur
        _updateUserStatsOnGoalCreation(msg.sender);
        
        emit GoalCreated(msg.sender, goalId, GoalType.ETH_AMOUNT, _goalAmount, Currency.USD);
        emit GoalCreatedWithDescription(msg.sender, goalId, _description);
        return goalId;
    }

    function deposit(address tokenAddress, uint256 goalId) external payable onlyAllowedToken(tokenAddress) {
        require(vaults[goalId].owner == msg.sender, "Not your goal");
        require(vaults[goalId].isActive, "Goal not active");
        
        vaults[goalId].balance += msg.value;
        
        // Mettre à jour les stats utilisateur
        _updateUserStatsOnDeposit(msg.sender, msg.value);
        
        emit DepositToGoal(msg.sender, goalId, msg.value);
        
        if (isGoalReached(goalId)) {
            emit GoalReached(msg.sender, goalId, vaults[goalId].balance);
            // Marquer l'objectif comme complété
            _markGoalAsCompleted(goalId);
        }
    }

    // Fonction de retrait améliorée avec logique adaptée au type d'objectif
    function withdraw(uint256 goalId) external {
        Vault storage userVault = vaults[goalId];
        require(userVault.owner == msg.sender, "Not your goal");
        require(userVault.balance > 0, "Nothing to withdraw");

        // Vérifier les conditions de déblocage selon le type d'objectif
        bool canWithdraw = false;
        bool isGoalReachedFlag = isGoalReached(goalId);
        
        if (userVault.goalType == GoalType.ETH_AMOUNT) {
            // Pour les objectifs ETH_AMOUNT : vérifier le temps ET l'objectif atteint
            canWithdraw = (block.timestamp >= userVault.unlockTimestamp) || isGoalReachedFlag;
            if (!canWithdraw) {
                revert("Goal not reached and unlock time not reached");
            }
        } else {
            // Pour les objectifs ETH_PRICE et PORTFOLIO_VALUE : seulement vérifier si l'objectif est atteint
            canWithdraw = isGoalReachedFlag;
            if (!canWithdraw) {
                revert("Goal condition not met");
            }
        }

        uint256 amount = userVault.balance;
        userVault.balance = 0;
        userVault.isActive = false;
        
        // Marquer comme complété ou échoué selon le cas
        if (isGoalReachedFlag) {
            _markGoalAsCompleted(goalId);
        } else {
            // Si retrait anticipé (pour ETH_AMOUNT après expiration), considérer comme échec
            _markGoalAsFailed(goalId);
        }
        
        // Mettre à jour les stats utilisateur (montant déverrouillé)
        _updateUserStatsOnWithdraw(msg.sender, amount);
        
        payable(msg.sender).transfer(amount);
        emit WithdrawFromGoal(msg.sender, goalId, amount);
    }

    // === SYSTÈME DE SCORING ===
    
    /**
     * Initialiser les stats d'un nouvel utilisateur
     */
    function _initializeUserStats(address user) internal {
        if (userStats[user].joinTimestamp == 0) {
            userStats[user].joinTimestamp = block.timestamp;
            userStats[user].lastActivityTimestamp = block.timestamp;
        }
    }
    
    /**
     * Mettre à jour les stats lors de la création d'un objectif
     */
    function _updateUserStatsOnGoalCreation(address user) internal {
        _initializeUserStats(user);
        
        UserStats storage stats = userStats[user];
        stats.goalsCreated++;
        stats.lastActivityTimestamp = block.timestamp;
        
        _recalculateUserScore(user);
    }
    
    /**
     * Mettre à jour les stats lors d'un dépôt
     */
    function _updateUserStatsOnDeposit(address user, uint256 amount) internal {
        UserStats storage stats = userStats[user];
        stats.totalDeposited += amount;
        stats.totalLocked += amount;
        stats.lastActivityTimestamp = block.timestamp;
        
        _recalculateUserScore(user);
    }
    
    /**
     * Mettre à jour les stats lors d'un retrait
     */
    function _updateUserStatsOnWithdraw(address user, uint256 amount) internal {
        UserStats storage stats = userStats[user];
        if (stats.totalLocked >= amount) {
            stats.totalLocked -= amount;
        } else {
            stats.totalLocked = 0;
        }
        stats.lastActivityTimestamp = block.timestamp;
        
        _recalculateUserScore(user);
    }
    
    /**
     * Marquer un objectif comme complété
     */
    function _markGoalAsCompleted(uint256 goalId) internal {
        Vault storage vault = vaults[goalId];
        if (!vault.isCompleted) {
            vault.isCompleted = true;
            vault.completedAt = block.timestamp;
            
            UserStats storage stats = userStats[vault.owner];
            stats.goalsCompleted++;
            
            _recalculateUserScore(vault.owner);
            emit GoalCompleted(vault.owner, goalId);
        }
    }
    
    /**
     * Marquer un objectif comme échoué
     */
    function _markGoalAsFailed(uint256 goalId) internal {
        Vault storage vault = vaults[goalId];
        
        UserStats storage stats = userStats[vault.owner];
        stats.goalsFailed++;
        
        _recalculateUserScore(vault.owner);
        emit GoalFailed(vault.owner, goalId);
    }
    
    /**
     * Recalculer le score d'un utilisateur
     */
    function _recalculateUserScore(address user) internal {
        UserStats storage stats = userStats[user];
        
        // Calcul du score basé sur plusieurs facteurs
        uint256 score = 0;
        
        // 1. Points pour les objectifs créés (5 points par objectif)
        score += stats.goalsCreated * 5;
        
        // 2. Bonus pour les objectifs complétés (20 points par objectif complété)
        score += stats.goalsCompleted * 20;
        
        // 3. Malus pour les objectifs échoués (-10 points par échec)
        if (stats.goalsFailed * 10 < score) {
            score -= stats.goalsFailed * 10;
        } else {
            score = 0;
        }
        
        // 4. Bonus pour le montant total déposé (1 point par 0.01 ETH)
        score += (stats.totalDeposited / 1e16); // 0.01 ETH = 1e16 Wei
        
        // 5. Bonus d'ancienneté (1 point par semaine depuis l'inscription)
        if (stats.joinTimestamp > 0) {
            uint256 weeksSinceJoin = (block.timestamp - stats.joinTimestamp) / (7 days);
            score += weeksSinceJoin;
        }
        
        // 6. Bonus de fidélité pour montant verrouillé (1 point par 0.1 ETH verrouillé)
        score += (stats.totalLocked / 1e17); // 0.1 ETH = 1e17 Wei
        
        // 7. Bonus pour le ratio de réussite
        if (stats.goalsCreated > 0) {
            uint256 successRate = (stats.goalsCompleted * 100) / stats.goalsCreated;
            if (successRate >= 80) score += 50; // Bonus pour 80%+ de réussite
            else if (successRate >= 60) score += 25; // Bonus pour 60%+ de réussite
        }
        
        stats.currentScore = score;
        stats.lastScoreUpdate = block.timestamp;
        
        // Mettre à jour le score dans le token de gouvernance
        if (address(governanceToken) != address(0)) {
            governanceToken.updateUserScore(user, score);
        }
        
        emit UserScoreUpdated(user, score);
    }
    
    /**
     * Réclamer les récompenses mensuelles
     */
    function claimMonthlyRewards() external {
        require(address(governanceToken) != address(0), "Governance token not set");
        require(
            block.timestamp >= lastMonthlyRewardClaim[msg.sender] + REWARD_DISTRIBUTION_INTERVAL,
            "Too early to claim monthly rewards"
        );
        
        // Mettre à jour le score avant de distribuer
        _recalculateUserScore(msg.sender);
        
        uint256 rewardAmount = governanceToken.distributeMonthlyRewards(msg.sender);
        
        if (rewardAmount > 0) {
            lastMonthlyRewardClaim[msg.sender] = block.timestamp;
            userStats[msg.sender].totalRewardsEarned += rewardAmount;
            emit MonthlyRewardsClaimed(msg.sender, rewardAmount);
        }
    }
    
    /**
     * Distribution globale des récompenses (appelée périodiquement)
     */
    function distributeGlobalRewards() external onlyOwner {
        require(
            block.timestamp >= lastGlobalRewardDistribution + REWARD_DISTRIBUTION_INTERVAL,
            "Too early for global distribution"
        );
        
        lastGlobalRewardDistribution = block.timestamp;
        
        if (address(governanceToken) != address(0)) {
            governanceToken.markMonthlyDistribution();
        }
    }

    // Vérifier si le retrait est possible (sans effectuer le retrait)
    function canWithdraw(uint256 goalId) external view returns (bool, string memory) {
        Vault storage vault = vaults[goalId];
        
        if (!vault.isActive) {
            return (false, "Goal not active");
        }
        
        if (vault.balance == 0) {
            return (false, "Nothing to withdraw");
        }
        
        if (vault.goalType == GoalType.ETH_AMOUNT) {
            bool timeReached = block.timestamp >= vault.unlockTimestamp;
            bool goalReached = isGoalReached(goalId);
            
            if (timeReached || goalReached) {
                return (true, goalReached ? "Goal reached!" : "Unlock time reached");
            } else {
                return (false, "Goal not reached and unlock time not reached");
            }
        } else {
            // Pour ETH_PRICE et PORTFOLIO_VALUE
            bool goalReached = isGoalReached(goalId);
            return (goalReached, goalReached ? "Goal condition met!" : "Goal condition not met");
        }
    }

    // === FONCTIONS DE LECTURE POUR LES NOUVEAUX OBJECTIFS ===

    // Obtenir le prix ETH en USD (8 decimals)
    function getEthPriceUsd() public view returns (uint256) {
        (, int256 price,,,) = ethUsdPriceFeed.latestRoundData();
        require(price > 0, "Invalid ETH price");
        return uint256(price);
    }

    // Obtenir le prix EUR/USD (8 decimals)
    function getEurUsdRate() public view returns (uint256) {
        (, int256 price,,,) = eurUsdPriceFeed.latestRoundData();
        require(price > 0, "Invalid EUR/USD rate");
        return uint256(price);
    }

    // Calculer la valeur du portefeuille en fiat
    function getPortfolioValueInFiat(uint256 goalId) public view returns (uint256) {
        Vault storage vault = vaults[goalId];
        require(vault.isActive, "Goal not active");
        
        uint256 ethPriceUsd = getEthPriceUsd(); // Prix ETH en USD (8 decimals)
        uint256 ethBalance = vault.balance; // Balance en Wei (18 decimals)
        
        // Calculer la valeur en USD: (balance * price) / (10^18)
        // Résultat en USD avec 8 decimals
        uint256 valueUsd = (ethBalance * ethPriceUsd) / 1e18;
        
        if (vault.currency == Currency.EUR) {
            uint256 eurUsdRate = getEurUsdRate();
            // Convertir USD vers EUR: valueUsd / eurUsdRate
            return (valueUsd * 1e8) / eurUsdRate; // 8 decimals
        }
        
        return valueUsd; // 8 decimals
    }

    // Vérifier si l'objectif est atteint selon le nouveau système
    function isGoalReached(uint256 goalId) public view returns (bool) {
        Vault storage vault = vaults[goalId];
        require(vault.isActive, "Goal not active");
        
        if (vault.goalType == GoalType.ETH_AMOUNT) {
            // Logique legacy: comparer les balances ETH
            return vault.balance >= vault.targetValue;
        } else if (vault.goalType == GoalType.ETH_PRICE) {
            // Objectif prix ETH: comparer avec le prix actuel
            uint256 currentPrice = getEthPriceUsd();
            if (vault.currency == Currency.EUR) {
                uint256 eurUsdRate = getEurUsdRate();
                currentPrice = (currentPrice * 1e8) / eurUsdRate;
            }
            return currentPrice >= vault.targetValue;
        } else if (vault.goalType == GoalType.PORTFOLIO_VALUE) {
            // Objectif valeur portefeuille: comparer avec la valeur actuelle
            uint256 currentValue = getPortfolioValueInFiat(goalId);
            return currentValue >= vault.targetValue;
        }
        
        return false;
    }

    // Calculer le pourcentage de progression
    function getGoalProgress(uint256 goalId) public view returns (uint256) {
        Vault storage vault = vaults[goalId];
        require(vault.isActive, "Goal not active");
        
        if (vault.goalType == GoalType.ETH_AMOUNT) {
            if (vault.targetValue == 0) return 0;
            uint256 progress = (vault.balance * 100) / vault.targetValue;
            return progress > 100 ? 100 : progress; // Cap à 100%
        } else if (vault.goalType == GoalType.ETH_PRICE) {
            uint256 currentPrice = getEthPriceUsd();
            if (vault.currency == Currency.EUR) {
                uint256 eurUsdRate = getEurUsdRate();
                currentPrice = (currentPrice * 1e8) / eurUsdRate;
            }
            if (vault.targetValue == 0) return 0;
            uint256 progress = (currentPrice * 100) / vault.targetValue;
            return progress > 100 ? 100 : progress; // Cap à 100%
        } else if (vault.goalType == GoalType.PORTFOLIO_VALUE) {
            uint256 currentValue = getPortfolioValueInFiat(goalId);
            if (vault.targetValue == 0) return 0;
            uint256 progress = (currentValue * 100) / vault.targetValue;
            return progress > 100 ? 100 : progress; // Cap à 100%
        }
        
        return 0;
    }

    // === FONCTIONS DCA ===

    function setupDCA(
        uint256 goalId, 
        uint256 _amount, 
        uint256 _interval, 
        uint256 _maxIterations
    ) external onlyGoalOwner(goalId) {
        require(_amount > 0, "Amount must be greater than 0");
        require(_interval > 0, "Interval must be greater than 0");
        
        dcaConfigs[goalId] = DCAConfig({
            amount: _amount,
            interval: _interval,
            maxIterations: _maxIterations,
            iterationCount: 0,
            lastTimestamp: block.timestamp
        });
        
        emit DCASetup(msg.sender, goalId, _amount, _interval);
    }

    function triggerDCA(uint256 goalId) external onlyGoalOwner(goalId) {
        DCAConfig storage dca = dcaConfigs[goalId];
        require(block.timestamp >= dca.lastTimestamp + dca.interval, "Too early");
        require(dca.iterationCount < dca.maxIterations, "Max iterations reached");
        
        // Execute DCA logic here (would interact with DEX/swap)
        dca.lastTimestamp = block.timestamp;
        dca.iterationCount++;
        
        emit DCATriggered(msg.sender, goalId, dca.amount, dca.iterationCount);
    }

    // === FONCTIONS DE PRIX ===

    function setTargetPrice(uint256 goalId, uint256 _price) external onlyGoalOwner(goalId) {
        require(_price > 0, "Price must be greater than 0");
        priceConfigs[goalId].targetPrice = _price;
        emit TargetPriceSet(msg.sender, goalId, _price);
    }

    function setStopBuyPrice(uint256 goalId, uint256 _price) external onlyGoalOwner(goalId) {
        require(_price > 0, "Price must be greater than 0");
        priceConfigs[goalId].stopBuyPrice = _price;
        emit StopBuySet(msg.sender, goalId, _price);
    }

    function setTargetToken(uint256 goalId, address _token) external onlyGoalOwner(goalId) {
        require(allowedTokens[_token], "Token not allowed");
        priceConfigs[goalId].targetToken = _token;
    }

    function triggerSale(uint256 goalId) external onlyGoalOwner(goalId) {
        Vault storage userVault = vaults[goalId];
        require(userVault.balance > 0, "Nothing to sell");
        
        // Execute sale logic here (would interact with DEX/swap)
        emit SaleTriggered(msg.sender, goalId, userVault.balance);
    }

    // === FONCTIONS DE GESTION ===

    function setUnlockTimestamp(uint256 goalId, uint256 _timestamp) external onlyGoalOwner(goalId) {
        require(_timestamp > block.timestamp, "Timestamp must be in future");
        vaults[goalId].unlockTimestamp = _timestamp;
        emit UnlockTimestampSet(msg.sender, goalId, _timestamp);
    }

    function withdrawEarly(uint256 goalId, uint256 _amount) external onlyGoalOwner(goalId) {
        Vault storage userVault = vaults[goalId];
        require(_amount <= userVault.balance, "Insufficient balance");
        require(_amount > 0, "Amount must be greater than 0");
        
        // Calculer la pénalité (10% de pénalité)
        uint256 penaltyRate = 10;
        uint256 fee = _amount * penaltyRate / 100;
        uint256 amountAfterFee = _amount - fee;
        
        userVault.balance -= _amount;
        payable(msg.sender).transfer(amountAfterFee);
        
        emit EarlyWithdrawal(msg.sender, goalId, _amount, fee);
    }

    function deactivateGoal(uint256 goalId) external onlyGoalOwner(goalId) {
        require(vaults[goalId].balance == 0, "Must withdraw all funds first");
        vaults[goalId].isActive = false;
    }

    // === FONCTIONS DE LECTURE OPTIMISÉES ===

    function getUserGoals(address user) external view returns (uint256[] memory) {
        return userGoals[user];
    }

    // Détails de base d'un objectif
    function getGoalBasics(uint256 goalId) external view returns (
        uint256 balance,
        GoalType goalType,
        uint256 targetValue,
        Currency currency,
        uint256 unlockTimestamp,
        address owner,
        bool isActive
    ) {
        Vault storage vault = vaults[goalId];
        return (
            vault.balance,
            vault.goalType,
            vault.targetValue,
            vault.currency,
            vault.unlockTimestamp,
            vault.owner,
            vault.isActive
        );
    }

    // Description d'un objectif (fonction séparée pour éviter stack too deep)
    function getGoalDescription(uint256 goalId) external view returns (string memory) {
        return vaults[goalId].description;
    }

    // Configuration DCA d'un objectif
    function getDCAConfig(uint256 goalId) external view returns (
        uint256 amount,
        uint256 interval,
        uint256 maxIterations,
        uint256 iterationCount,
        uint256 lastTimestamp
    ) {
        DCAConfig storage dca = dcaConfigs[goalId];
        return (
            dca.amount,
            dca.interval,
            dca.maxIterations,
            dca.iterationCount,
            dca.lastTimestamp
        );
    }

    // Configuration de prix d'un objectif
    function getPriceConfig(uint256 goalId) external view returns (
        uint256 targetPrice,
        uint256 stopBuyPrice,
        address targetToken
    ) {
        PriceConfig storage price = priceConfigs[goalId];
        return (
            price.targetPrice,
            price.stopBuyPrice,
            price.targetToken
        );
    }

    // Fonctions utilitaires simples
    function getBalance(uint256 goalId) external view returns (uint256) {
        return vaults[goalId].balance;
    }

    function getGoalAmount(uint256 goalId) external view returns (uint256) {
        return vaults[goalId].targetValue;
    }

    function getGoalOwner(uint256 goalId) external view returns (address) {
        return vaults[goalId].owner;
    }

    function isGoalActive(uint256 goalId) external view returns (bool) {
        return vaults[goalId].isActive;
    }

    // === FONCTIONS DE COMPATIBILITÉ ===

    function getBalance(address _user) external view returns (uint256) {
        uint256[] memory goals = userGoals[_user];
        if (goals.length > 0) {
            for (uint256 i = 0; i < goals.length; i++) {
                if (vaults[goals[i]].isActive) {
                    return vaults[goals[i]].balance;
                }
            }
        }
        return 0;
    }

    function isGoalReached(address _user) external view returns (bool) {
        uint256[] memory goals = userGoals[_user];
        for (uint256 i = 0; i < goals.length; i++) {
            if (vaults[goals[i]].isActive && isGoalReached(goals[i])) {
                return true;
            }
        }
        return false;
    }

    // === FONCTIONS SYSTÈME ===

    function addLoyaltyReward(address _user, uint256 _reward) external {
        loyaltyRewards[_user] += _reward;
        emit LoyaltyRewardAdded(_user, _reward);
    }

    function getTokenPrice(address token) public view returns (uint256) {
        require(allowedTokens[token], "Token not allowed");

        AggregatorV3Interface feed = priceFeeds[token];
        (, int256 price,,,) = feed.latestRoundData();
        require(price > 0, "Invalid price");
        return uint256(price);
    }

    function isAllowedToken(address token) public view returns (bool) {
        return allowedTokens[token];
    }

    // === FONCTIONS DU SYSTÈME DE GOUVERNANCE ===

    /**
     * Définir l'adresse du token de gouvernance
     */
    function setGovernanceToken(address _governanceToken) external onlyOwner {
        governanceToken = IPiggyGovernanceToken(_governanceToken);
    }

    /**
     * Obtenir les statistiques d'un utilisateur
     */
    function getUserStats(address user) external view returns (
        uint256 goalsCreated,
        uint256 goalsCompleted,
        uint256 goalsFailed,
        uint256 totalDeposited,
        uint256 totalLocked,
        uint256 joinTimestamp,
        uint256 lastActivityTimestamp,
        uint256 currentScore,
        uint256 totalRewardsEarned
    ) {
        UserStats storage stats = userStats[user];
        return (
            stats.goalsCreated,
            stats.goalsCompleted,
            stats.goalsFailed,
            stats.totalDeposited,
            stats.totalLocked,
            stats.joinTimestamp,
            stats.lastActivityTimestamp,
            stats.currentScore,
            stats.totalRewardsEarned
        );
    }

    /**
     * Obtenir le score actuel d'un utilisateur
     */
    function getUserScore(address user) external view returns (uint256) {
        return userStats[user].currentScore;
    }

    /**
     * Calculer le ratio de réussite d'un utilisateur
     */
    function getUserSuccessRate(address user) external view returns (uint256) {
        UserStats storage stats = userStats[user];
        if (stats.goalsCreated == 0) return 0;
        return (stats.goalsCompleted * 100) / stats.goalsCreated;
    }

    /**
     * Vérifier si un utilisateur peut réclamer des récompenses mensuelles
     */
    function canClaimMonthlyRewards(address user) external view returns (bool) {
        return block.timestamp >= lastMonthlyRewardClaim[user] + REWARD_DISTRIBUTION_INTERVAL;
    }

    /**
     * Obtenir le temps restant avant la prochaine réclamation de récompenses
     */
    function getTimeUntilNextRewardClaim(address user) external view returns (uint256) {
        uint256 nextClaimTime = lastMonthlyRewardClaim[user] + REWARD_DISTRIBUTION_INTERVAL;
        if (block.timestamp >= nextClaimTime) return 0;
        return nextClaimTime - block.timestamp;
    }

    /**
     * Recalculer manuellement le score d'un utilisateur (fonction publique)
     */
    function recalculateScore(address user) external {
        _recalculateUserScore(user);
    }

    /**
     * Obtenir le détail d'un objectif avec ses informations de completion
     */
    function getGoalDetails(uint256 goalId) external view returns (
        uint256 balance,
        GoalType goalType,
        uint256 targetValue,
        Currency currency,
        uint256 unlockTimestamp,
        address owner,
        bool isActive,
        string memory description,
        uint256 createdAt,
        bool isCompleted,
        uint256 completedAt
    ) {
        Vault storage vault = vaults[goalId];
        return (
            vault.balance,
            vault.goalType,
            vault.targetValue,
            vault.currency,
            vault.unlockTimestamp,
            vault.owner,
            vault.isActive,
            vault.description,
            vault.createdAt,
            vault.isCompleted,
            vault.completedAt
        );
    }

    /**
     * Obtenir la liste des objectifs d'un utilisateur avec leur statut
     */
    function getUserGoalsWithStatus(address user) external view returns (
        uint256[] memory goalIds,
        bool[] memory isActive,
        bool[] memory isCompleted,
        uint256[] memory progress
    ) {
        uint256[] memory goals = userGoals[user];
        uint256 goalCount = goals.length;
        
        goalIds = new uint256[](goalCount);
        isActive = new bool[](goalCount);
        isCompleted = new bool[](goalCount);
        progress = new uint256[](goalCount);
        
        for (uint256 i = 0; i < goalCount; i++) {
            uint256 goalId = goals[i];
            goalIds[i] = goalId;
            isActive[i] = vaults[goalId].isActive;
            isCompleted[i] = vaults[goalId].isCompleted;
            progress[i] = vaults[goalId].isActive ? getGoalProgress(goalId) : 100;
        }
        
        return (goalIds, isActive, isCompleted, progress);
    }

    /**
     * Fonction d'urgence pour marquer manuellement un objectif comme échoué
     */
    function markGoalAsFailed(uint256 goalId) external onlyOwner {
        require(vaults[goalId].isActive, "Goal not active");
        _markGoalAsFailed(goalId);
    }

    /**
     * Fonction d'urgence pour réinitialiser les stats d'un utilisateur
     */
    function resetUserStats(address user) external onlyOwner {
        delete userStats[user];
        lastMonthlyRewardClaim[user] = 0;
    }
}