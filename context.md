# 📌 Contexte : PiggyBank Vault

## 🎯 Objectif du projet

Créer une **application décentralisée (dApp)** appelée **PiggyBank Vault**, qui permet aux utilisateurs d’épargner de manière intelligente sur la blockchain.

- Les utilisateurs déposent régulièrement des crypto-actifs dans un "vault".
- Les retraits sont **bloqués** jusqu’à ce qu’un **objectif** soit atteint : soit un **montant**, soit une **durée (timer)**.
- L’application affiche une **barre de progression** vers l’objectif.
- Le tout est pensé comme une tirelire digitale, éducative et gamifiée pour apprendre à épargner grâce à la blockchain.

---

## 🧱 Stack technique

### 🔐 Backend (déjà développé)
- **Smart contracts** écrits en Solidity
- Développement avec **Foundry**
- Déploiement sur **Sepolia** (testnet Ethereum)

### 💻 Front-end (MVP rapide)
- **React + Vite**
- **Tailwind CSS** pour le style
- **Wagmi** + **RainbowKit** pour la connexion au wallet
- **ethers.js** pour interagir avec les smart contracts

---

## ✍️ Convention de code à respecter

### ✅ Général
- Code **clair, minimal et bien commenté**
- Utiliser **TypeScript** dans le front-end
- Prioriser la **lisibilité** plutôt que la concision extrême

### 💡 Smart contracts
- Variables et fonctions : `camelCase`
- Contrats : `PascalCase`
- Tests bien nommés (`testCannotWithdrawBeforeGoal()`, etc.)

### 🎨 Front-end
- Organisation des composants : `components/`, `hooks/`, `pages/`
- Utilisation systématique de **tailwind** (`p-4`, `rounded`, `text-xl`, etc.)
- Éviter les bibliothèques lourdes inutiles pour le MVP

---

## 👥 Répartition des tâches

- **Ben** : Backend + intégration Web3
- **Idriss** : UI (Hero section, wallet connect, goal progress UI)
- **David** : Pages de dépôt/retrait, logique de progression, affichage des objectifs atteints

---

## 🧠 Consignes pour l’agent IA

- Aider à intégrer ou ajuster les contrats Foundry dans l’interface React
- Optimiser les composants React pour une interface fluide et compréhensible
- Fournir des snippets simples pour interagir avec le contrat (lecture et écriture)
- Toujours penser “MVP d’abord”, puis suggérer des ajouts simples à itérer ensuite

---

## ✨ Objectif final

Un MVP **fonctionnel**, **joli**, et **simple à utiliser**, à montrer pour une démonstration de projet d’étude. L’UX doit être claire, et l’intégration blockchain fluide pour l’utilisateur final.

