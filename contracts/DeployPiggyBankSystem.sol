// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

// Nous devrons importer nos contrats depuis les bons chemins
// Pour l'instant, on utilise des interfaces car les chemins peuvent varier
interface IPiggyBankVault {
    function setGovernanceToken(address _governanceToken) external;
    function owner() external view returns (address);
}

interface IPiggyGovernanceToken {
    function setPiggyBankVault(address newVault) external;
    function owner() external view returns (address);
}

contract DeployPiggyBankSystem is Script {
    
    // Addresses des contrats déployés
    address public piggyBankVault;
    address public piggyGovernanceToken;
    
    // Configuration des tokens et price feeds
    address[] tokens;
    address[] priceFeeds;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=== Déploiement du système PiggyBank ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        
        // Étape 1: Configuration des tokens et price feeds
        setupTokensAndFeeds();
        
        // Étape 2: Déploiement du PiggyBankVault (sans token de gouvernance)
        deployPiggyBankVault();
        
        // Étape 3: Déploiement du PiggyGovernanceToken
        deployPiggyGovernanceToken();
        
        // Étape 4: Configuration des références croisées
        configureContracts();
        
        // Étape 5: Vérifications finales
        verifyDeployment();
        
        vm.stopBroadcast();
        
        console.log("=== Déploiement terminé ===");
        console.log("PiggyBankVault:", piggyBankVault);
        console.log("PiggyGovernanceToken:", piggyGovernanceToken);
    }
    
    function setupTokensAndFeeds() internal {
        console.log("Configuration des tokens et price feeds...");
        
        // Price Feeds sur Sepolia (Chainlink)
        address ethUsdFeed = 0x694AA1769357215DE4FAC081bf1f309aDC325306; // ETH/USD
        address linkUsdFeed = 0xc59E3633BAAC79493d908e63626716e204A45EdF; // LINK/USD
        address daiUsdFeed = 0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06; // DAI/USD
        address eurUsdFeed = 0xb49f677943BC038e9857d61E7d053CaA2C1734C1; // EUR/USD
        
        // Adresses des tokens sur Sepolia
        address wethToken = 0xdd13E55209Fd76AfE204dBda4007C227904f0a81; // WETH
        address linkToken = 0x779877A7B0D9E8603169DdbD7836e478b4624789; // LINK
        address daiToken = 0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06;  // DAI
        address ethToken = 0x0000000000000000000000000000000000000000;  // ETH natif
        
        // Configuration des paires token/price feed
        tokens.push(wethToken);
        priceFeeds.push(ethUsdFeed);
        
        tokens.push(linkToken);
        priceFeeds.push(linkUsdFeed);
        
        tokens.push(daiToken);
        priceFeeds.push(daiUsdFeed);
        
        tokens.push(ethToken);
        priceFeeds.push(eurUsdFeed);
        
        console.log("Tokens configurés:", tokens.length);
    }
    
    function deployPiggyBankVault() internal {
        console.log("Déploiement de PiggyBankVault...");
        
        address ethUsdFeed = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
        address eurUsdFeed = 0xb49f677943BC038e9857d61E7d053CaA2C1734C1;
        
        // Déployer le contrat avec address(0) pour le token de gouvernance
        bytes memory bytecode = abi.encodePacked(
            vm.getCode("PiggyBankVault.sol"),
            abi.encode(tokens, priceFeeds, ethUsdFeed, eurUsdFeed, address(0))
        );
        
        assembly {
            piggyBankVault := create2(0, add(bytecode, 0x20), mload(bytecode), salt())
        }
        
        require(piggyBankVault != address(0), "Échec du déploiement PiggyBankVault");
        console.log("PiggyBankVault déployé à:", piggyBankVault);
    }
    
    function deployPiggyGovernanceToken() internal {
        console.log("Déploiement de PiggyGovernanceToken...");
        
        // Paramètres du token
        string memory name = "PiggyGovernanceToken";
        string memory symbol = "PGT";
        uint256 initialSupply = 1000000 * 10**18; // 1 million de tokens
        
        // Déployer le token avec l'adresse du vault
        bytes memory bytecode = abi.encodePacked(
            vm.getCode("PiggyGovernanceToken.sol"),
            abi.encode(name, symbol, initialSupply, piggyBankVault)
        );
        
        assembly {
            piggyGovernanceToken := create2(0, add(bytecode, 0x20), mload(bytecode), salt())
        }
        
        require(piggyGovernanceToken != address(0), "Échec du déploiement PiggyGovernanceToken");
        console.log("PiggyGovernanceToken déployé à:", piggyGovernanceToken);
    }
    
    function configureContracts() internal {
        console.log("Configuration des références croisées...");
        
        // Configurer l'adresse du token de gouvernance dans le vault
        IPiggyBankVault(piggyBankVault).setGovernanceToken(piggyGovernanceToken);
        console.log("Token de gouvernance configuré dans le vault");
        
        // Optionnel: Si le token a besoin de mettre à jour l'adresse du vault
        // (au cas où elle serait différente de celle passée au constructeur)
        // IPiggyGovernanceToken(piggyGovernanceToken).setPiggyBankVault(piggyBankVault);
    }
    
    function verifyDeployment() internal view {
        console.log("Vérification du déploiement...");
        
        // Vérifier que les contrats sont déployés
        require(piggyBankVault.code.length > 0, "PiggyBankVault non déployé");
        require(piggyGovernanceToken.code.length > 0, "PiggyGovernanceToken non déployé");
        
        // Vérifier les propriétaires
        address vaultOwner = IPiggyBankVault(piggyBankVault).owner();
        address tokenOwner = IPiggyGovernanceToken(piggyGovernanceToken).owner();
        
        console.log("Propriétaire du vault:", vaultOwner);
        console.log("Propriétaire du token:", tokenOwner);
        
        require(vaultOwner == msg.sender, "Propriétaire du vault incorrect");
        require(tokenOwner == msg.sender, "Propriétaire du token incorrect");
        
        console.log("Vérifications réussies!");
    }
    
    function salt() internal pure returns (bytes32) {
        return keccak256("PiggyBank_v1.0.0");
    }
}

// Script alternatif plus simple si les imports fonctionnent
contract DeployPiggyBankSystemSimple is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=== Déploiement simplifié du système PiggyBank ===");
        
        // Configuration des tokens et price feeds
        address[] memory tokens = new address[](4);
        address[] memory priceFeeds = new address[](4);
        
        // Configuration Sepolia
        tokens[0] = 0xdd13E55209Fd76AfE204dBda4007C227904f0a81; // WETH
        priceFeeds[0] = 0x694AA1769357215DE4FAC081bf1f309aDC325306; // ETH/USD
        
        tokens[1] = 0x779877A7B0D9E8603169DdbD7836e478b4624789; // LINK
        priceFeeds[1] = 0xc59E3633BAAC79493d908e63626716e204A45EdF; // LINK/USD
        
        tokens[2] = 0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06; // DAI
        priceFeeds[2] = 0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06; // DAI/USD
        
        tokens[3] = 0x0000000000000000000000000000000000000000; // ETH
        priceFeeds[3] = 0xb49f677943BC038e9857d61E7d053CaA2C1734C1; // EUR/USD
        
        address ethUsdFeed = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
        address eurUsdFeed = 0xb49f677943BC038e9857d61E7d053CaA2C1734C1;
        
        // Déploiement du vault (sans token de gouvernance)
        console.log("Déploiement du PiggyBankVault...");
        // Note: Utiliser new PiggyBankVault() quand les imports seront résolus
        
        // Déploiement du token de gouvernance
        console.log("Déploiement du PiggyGovernanceToken...");
        // Note: Utiliser new PiggyGovernanceToken() quand les imports seront résolus
        
        // Configuration des références croisées
        console.log("Configuration terminée");
        
        vm.stopBroadcast();
    }
} 