// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

// Interfaces pour éviter les problèmes d'import
interface IPiggyBankVault {
    function setGovernanceToken(address _governanceToken) external;
    function owner() external view returns (address);
}

interface IPiggyGovernanceToken {
    function balanceOf(address account) external view returns (uint256);
    function owner() external view returns (address);
}

contract DeployPiggyBankVault is Script {
    address[] tokens;
    address[] priceFeeds;

    address public piggyBankVault;
    address public piggyGovernanceToken;

    function run() external {
        // Récupère la clé privée définie dans .env pour simuler une action réelle
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Déploiement du système PiggyBank complet ===");
        console.log("Deployer address:", vm.addr(deployerPrivateKey));

        // Étape 1: Configuration des tokens et price feeds
        testnetDeploy();

        // Étape 2: Déploiement du PiggyBankVault (sans token de gouvernance)
        deployVault();
        
        // Étape 3: Déploiement du PiggyGovernanceToken
        deployGovernanceToken();
        
        // Étape 4: Configuration des références croisées
        configureContracts();
        
        // Étape 5: Vérifications
        verifyDeployment();

        vm.stopBroadcast();
        
        console.log("=== Déploiement terminé avec succès ===");
        console.log("PiggyBankVault:", piggyBankVault);
        console.log("PiggyGovernanceToken:", piggyGovernanceToken);
    }
    
    function deployVault() internal {
        console.log("Déploiement du PiggyBankVault...");
        
        // Paramètres pour le constructeur modifié
        address ethUsdFeed = 0x694AA1769357215DE4FAC081bf1f309aDC325306; // ETH/USD
        address eurUsdFeed = 0xb49f677943BC038e9857d61E7d053CaA2C1734C1; // EUR/USD
        
        // Déployer avec address(0) pour le token de gouvernance (sera configuré après)
        piggyBankVault = deployContract(
            "piggyBankVaultCopy.sol:PiggyBankVault",
            abi.encode(tokens, priceFeeds, ethUsdFeed, eurUsdFeed, address(0))
        );
        
        console.log("PiggyBankVault déployé à:", piggyBankVault);
    }
    
    function deployGovernanceToken() internal {
        console.log("Déploiement du PiggyGovernanceToken...");
        
        // Paramètres du token de gouvernance
        string memory name = "PiggyGovernanceToken";
        string memory symbol = "PGT";
        uint256 initialSupply = 1000000 * 10**18; // 1 million de tokens
        
        // Déployer le token avec l'adresse du vault
        piggyGovernanceToken = deployContract(
            "PiggyGovernanceToken.sol:PiggyGovernanceToken",
            abi.encode(name, symbol, initialSupply, piggyBankVault)
        );
        
        console.log("PiggyGovernanceToken déployé à:", piggyGovernanceToken);
    }
    
    function configureContracts() internal {
        console.log("Configuration des références croisées...");
        
        // Configurer l'adresse du token de gouvernance dans le vault
        IPiggyBankVault(piggyBankVault).setGovernanceToken(piggyGovernanceToken);
        console.log("✓ Token de gouvernance configuré dans le vault");
    }
    
    function verifyDeployment() internal view {
        console.log("Vérification du déploiement...");
        
        // Vérifier que les contrats sont déployés
        require(piggyBankVault.code.length > 0, "PiggyBankVault non déployé");
        require(piggyGovernanceToken.code.length > 0, "PiggyGovernanceToken non déployé");
        
        // Vérifier les propriétaires
        address vaultOwner = IPiggyBankVault(piggyBankVault).owner();
        address tokenOwner = IPiggyGovernanceToken(piggyGovernanceToken).owner();
        
        require(vaultOwner == msg.sender, "Propriétaire du vault incorrect");
        require(tokenOwner == msg.sender, "Propriétaire du token incorrect");
        
        // Vérifier l'approvisionnement initial en tokens
        uint256 deployerBalance = IPiggyGovernanceToken(piggyGovernanceToken).balanceOf(msg.sender);
        console.log("Balance PGT du deployer:", deployerBalance / 10**18, "tokens");
        
        console.log("✓ Toutes les vérifications sont réussies!");
    }
    
    function deployContract(string memory contractName, bytes memory constructorArgs) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(vm.getCode(contractName), constructorArgs);
        address deployedContract;
        
        assembly {
            deployedContract := create2(0, add(bytecode, 0x20), mload(bytecode), salt())
        }
        
        require(deployedContract != address(0), string.concat("Échec du déploiement: ", contractName));
        return deployedContract;
    }
    
    function salt() internal pure returns (bytes32) {
        return keccak256("PiggyBank_v1.0.0");
    }

    function testnetDeploy() public {
        // Price Feeds sur Sepolia (via Chainlink)
        address wethUsd = 0x694AA1769357215DE4FAC081bf1f309aDC325306; // ETH/USD
        address linkUsd = 0xc59E3633BAAC79493d908e63626716e204A45EdF;
        address daiUsd = 0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06;
        address eurUsd = 0xb49f677943BC038e9857d61E7d053CaA2C1734C1; // EUR/USD

        // Adresses ERC20 réelles sur Sepolia
        address wethToken = 0xdd13E55209Fd76AfE204dBda4007C227904f0a81;
        address linkToken = 0x779877A7B0D9E8603169DdbD7836e478b4624789;
        address daiToken  = address(0xA7A93fd0a276fc1C0197a5B5623eD117786eeD06);
        address ethToken = 0x0000000000000000000000000000000000000000;

        tokens.push(wethToken);
        priceFeeds.push(wethUsd);

        tokens.push(linkToken);
        priceFeeds.push(linkUsd);

        tokens.push(daiToken);
        priceFeeds.push(daiUsd);

        tokens.push(ethToken);
        priceFeeds.push(eurUsd); 
    }
    function mainnetDeploy() public {
        // Laisse vide pour le moment, tu pourras la compléter ensuite
    }
}
