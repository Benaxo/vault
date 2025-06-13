# 🚀 Système d'Investissement Bullrun - PiggyBank MVP

## 📋 Vue d'Ensemble

Le système a été transformé d'un simple coffre-fort ETH vers une **plateforme d'investissement crypto orientée bullrun**, permettant aux utilisateurs de définir des objectifs basés sur la valeur du marché plutôt que sur des quantités fixes d'ETH.

## 🎯 Nouveaux Types d'Objectifs

### 1. **Objectif de Prix ETH** (`ETH_PRICE`)

- **Principe** : Sortir quand ETH atteint un prix cible en fiat
- **Exemple** : "Vendre quand ETH atteint 4000$/ETH"
- **Utilisation** : Idéal pour surfer les bullruns et sortir aux ATH
- **Progression** : Calculée en temps réel selon le prix ETH actuel

### 2. **Objectif de Valeur de Portefeuille** (`PORTFOLIO_VALUE`)

- **Principe** : Atteindre une valeur totale cible via dépôts + hausse du prix
- **Exemple** : "Atteindre 10 000$ de valeur totale"
- **Utilisation** : Combiner DCA (dépôts réguliers) et appréciation du cours
- **Progression** : `(balance_ETH × prix_actuel) / valeur_cible × 100`

### 3. **Objectif Quantité ETH** (`ETH_AMOUNT`) - Legacy

- **Principe** : Accumuler une quantité fixe d'ETH
- **Exemple** : "Accumuler 1 ETH"
- **Utilisation** : Maintenu pour compatibilité

## 🔄 Fonctionnement du Système

### Création d'Objectifs

```javascript
// Objectif prix ETH
{
  goalType: 'ETH_PRICE',
  targetValue: 4000,      // 4000$ par ETH
  currency: 'USD',
  description: 'Sortir à 4000$/ETH'
}

// Objectif valeur portefeuille
{
  goalType: 'PORTFOLIO_VALUE',
  targetValue: 10000,     // 10 000$ total
  currency: 'USD',
  description: 'Portefeuille 10k$'
}
```

### Calcul de Progression

#### Pour les Objectifs de Prix ETH :

```
progression = (prix_ETH_actuel / prix_cible) × 100
```

#### Pour les Objectifs de Valeur :

```
valeur_actuelle = balance_ETH × prix_ETH_actuel
progression = (valeur_actuelle / valeur_cible) × 100
```

### Suivi en Temps Réel

- **API Prix** : CoinGecko API pour prix ETH/USD et ETH/EUR
- **Mise à jour** : Toutes les 30 secondes
- **Devises** : Support USD et EUR
- **Historique** : Prix d'achat conservé pour tracking

## 📊 Interface Utilisateur

### Dashboard Principal (`PortfolioOverview`)

- **Prix ETH** : Affichage temps réel avec variation 24h
- **Statistiques** : Balance totale, valeur fiat, objectifs atteints
- **Cartes Objectifs** : Progression visuelle avec badges de statut
- **Alertes** : Notifications quand objectifs atteints (80%, 100%)

### Création d'Objectifs (`GoalTypeSelector`)

- **Sélection Type** : Interface intuitive pour choisir le type
- **Suggestions** : Objectifs prédéfinis populaires
- **Validation** : Vérification des valeurs en temps réel
- **Preview** : Aperçu de la progression avec prix actuel

### Dépôts (`DepositForm`)

- **Valeur Temps Réel** : Conversion automatique ETH → USD/EUR
- **Sélection Objectif** : Obligation de lier chaque dépôt à un objectif
- **Tracking** : Enregistrement de la valeur au moment du dépôt

## 🛠 Architecture Technique

### Smart Contract (`piggyBankVaultCopy.sol`)

```solidity
enum GoalType { ETH_AMOUNT, ETH_PRICE, PORTFOLIO_VALUE }
enum Currency { USD, EUR }

struct Vault {
    uint256 balance;           // Solde ETH en Wei
    GoalType goalType;         // Type d'objectif
    uint256 targetValue;       // Valeur cible (8 decimals pour fiat)
    Currency currency;         // Devise de référence
    uint256 unlockTimestamp;   // Date de déblocage
    address owner;             // Propriétaire
    bool isActive;             // Statut actif
    string description;        // Description
}
```

### Services Frontend

```javascript
// Service Prix (priceService.js)
-getEthPrice() - // Prix ETH actuel
  calculatePriceGoalProgress() - // Progression objectif prix
  calculatePortfolioGoalProgress() - // Progression objectif valeur
  formatPrice() - // Formatage des prix
  // Service Utilisateur (userService.js)
  createGoal() - // Création objectif avec nouveaux champs
  getUserGoals() - // Récupération objectifs utilisateur
  recordDepositTransaction(); // Enregistrement avec valeur fiat
```

### Base de Données (Firebase)

```javascript
// Collection: goals
{
  goalType: 'ETH_PRICE' | 'PORTFOLIO_VALUE' | 'ETH_AMOUNT',
  targetValue: number,              // Valeur cible
  currency: 'USD' | 'EUR',         // Devise
  currentBalance: string,           // Balance ETH actuelle
  metadata: {
    priceAtCreation: number,        // Prix ETH à la création
    createdWithNewSystem: boolean   // Flag nouveau système
  }
}

// Collection: transactions
{
  amount: string,                   // Montant ETH
  valueUsd: number,                // Valeur USD au moment
  valueEur: number,                // Valeur EUR au moment
  ethPriceAtTime: object,          // Prix ETH au moment
}
```

## 🎨 Expérience Utilisateur

### Notifications et Alertes

- **🔥 Objectif Atteint** : 100% de progression
- **⚡ Proche du But** : 80%+ de progression
- **📈 En Bonne Voie** : 50%+ de progression
- **🚀 En Cours** : < 50% de progression

### Suggestions Prédéfinies

#### Objectifs Prix ETH :

- "Sortir à 3000$/ETH" (ATH modéré)
- "Sortir à 4000$/ETH" (Nouveau ATH)
- "Sortir à 5000$/ETH" (Objectif bullrun)
- "Sortir à 10000$/ETH" (Objectif long terme)

#### Objectifs Valeur Portefeuille :

- "Portefeuille 1000$" (Premier objectif)
- "Portefeuille 5000$" (Objectif intermédiaire)
- "Portefeuille 10000$" (Objectif ambitieux)
- "Portefeuille 25000$" (Objectif long terme)

## 🔮 Stratégies d'Investissement Supportées

### 1. **DCA + Exit Strategy**

- Dépôts réguliers via objectif valeur portefeuille
- Sortie automatique via objectif prix ETH
- Exemple : DCA jusqu'à 10k$, sortir à 5000$/ETH

### 2. **Bull Run Surfing**

- Objectifs de prix multiples (3k$, 4k$, 5k$/ETH)
- Sorties échelonnées selon volatilité
- Maximise les gains durant les cycles bullish

### 3. **Portfolio Growth**

- Focus sur la valeur totale du portefeuille
- Combine appréciation + accumulation
- Idéal pour investisseurs long terme

## 🚀 Avantages du Nouveau Système

1. **Orienté Marché** : Objectifs basés sur la réalité du marché crypto
2. **Flexibilité** : Multiple devises et types d'objectifs
3. **Temps Réel** : Tracking en direct des progressions
4. **Bull Run Ready** : Optimisé pour les cycles crypto
5. **User-Friendly** : Interface intuitive avec suggestions
6. **Data-Driven** : Historique des prix et valeurs conservé

## 📈 Métriques de Succès

- **Engagement** : Fréquence de création d'objectifs
- **Retention** : Utilisation régulière du tracking
- **Performance** : Pourcentage d'objectifs atteints
- **Growth** : Évolution de la valeur totale des portefeuilles

## 🔄 Migration et Compatibilité

- **Objectifs Legacy** : Anciens objectifs ETH maintenus
- **Progressive Enhancement** : Nouvelle interface avec fallbacks
- **Data Migration** : Conversion automatique vers nouveau format
- **API Compatibility** : Endpoints existants préservés

---

_Cette transformation positionne PiggyBank comme une véritable plateforme d'investissement crypto adaptée aux cycles de marché, permettant aux utilisateurs de "surfer les bullruns" efficacement._ 🌊🚀
