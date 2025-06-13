# Guide de Déploiement PiggyBank System 🚀

## Vue d'ensemble

Ce guide explique comment déployer le système complet PiggyBank incluant :

- **PiggyBankVault** : Contrat principal de gestion des objectifs d'épargne
- **PiggyGovernanceToken** : Token ERC20 avec fonctionnalités de gouvernance et staking

## Résolution de la Dépendance Circulaire

Le système résout la dépendance circulaire en utilisant une approche de déploiement en **4 étapes** :

1. ✅ **Déploiement du Vault** avec `address(0)` pour le token de gouvernance
2. ✅ **Déploiement du Token** avec l'adresse du vault déjà déployé
3. ✅ **Configuration** : Appel de `setGovernanceToken()` sur le vault
4. ✅ **Vérification** : Tests automatiques de l'intégration

## Prérequis

### Variables d'Environnement

Créer un fichier `.env` avec :

```bash
PRIVATE_KEY=your_private_key_here
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_project_id
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Dépendances

```bash
# Installation des dépendances Foundry
forge install OpenZeppelin/openzeppelin-contracts
forge install smartcontractkit/chainlink
```

## Scripts de Déploiement

### Script Principal : `piggyBankVaultDeploymentScript.sol`

Le script mis à jour gère automatiquement le déploiement complet :

```bash
# Déploiement sur Sepolia
forge script contracts/piggyBankVaultDeploymentScript.sol:DeployPiggyBankVault \
    --rpc-url $SEPOLIA_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast \
    --verify \
    --etherscan-api-key $ETHERSCAN_API_KEY
```

### Script Alternatif : `DeployPiggyBankSystem.sol`

Version avec plus de logs et vérifications :

```bash
forge script contracts/DeployPiggyBankSystem.sol:DeployPiggyBankSystem \
    --rpc-url $SEPOLIA_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast
```

## Configuration Réseau

### Sepolia Testnet (Recommandé)

Le script est préconfigué pour Sepolia avec :

**Price Feeds Chainlink :**

- ETH/USD : `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- EUR/USD : `0xb49f677943BC038e9857d61E7d053CaA2C1734C1`
- LINK/USD : `0xc59E3633BAAC79493d908e63626716e204A45EdF`
- DAI/USD : `0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06`

**Tokens Supportés :**

- WETH : `0xdd13E55209Fd76AfE204dBda4007C227904f0a81`
- LINK : `0x779877A7B0D9E8603169DdbD7836e478b4624789`
- DAI : `0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06`
- ETH natif : `0x0000000000000000000000000000000000000000`

### Ethereum Mainnet

Pour le déploiement mainnet, mettre à jour les adresses dans `mainnetDeploy()`.

## Vérification du Déploiement

### Logs de Succès

```
=== Déploiement du système PiggyBank complet ===
Deployer address: 0x...
Configuration des tokens et price feeds...
Tokens configurés: 4
Déploiement du PiggyBankVault...
PiggyBankVault déployé à: 0x...
Déploiement du PiggyGovernanceToken...
PiggyGovernanceToken déployé à: 0x...
Configuration des références croisées...
✓ Token de gouvernance configuré dans le vault
Vérification du déploiement...
Balance PGT du deployer: 1000000 tokens
✓ Toutes les vérifications sont réussies!
=== Déploiement terminé avec succès ===
```

### Tests Post-Déploiement

```bash
# Vérifier les contrats déployés
forge script contracts/VerifyDeployment.sol \
    --rpc-url $SEPOLIA_RPC_URL
```

## Architecture des Contrats

### PiggyBankVault

```solidity
constructor(
    address[] memory tokens,      // Tokens supportés
    address[] memory priceFeeds,  // Price feeds correspondants
    address ethUsdFeed,          // Feed ETH/USD principal
    address eurUsdFeed,          // Feed EUR/USD pour conversion
    address governanceToken      // Token de gouvernance (peut être 0)
)
```

### PiggyGovernanceToken

```solidity
constructor(
    string memory name,           // "PiggyGovernanceToken"
    string memory symbol,         // "PGT"
    uint256 initialSupply,       // 1,000,000 tokens
    address piggyBankVault       // Adresse du vault
)
```

## Gestion des Erreurs

### Erreurs Communes

1. **"PiggyBankVault non déployé"**

   - Vérifier que les price feeds Chainlink sont corrects
   - S'assurer que les tokens existent sur le réseau

2. **"Échec du déploiement PiggyGovernanceToken"**

   - Vérifier que l'adresse du vault est valide
   - Contrôler les paramètres du token (nom, symbole)

3. **"Propriétaire incorrect"**
   - Vérifier que la clé privée correspond au déployeur attendu

### Debug

```bash
# Mode verbose
forge script --debug contracts/piggyBankVaultDeploymentScript.sol

# Simulation uniquement (pas de broadcast)
forge script contracts/piggyBankVaultDeploymentScript.sol \
    --rpc-url $SEPOLIA_RPC_URL
```

## Post-Déploiement

### Actions Recommandées

1. **Vérification sur Etherscan**

   ```bash
   forge verify-contract <contract_address> \
       contracts/piggyBankVaultCopy.sol:PiggyBankVault \
       --etherscan-api-key $ETHERSCAN_API_KEY
   ```

2. **Configuration Initiale**

   - Distribuer des tokens PGT aux early adopters
   - Créer les premières propositions de gouvernance
   - Configurer les paramètres de récompenses

3. **Tests d'Intégration**
   - Créer un objectif test
   - Tester le système de scoring
   - Vérifier les récompenses mensuelles

### Interface Frontend

Mettre à jour les constantes dans votre interface React :

```javascript
export const CONTRACTS = {
  PIGGY_BANK_VAULT: "0x...", // Adresse déployée
  GOVERNANCE_TOKEN: "0x...", // Adresse déployée
  CHAIN_ID: 11155111, // Sepolia
};
```

## Mise à Jour et Migration

### Nouvelles Versions

1. Déployer les nouveaux contrats
2. Migrer les données utilisateur
3. Mettre à jour les références frontend
4. Proposer un vote de gouvernance pour l'adoption

### Sauvegarde

- Sauvegarder les adresses déployées
- Exporter les données utilisateur importantes
- Documenter les changements de version

## Support

### Ressources

- 📖 [Documentation Technique](./GOVERNANCE_SYSTEM.md)
- 🔗 [Chainlink Price Feeds](https://docs.chain.link/data-feeds/price-feeds/addresses)
- 🛠️ [Foundry Documentation](https://book.getfoundry.sh/)

### Contact

Pour les problèmes de déploiement, créer une issue avec :

- Logs complets du déploiement
- Configuration réseau utilisée
- Version des contrats
- Hash de transaction si applicable
