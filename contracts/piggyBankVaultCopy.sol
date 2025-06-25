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

    // Structure simplifiée pour le score utilisateur
    struct UserStats {
        uint256 goalsCreated;           // Nombre d'objectifs créés
        uint256 goalsCompleted;         // Nombre d'objectifs complétés
        uint256 totalDeposited;         // Montant total déposé (en Wei)
        uint256 currentScore;           // Score actuel
    }

    // Mappings principaux
    mapping(address => bool) public allowedTokens;
    mapping(address => AggregatorV3Interface) public priceFeeds;
    
    // Mappings pour les objectifs
    mapping(uint256 => Vault) public vaults;  // goalId => Vault
    mapping(address => uint256[]) public userGoals;  // user => goalIds[]
    mapping(address => uint256) public userGoalCount;  // user => nombre d'objectifs

    // Mappings pour le système de scoring simplifié
    mapping(address => UserStats) public userStats;

    // Price feed pour ETH/USD (Oracle Chainlink)
    AggregatorV3Interface public ethUsdPriceFeed;
    // Price feed pour EUR/USD pour conversion
    AggregatorV3Interface public eurUsdPriceFeed;
    
    // Token de gouvernance
    IPiggyGovernanceToken public governanceToken;

    uint256 private nextGoalId = 1;

    // Events essentiels seulement
    event GoalCreated(address indexed user, uint256 indexed goalId, GoalType goalType, uint256 targetValue, Currency currency);
    event DepositToGoal(address indexed user, uint256 indexed goalId, uint256 amount);
    event GoalReached(address indexed user, uint256 indexed goalId, uint256 totalAmount);
    event WithdrawFromGoal(address indexed user, uint256 indexed goalId, uint256 amount);
    event TokenAllowed(address token, address feed);

    constructor(
        address[] memory _tokens,
        address[] memory _priceFeeds,
        address _ethUsdPriceFeed,
        address _eurUsdPriceFeed,
        address _governanceToken,
        address _owner
    ) Ownable(_owner) {
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
        userStats[msg.sender].goalsCreated++;
        
        emit GoalCreated(msg.sender, goalId, _goalType, _targetValue, _currency);
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
        userStats[msg.sender].goalsCreated++;
        
        emit GoalCreated(msg.sender, goalId, GoalType.ETH_AMOUNT, _goalAmount, Currency.USD);
        return goalId;
    }

    function deposit(address tokenAddress, uint256 goalId) external payable onlyAllowedToken(tokenAddress) {
        require(vaults[goalId].owner == msg.sender, "Not your goal");
        require(vaults[goalId].isActive, "Goal not active");
        
        vaults[goalId].balance += msg.value;
        
        // Mettre à jour les stats utilisateur
        userStats[msg.sender].totalDeposited += msg.value;
        
        emit DepositToGoal(msg.sender, goalId, msg.value);
        
        if (isGoalReached(goalId)) {
            emit GoalReached(msg.sender, goalId, vaults[goalId].balance);
            // Marquer l'objectif comme complété
            vaults[goalId].isCompleted = true;
            vaults[goalId].completedAt = block.timestamp;
            userStats[msg.sender].goalsCompleted++;
        }
    }

    // Fonction de retrait simplifiée
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
        
        // Marquer comme complété si l'objectif était atteint
        if (isGoalReachedFlag && !userVault.isCompleted) {
            userVault.isCompleted = true;
            userVault.completedAt = block.timestamp;
            userStats[msg.sender].goalsCompleted++;
        }
        
        payable(msg.sender).transfer(amount);
        emit WithdrawFromGoal(msg.sender, goalId, amount);
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

    // === FONCTIONS DE LECTURE ===

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

    // === FONCTIONS DE GESTION ===

    function setUnlockTimestamp(uint256 goalId, uint256 _timestamp) external onlyGoalOwner(goalId) {
        require(_timestamp > block.timestamp, "Timestamp must be in future");
        vaults[goalId].unlockTimestamp = _timestamp;
    }

    function deactivateGoal(uint256 goalId) external onlyGoalOwner(goalId) {
        require(vaults[goalId].balance == 0, "Must withdraw all funds first");
        vaults[goalId].isActive = false;
    }

    // === FONCTIONS DE LECTURE OPTIMISÉES ===

    function getUserGoals(address user) external view returns (uint256[] memory) {
        return userGoals[user];
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
        uint256 totalDeposited,
        uint256 currentScore
    ) {
        UserStats storage stats = userStats[user];
        return (
            stats.goalsCreated,
            stats.goalsCompleted,
            stats.totalDeposited,
            stats.currentScore
        );
    }

    /**
     * Obtenir le score actuel d'un utilisateur
     */
    function getUserScore(address user) external view returns (uint256) {
        return userStats[user].currentScore;
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
}