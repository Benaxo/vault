// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

// Interfaces pour éviter les problèmes d'import
interface IPiggyBankVault {
    function setGovernanceToken(address _governanceToken) external;
    function owner() external view returns (address);
    function transferOwnership(address newOwner) external;
}

interface IPiggyGovernanceToken {
    function balanceOf(address account) external view returns (uint256);
    function owner() external view returns (address);
}

contract DeployPiggyBankVault is Script {

    error ConctractNotDeployed(string contractName);
    error InvalidOwner(string contractName);
    
    address[] tokens;
    address[] priceFeeds;

    address public piggyBankVault;
    address public piggyGovernanceToken;

    function run() external {
        // Récupère la clé privée définie dans .env pour simuler une action réelle
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        console.log(unicode"=== Déploiement du système PiggyBank complet ===");
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
        
        console.log(unicode"=== Déploiement terminé avec succès ===");
        console.log("PiggyBankVault:", piggyBankVault);
        console.log("PiggyGovernanceToken:", piggyGovernanceToken);
    }
    
    function deployVault() internal {
        //console.log("Déploiement du PiggyBankVault...");
        
        // Paramètres pour le constructeur modifié
        address ethUsdFeed = 0x694AA1769357215DE4FAC081bf1f309aDC325306; // ETH/USD
        address eurUsdFeed = 0xb49f677943BC038e9857d61E7d053CaA2C1734C1; // EUR/USD
        
        // Obtenir l'adresse du deployer à partir de la clé privée
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Déployer avec l'adresse du deployer comme propriétaire
        piggyBankVault = deployContract(
            "piggyBankVault.sol:PiggyBankVault",
            abi.encode(tokens, priceFeeds, ethUsdFeed, eurUsdFeed, address(0), deployer)
        );
        
        console.log(unicode"PiggyBankVault déployé à:", piggyBankVault);
    }
    
    function deployGovernanceToken() internal {
        console.log(unicode"Déploiement du PiggyGovernanceToken...");
        
        // Paramètres du token de gouvernance
        string memory name = "PiggyGovernanceToken";
        string memory symbol = "PGT";
        uint256 initialSupply = 1000000 * 10**18; // 1 million de tokens
        
        // Déployer le token avec l'adresse du vault
        piggyGovernanceToken = deployContract(
            "PiggyGovernanceToken.sol:PiggyGovernanceToken",
            abi.encode(name, symbol, initialSupply, piggyBankVault)
        );
        
        console.log(unicode"PiggyGovernanceToken déployé à:", piggyGovernanceToken);
    }
    
    function configureContracts() internal {
        //console.log("Configuration des références croisées...");
        
        // Vérifier qui est le propriétaire du vault
        address vaultOwner = IPiggyBankVault(piggyBankVault).owner();
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        console.log(unicode"Propriétaire actuel du vault:", vaultOwner);
        console.log(unicode"Adresse du deployer:", deployer);
        
        // Configurer l'adresse du token de gouvernance dans le vault
        IPiggyBankVault(piggyBankVault).setGovernanceToken(piggyGovernanceToken);
        //console.log("Token de gouvernance configuré dans le vault");
    }
    
    function verifyDeployment() internal view {
        //console.log("Vérification du déploiement...");
        
        // Vérifier que les contrats sont déployés
        if (piggyBankVault.code.length == 0) revert ConctractNotDeployed("PiggyBankVault");
        if (piggyGovernanceToken.code.length == 0) revert ConctractNotDeployed("PiggyGovernanceToken");
        
        // Obtenir l'adresse du deployer
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Vérifier les propriétaires
        address vaultOwner = IPiggyBankVault(piggyBankVault).owner();
        address tokenOwner = IPiggyGovernanceToken(piggyGovernanceToken).owner();
        
        if (vaultOwner != deployer) revert InvalidOwner("PiggyBankVault");
        if (tokenOwner != deployer) revert InvalidOwner("PiggyGovernanceToken");
        
        // Vérifier l'approvisionnement initial en tokens
        uint256 deployerBalance = IPiggyGovernanceToken(piggyGovernanceToken).balanceOf(deployer);
        console.log(unicode"Balance PGT du deployer:", deployerBalance / 10**18, "tokens");
        
        //console.log("Vérifications réussies!");
    }
    
    function deployContract(string memory contractName, bytes memory constructorArgs) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(vm.getCode(contractName), constructorArgs);
        address deployedContract;
        
        // Utiliser create au lieu de create2 pour éviter les problèmes de msg.sender
        assembly {
            deployedContract := create(0, add(bytecode, 0x20), mload(bytecode))
        }
        
        if (deployedContract == address(0)) revert ConctractNotDeployed(contractName);
        return deployedContract;
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
