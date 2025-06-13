graph TB
    subgraph "PiggyBank Ecosystem"
        PBV[PiggyBankVault<br/>Smart Contract]
        PGT[PiggyGovernanceToken<br/>ERC20 + Governance]
        
        subgraph "User Journey"
            U1[User Creates Goal]
            U2[User Deposits ETH]
            U3[Goal Completion]
            U4[Score Calculation]
            U5[Monthly Rewards]
        end
        
        subgraph "Scoring System"
            S1[Goals Created: +5 pts]
            S2[Goals Completed: +20 pts]
            S3[Goals Failed: -10 pts]
            S4[ETH Deposited: +1 pt/0.01ETH]
            S5[Platform Age: +1 pt/week]
            S6[Locked Amount: +1 pt/0.1ETH]
            S7[Success Rate Bonus: +25-50 pts]
        end
        
        subgraph "Governance Features"
            G1[Token Staking]
            G2[Proposal Creation]
            G3[Voting System]
            G4[Proposal Execution]
        end
        
        subgraph "Reward System"
            R1[Monthly Base Rewards<br/>Score * 1% tokens]
            R2[Staking Bonus<br/>Staked * 2% / 2]
            R3[Staking APY<br/>5% annual]
        end
    end
    
    U1 --> PBV
    U2 --> PBV
    U3 --> PBV
    PBV --> U4
    U4 --> S1
    U4 --> S2
    U4 --> S3
    U4 --> S4
    U4 --> S5
    U4 --> S6
    U4 --> S7
    
    S1 --> PGT
    S2 --> PGT
    S3 --> PGT
    S4 --> PGT
    S5 --> PGT
    S6 --> PGT
    S7 --> PGT
    
    PGT --> G1
    G1 --> G2
    G2 --> G3
    G3 --> G4
    
    PGT --> R1
    PGT --> R2
    G1 --> R3
    
    PBV -.->|"Updates Score"| PGT
    PGT -.->|"Distributes Rewards"| PBV
    
    style PBV fill:#e1f5fe
    style PGT fill:#f3e5f5
    style U1 fill:#e8f5e8
    style U2 fill:#e8f5e8
    style U3 fill:#e8f5e8
    style U4 fill:#fff3e0
    style U5 fill:#fff3e0