# Système de Gouvernance PiggyBank 🏛️

## Vue d'ensemble

Le système de gouvernance de PiggyBank utilise un token ERC20 (`PiggyGovernanceToken`) pour récompenser les utilisateurs fidèles et leur permettre de participer aux décisions importantes de la plateforme.

## Architecture

### 🎯 Système de Score Utilisateur

Le score utilisateur est calculé automatiquement basé sur plusieurs critères :

#### Facteurs de Score

1. **Objectifs créés** : +5 points par objectif
2. **Objectifs complétés** : +20 points par réussite
3. **Objectifs échoués** : -10 points par échec
4. **Montant déposé** : +1 point par 0.01 ETH déposé
5. **Ancienneté** : +1 point par semaine d'inscription
6. **Montant verrouillé** : +1 point par 0.1 ETH actuellement verrouillé
7. **Ratio de réussite** :
   - +50 points si ≥80% de réussite
   - +25 points si ≥60% de réussite

#### Calcul Automatique

- Le score est recalculé à chaque action (création, dépôt, retrait)
- Mise à jour automatique dans le contrat de gouvernance
- Accessible via `getUserScore(address)`

### 🪙 Token de Gouvernance (PGT)

#### Caractéristiques

- **Standard** : ERC20 avec extensions de gouvernance
- **Nom** : PiggyGovernanceToken (PGT)
- **Fonctionnalités** :
  - Staking avec récompenses
  - Système de vote pondéré
  - Distribution automatique de récompenses

#### Staking

- **Période minimum** : 30 jours
- **Récompenses** : 5% APY
- **Réclamation** : Récompenses accumulées en continu
- **Unstaking** : Possible après période minimum

### 🗳️ Système de Vote

#### Création de Propositions

- **Seuil requis** : 1000 PGT stakés
- **Durée** : 7 jours de vote
- **Format** : Description textuelle libre

#### Pouvoir de Vote

Le poids du vote combine :

- **Tokens stakés** : 1 token = 1 vote
- **Score utilisateur** : 1 point de score = 1 vote
- **Formule** : `Poids = Tokens Stakés + Score Utilisateur`

#### Processus

1. Proposition créée par utilisateur avec PGT stakés
2. Vote durant 7 jours (pour/contre)
3. Exécution si majorité de votes "pour"

### 💰 Système de Récompenses

#### Récompenses Mensuelles

**Calcul des récompenses** :

- **Base** : Score utilisateur × 1% en tokens PGT
- **Bonus staking** : Montant staké × 2% ÷ 2
- **Priorité** : Le score utilisateur prime sur le staking

**Distribution** :

- Réclamable tous les 30 jours
- Fonction `claimMonthlyRewards()`
- Tokens mintés automatiquement

#### Exemple de Calcul

```
Utilisateur avec :
- Score : 500 points
- Staking : 1000 PGT

Récompense mensuelle :
- Base : 500 × 1% = 5 PGT
- Bonus : (1000 × 2%) ÷ 2 = 10 PGT
- Total : 15 PGT
```

## Fonctions Principales

### Contrat PiggyBankVault

#### Gestion des Scores

```solidity
function getUserStats(address user) external view returns (...)
function getUserScore(address user) external view returns (uint256)
function getUserSuccessRate(address user) external view returns (uint256)
function recalculateScore(address user) external
```

#### Récompenses

```solidity
function claimMonthlyRewards() external
function canClaimMonthlyRewards(address user) external view returns (bool)
function getTimeUntilNextRewardClaim(address user) external view returns (uint256)
```

#### Administration

```solidity
function setGovernanceToken(address _governanceToken) external onlyOwner
function distributeGlobalRewards() external onlyOwner
```

### Contrat PiggyGovernanceToken

#### Staking

```solidity
function stakeTokens(uint256 amount) external
function unstakeTokens(uint256 amount) external
function claimStakingRewards() external
function calculateStakingRewards(address user) public view returns (uint256)
```

#### Gouvernance

```solidity
function createProposal(string memory description) external returns (uint256)
function vote(uint256 proposalId, bool support) external
function executeProposal(uint256 proposalId) external
function getVotingPower(address user) public view returns (uint256)
```

#### Informations

```solidity
function getStakingInfo(address user) external view returns (...)
function getProposal(uint256 proposalId) external view returns (...)
function hasVoted(uint256 proposalId, address user) external view returns (bool)
```

## Déploiement

### Ordre de Déploiement

1. **PiggyBankVault** avec oracles Chainlink
2. **PiggyGovernanceToken** avec référence au vault
3. **Configuration** : `setGovernanceToken()` dans le vault

### Paramètres Initiaux

```solidity
// PiggyGovernanceToken
constructor(
    "PiggyGovernanceToken",
    "PGT",
    1000000 * 10**18, // 1M tokens initial
    address(piggyBankVault)
)
```

## Sécurité

### Mécanismes de Protection

- **ReentrancyGuard** sur toutes les fonctions de staking/unstaking
- **Période de verrouillage** minimum pour le staking
- **Validation des propositions** (seuil minimum)
- **Contrôles d'accès** avec Ownable

### Bonnes Pratiques

- Score recalculé automatiquement (pas de manipulation manuelle)
- Distribution de récompenses contrôlée
- Fonctions d'urgence pour l'administration

## Évolutions Futures

### Fonctionnalités Potentielles

- **Types de propositions** : Modifications de paramètres, nouvelles fonctionnalités
- **Délégation de vote** : Permettre la délégation du pouvoir de vote
- **Verrouillage progressif** : Bonus de staking selon la durée
- **NFT de fidélité** : Récompenses visuelles pour les top utilisateurs

### Intégrations

- **Interface Web3** : Intégration dans l'interface React
- **Notifications** : Alertes pour votes et récompenses
- **Dashboard** : Interface de gouvernance dédiée
- **Analytics** : Métriques de participation et engagement

## Migration et Mise à Jour

### Stratégie de Mise à Jour

- Déploiement de nouveaux contrats si nécessaire
- Migration des scores utilisateur
- Conservation de l'historique des votes
- Transition graduelle pour les utilisateurs

Cette architecture garantit une gouvernance décentralisée tout en récompensant la fidélité et l'engagement des utilisateurs de la plateforme PiggyBank.
