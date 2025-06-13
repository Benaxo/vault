// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PiggyGovernanceToken is ERC20, Ownable, ReentrancyGuard {
    
    // Structure pour le staking
    struct StakingInfo {
        uint256 stakedAmount;      // Montant staké
        uint256 stakingStartTime;  // Début du staking
        uint256 lastClaimTime;     // Dernière réclamation de récompenses
        uint256 stakingRewards;    // Récompenses accumulées
    }
    
    // Structure pour les propositions de vote
    struct Proposal {
        uint256 id;
        string description;
        address proposer;
        uint256 forVotes;          // Votes pour
        uint256 againstVotes;      // Votes contre
        uint256 startTime;
        uint256 endTime;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) votes; // Poids du vote de chaque utilisateur
    }
    
    // Paramètres du staking
    uint256 public constant STAKING_REWARD_RATE = 5; // 5% par an
    uint256 public constant MIN_STAKING_PERIOD = 30 days;
    uint256 public constant PROPOSAL_DURATION = 7 days;
    uint256 public constant MIN_PROPOSAL_STAKE = 1000 * 10**18; // 1000 tokens pour proposer
    
    // Mappings
    mapping(address => StakingInfo) public stakingInfo;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public userScores; // Score de fidélité des utilisateurs
    
    // Variables d'état
    uint256 public totalStaked;
    uint256 public nextProposalId = 1;
    uint256 public lastRewardDistribution;
    address public piggyBankVault; // Contrat principal
    
    // Events
    event TokensStaked(address indexed user, uint256 amount);
    event TokensUnstaked(address indexed user, uint256 amount);
    event StakingRewardsClaimed(address indexed user, uint256 amount);
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event MonthlyRewardsDistributed(address indexed user, uint256 amount);
    event UserScoreUpdated(address indexed user, uint256 newScore);
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address _piggyBankVault
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
        piggyBankVault = _piggyBankVault;
        lastRewardDistribution = block.timestamp;
    }
    
    modifier onlyPiggyBankVault() {
        require(msg.sender == piggyBankVault, "Only PiggyBank vault can call");
        _;
    }
    
    // === FONCTIONS DE STAKING ===
    
    /**
     * Staker des tokens de gouvernance
     */
    function stakeTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Transférer les tokens vers le contrat
        _transfer(msg.sender, address(this), amount);
        
        StakingInfo storage info = stakingInfo[msg.sender];
        
        // Calculer les récompenses accumulées avant de modifier le stake
        if (info.stakedAmount > 0) {
            uint256 rewards = calculateStakingRewards(msg.sender);
            info.stakingRewards += rewards;
        }
        
        // Mettre à jour les informations de staking
        info.stakedAmount += amount;
        info.lastClaimTime = block.timestamp;
        if (info.stakingStartTime == 0) {
            info.stakingStartTime = block.timestamp;
        }
        
        totalStaked += amount;
        
        emit TokensStaked(msg.sender, amount);
    }
    
    /**
     * Unstaker des tokens (avec période de verrouillage)
     */
    function unstakeTokens(uint256 amount) external nonReentrant {
        StakingInfo storage info = stakingInfo[msg.sender];
        require(info.stakedAmount >= amount, "Insufficient staked amount");
        require(
            block.timestamp >= info.stakingStartTime + MIN_STAKING_PERIOD,
            "Minimum staking period not met"
        );
        
        // Calculer et distribuer les récompenses
        uint256 rewards = calculateStakingRewards(msg.sender);
        info.stakingRewards += rewards;
        
        // Mettre à jour le staking
        info.stakedAmount -= amount;
        info.lastClaimTime = block.timestamp;
        totalStaked -= amount;
        
        // Transférer les tokens de retour à l'utilisateur
        _transfer(address(this), msg.sender, amount);
        
        emit TokensUnstaked(msg.sender, amount);
    }
    
    /**
     * Réclamer les récompenses de staking
     */
    function claimStakingRewards() external nonReentrant {
        StakingInfo storage info = stakingInfo[msg.sender];
        require(info.stakedAmount > 0, "No tokens staked");
        
        uint256 rewards = calculateStakingRewards(msg.sender) + info.stakingRewards;
        require(rewards > 0, "No rewards to claim");
        
        info.stakingRewards = 0;
        info.lastClaimTime = block.timestamp;
        
        // Mint les récompenses
        _mint(msg.sender, rewards);
        
        emit StakingRewardsClaimed(msg.sender, rewards);
    }
    
    /**
     * Calculer les récompenses de staking
     */
    function calculateStakingRewards(address user) public view returns (uint256) {
        StakingInfo storage info = stakingInfo[user];
        if (info.stakedAmount == 0) return 0;
        
        uint256 timeStaked = block.timestamp - info.lastClaimTime;
        uint256 annualReward = (info.stakedAmount * STAKING_REWARD_RATE) / 100;
        return (annualReward * timeStaked) / 365 days;
    }
    
    // === SYSTÈME DE GOUVERNANCE ===
    
    /**
     * Créer une proposition de vote
     */
    function createProposal(string memory description) external returns (uint256) {
        require(stakingInfo[msg.sender].stakedAmount >= MIN_PROPOSAL_STAKE, "Insufficient staked tokens to propose");
        require(bytes(description).length > 0, "Description cannot be empty");
        
        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.description = description;
        proposal.proposer = msg.sender;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + PROPOSAL_DURATION;
        
        emit ProposalCreated(proposalId, msg.sender, description);
        return proposalId;
    }
    
    /**
     * Voter sur une proposition
     */
    function vote(uint256 proposalId, bool support) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.startTime > 0, "Proposal does not exist");
        require(block.timestamp >= proposal.startTime, "Voting has not started");
        require(block.timestamp <= proposal.endTime, "Voting has ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(!proposal.executed && !proposal.cancelled, "Proposal is finalized");
        
        // Calculer le poids du vote (staking + score utilisateur)
        uint256 votingWeight = getVotingPower(msg.sender);
        require(votingWeight > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = votingWeight;
        
        if (support) {
            proposal.forVotes += votingWeight;
        } else {
            proposal.againstVotes += votingWeight;
        }
        
        emit VoteCast(proposalId, msg.sender, support, votingWeight);
    }
    
    /**
     * Calculer le pouvoir de vote d'un utilisateur
     */
    function getVotingPower(address user) public view returns (uint256) {
        uint256 stakedTokens = stakingInfo[user].stakedAmount;
        uint256 userScore = userScores[user];
        
        // Poids = tokens stakés + (score utilisateur * facteur)
        // Le score utilisateur a plus d'impact que le staking
        return stakedTokens + (userScore * 10**18); // 1 point de score = 1 token de poids
    }
    
    /**
     * Exécuter une proposition approuvée
     */
    function executeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.startTime > 0, "Proposal does not exist");
        require(block.timestamp > proposal.endTime, "Voting is still active");
        require(!proposal.executed && !proposal.cancelled, "Proposal already finalized");
        require(proposal.forVotes > proposal.againstVotes, "Proposal was rejected");
        
        proposal.executed = true;
        
        // Ici, on pourrait ajouter des actions spécifiques selon le type de proposition
        // Pour l'instant, on se contente de marquer comme exécutée
        
        emit ProposalExecuted(proposalId);
    }
    
    // === SYSTÈME DE SCORE ET RÉCOMPENSES ===
    
    /**
     * Mettre à jour le score d'un utilisateur (appelé par le contrat principal)
     */
    function updateUserScore(address user, uint256 newScore) external onlyPiggyBankVault {
        userScores[user] = newScore;
        emit UserScoreUpdated(user, newScore);
    }
    
    /**
     * Distribuer les récompenses mensuelles basées sur le score
     */
    function distributeMonthlyRewards(address user) external onlyPiggyBankVault returns (uint256) {
        require(block.timestamp >= lastRewardDistribution + 30 days, "Too early for monthly rewards");
        
        uint256 userScore = userScores[user];
        uint256 stakedAmount = stakingInfo[user].stakedAmount;
        
        // Calcul des récompenses : score prioritaire, staking bonus
        uint256 baseReward = (userScore * 10**18) / 100; // 1% du score en tokens
        uint256 stakingBonus = (stakedAmount * 2) / 100; // 2% du montant staké
        
        // Le score a plus d'impact que le staking
        uint256 totalReward = baseReward + (stakingBonus / 2); // Staking bonus réduit de moitié
        
        if (totalReward > 0) {
            _mint(user, totalReward);
            emit MonthlyRewardsDistributed(user, totalReward);
        }
        
        return totalReward;
    }
    
    /**
     * Marquer la distribution mensuelle comme effectuée
     */
    function markMonthlyDistribution() external onlyPiggyBankVault {
        lastRewardDistribution = block.timestamp;
    }
    
    // === FONCTIONS DE LECTURE ===
    
    /**
     * Obtenir les informations de staking d'un utilisateur
     */
    function getStakingInfo(address user) external view returns (
        uint256 stakedAmount,
        uint256 stakingStartTime,
        uint256 pendingRewards,
        uint256 votingPower
    ) {
        StakingInfo storage info = stakingInfo[user];
        return (
            info.stakedAmount,
            info.stakingStartTime,
            calculateStakingRewards(user) + info.stakingRewards,
            getVotingPower(user)
        );
    }
    
    /**
     * Obtenir les détails d'une proposition
     */
    function getProposal(uint256 proposalId) external view returns (
        string memory description,
        address proposer,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 startTime,
        uint256 endTime,
        bool executed,
        bool cancelled
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.description,
            proposal.proposer,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.startTime,
            proposal.endTime,
            proposal.executed,
            proposal.cancelled
        );
    }
    
    /**
     * Vérifier si un utilisateur a voté sur une proposition
     */
    function hasVoted(uint256 proposalId, address user) external view returns (bool) {
        return proposals[proposalId].hasVoted[user];
    }
    
    // === FONCTIONS D'ADMINISTRATION ===
    
    /**
     * Mettre à jour l'adresse du contrat PiggyBank
     */
    function setPiggyBankVault(address newVault) external onlyOwner {
        piggyBankVault = newVault;
    }
    
    /**
     * Mint des tokens d'urgence (pour les récompenses initiales)
     */
    function emergencyMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
} 