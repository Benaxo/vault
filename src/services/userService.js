import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase/config";

// Collections names
const USERS_COLLECTION = "users";
const GOALS_COLLECTION = "goals";
const TRANSACTIONS_COLLECTION = "transactions";
const USER_STATS_COLLECTION = "userStats";
const WALLET_LINKS_COLLECTION = "walletLinks";

/**
 * User Profile Management
 */

// Create or update user profile
export const createUserProfile = async (user, walletAddress = null) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, user.uid);

    const userData = {
      email: user.email,
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      linkedWallets: walletAddress ? [walletAddress.toLowerCase()] : [],
      primaryWallet: walletAddress ? walletAddress.toLowerCase() : null,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      settings: {
        notifications: true,
        language: "en",
      },
    };

    await setDoc(userRef, userData, { merge: true });
    return userData;
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

// Get user profile
export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};

/**
 * Wallet Linking Management
 */

// Link wallet address to user
export const linkWalletToUser = async (userId, walletAddress) => {
  try {
    const normalizedWallet = walletAddress.toLowerCase();

    // Check if wallet is already linked to another user
    const existingLink = await findUserByWallet(normalizedWallet);
    if (existingLink && existingLink.id !== userId) {
      throw new Error("This wallet is already linked to another account");
    }

    // Update user profile
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userProfile = await getUserProfile(userId);

    const linkedWallets = userProfile?.linkedWallets || [];

    if (!linkedWallets.includes(normalizedWallet)) {
      await updateDoc(userRef, {
        linkedWallets: arrayUnion(normalizedWallet),
        primaryWallet: userProfile?.primaryWallet || normalizedWallet,
        lastLogin: serverTimestamp(),
      });
    }

    // Create/update wallet link record
    const walletLinkRef = doc(db, WALLET_LINKS_COLLECTION, normalizedWallet);
    await setDoc(
      walletLinkRef,
      {
        walletAddress: normalizedWallet,
        userId: userId,
        linkedAt: serverTimestamp(),
        isActive: true,
      },
      { merge: true }
    );

    return { success: true };
  } catch (error) {
    console.error("Error linking wallet to user:", error);
    throw error;
  }
};

// Unlink wallet from user
export const unlinkWalletFromUser = async (userId, walletAddress) => {
  try {
    const normalizedWallet = walletAddress.toLowerCase();

    // Update user profile
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userProfile = await getUserProfile(userId);

    if (userProfile?.linkedWallets?.includes(normalizedWallet)) {
      const updatedWallets = userProfile.linkedWallets.filter(
        (w) => w !== normalizedWallet
      );

      await updateDoc(userRef, {
        linkedWallets: updatedWallets,
        primaryWallet:
          userProfile.primaryWallet === normalizedWallet
            ? updatedWallets[0] || null
            : userProfile.primaryWallet,
      });
    }

    // Deactivate wallet link record
    const walletLinkRef = doc(db, WALLET_LINKS_COLLECTION, normalizedWallet);
    await updateDoc(walletLinkRef, {
      isActive: false,
      unlinkedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("Error unlinking wallet from user:", error);
    throw error;
  }
};

// Set primary wallet
export const setPrimaryWallet = async (userId, walletAddress) => {
  try {
    const normalizedWallet = walletAddress.toLowerCase();
    const userProfile = await getUserProfile(userId);

    if (!userProfile?.linkedWallets?.includes(normalizedWallet)) {
      throw new Error("Wallet is not linked to this account");
    }

    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      primaryWallet: normalizedWallet,
    });

    return { success: true };
  } catch (error) {
    console.error("Error setting primary wallet:", error);
    throw error;
  }
};

// Find user by wallet address
export const findUserByWallet = async (walletAddress) => {
  try {
    const normalizedWallet = walletAddress.toLowerCase();

    // First try wallet links collection
    const walletLinkRef = doc(db, WALLET_LINKS_COLLECTION, normalizedWallet);
    const walletLinkSnap = await getDoc(walletLinkRef);

    if (walletLinkSnap.exists() && walletLinkSnap.data().isActive) {
      const userId = walletLinkSnap.data().userId;
      return await getUserProfile(userId);
    }

    // Fallback: search in users collection
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(
      usersRef,
      where("linkedWallets", "array-contains", normalizedWallet)
    );

    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    return null;
  } catch (error) {
    console.error("Error finding user by wallet:", error);
    throw error;
  }
};

// Create anonymous user for wallet-only access
export const createWalletOnlyUser = async (walletAddress) => {
  try {
    const normalizedWallet = walletAddress.toLowerCase();

    // Check if wallet already exists
    const existingUser = await findUserByWallet(normalizedWallet);
    if (existingUser) {
      return existingUser;
    }

    // Create anonymous user ID based on wallet
    const anonymousUserId = `wallet_${normalizedWallet}`;

    const userData = {
      email: "",
      displayName: `User ${normalizedWallet.slice(
        0,
        6
      )}...${normalizedWallet.slice(-4)}`,
      photoURL: "",
      linkedWallets: [normalizedWallet],
      primaryWallet: normalizedWallet,
      isAnonymous: true,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      settings: {
        notifications: false,
        language: "en",
      },
    };

    const userRef = doc(db, USERS_COLLECTION, anonymousUserId);
    await setDoc(userRef, userData);

    // Create wallet link
    const walletLinkRef = doc(db, WALLET_LINKS_COLLECTION, normalizedWallet);
    await setDoc(walletLinkRef, {
      walletAddress: normalizedWallet,
      userId: anonymousUserId,
      linkedAt: serverTimestamp(),
      isActive: true,
    });

    return { id: anonymousUserId, ...userData };
  } catch (error) {
    console.error("Error creating wallet-only user:", error);
    throw error;
  }
};

/**
 * Goals Management
 */

// Create a new goal
export const createGoal = async (userId, walletAddress, goalData) => {
  try {
    const goalsRef = collection(db, GOALS_COLLECTION);
    const goal = {
      userId,
      walletAddress: walletAddress?.toLowerCase(),

      // Nouveaux champs pour les types d'objectifs
      goalType: goalData.goalType || "ETH_AMOUNT", // 'ETH_AMOUNT', 'ETH_PRICE', 'PORTFOLIO_VALUE'
      targetValue: goalData.targetValue || goalData.goalAmount, // Valeur cible
      currency: goalData.currency || "USD", // 'USD' ou 'EUR'

      // Champs legacy pour compatibilité
      goalAmount: goalData.goalAmount || goalData.targetValue,

      unlockDate: goalData.unlockDate,
      description: goalData.description || "",
      blockchainGoalId: goalData.blockchainGoalId || null,
      currentBalance: "0", // Toujours en ETH
      depositsCount: 0,
      createdAt: serverTimestamp(),
      isActive: true,
      isCompleted: false,

      // Métadonnées pour le tracking
      metadata: {
        createdWithNewSystem: true,
        priceAtCreation: goalData.priceAtCreation || null,
      },
    };

    const docRef = await addDoc(goalsRef, goal);
    return { id: docRef.id, ...goal };
  } catch (error) {
    console.error("Error creating goal:", error);
    throw error;
  }
};

// Get user's goals
export const getUserGoals = async (userId, walletAddress = null) => {
  try {
    const goalsRef = collection(db, GOALS_COLLECTION);
    let q;

    if (userId) {
      // Try the optimized query first (requires composite index)
      try {
        q = query(
          goalsRef,
          where("userId", "==", userId),
          where("isActive", "==", true),
          orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        const goals = [];

        querySnapshot.forEach((doc) => {
          goals.push({ id: doc.id, ...doc.data() });
        });

        return goals;
      } catch (indexError) {
        // If composite index is missing, fallback to simpler query
        console.warn(
          "Composite index not available, using fallback query:",
          indexError.message
        );

        q = query(
          goalsRef,
          where("userId", "==", userId),
          where("isActive", "==", true)
        );

        const querySnapshot = await getDocs(q);
        const goals = [];

        querySnapshot.forEach((doc) => {
          goals.push({ id: doc.id, ...doc.data() });
        });

        // Sort manually by createdAt since we can't use orderBy
        goals.sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA; // desc order
        });

        return goals;
      }
    } else if (walletAddress) {
      // Similar fallback for wallet address queries
      try {
        q = query(
          goalsRef,
          where("walletAddress", "==", walletAddress.toLowerCase()),
          where("isActive", "==", true),
          orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);
        const goals = [];

        querySnapshot.forEach((doc) => {
          goals.push({ id: doc.id, ...doc.data() });
        });

        return goals;
      } catch (indexError) {
        console.warn(
          "Composite index not available, using fallback query:",
          indexError.message
        );

        q = query(
          goalsRef,
          where("walletAddress", "==", walletAddress.toLowerCase()),
          where("isActive", "==", true)
        );

        const querySnapshot = await getDocs(q);
        const goals = [];

        querySnapshot.forEach((doc) => {
          goals.push({ id: doc.id, ...doc.data() });
        });

        // Sort manually by createdAt
        goals.sort((a, b) => {
          const dateA = a.createdAt?.seconds || 0;
          const dateB = b.createdAt?.seconds || 0;
          return dateB - dateA; // desc order
        });

        return goals;
      }
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error getting user goals:", error);
    throw error;
  }
};

// Update goal
export const updateGoal = async (goalId, updates) => {
  try {
    const goalRef = doc(db, GOALS_COLLECTION, goalId);
    await updateDoc(goalRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating goal:", error);
    throw error;
  }
};

// Update goal balance after deposit
export const updateGoalBalance = async (goalId, newBalance) => {
  try {
    const goalRef = doc(db, GOALS_COLLECTION, goalId);
    const goalSnap = await getDoc(goalRef);

    if (goalSnap.exists()) {
      const goalData = goalSnap.data();
      const isCompleted =
        parseFloat(newBalance) >= parseFloat(goalData.goalAmount);

      await updateDoc(goalRef, {
        currentBalance: newBalance,
        depositsCount: (goalData.depositsCount || 0) + 1,
        isCompleted,
        lastDepositAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error("Error updating goal balance:", error);
    throw error;
  }
};

/**
 * Transactions Management
 */

// Record a deposit transaction
export const recordDepositTransaction = async (
  userId,
  walletAddress,
  goalId,
  transactionData
) => {
  try {
    const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);
    const transaction = {
      userId,
      walletAddress: walletAddress?.toLowerCase(),
      goalId,
      type: "deposit",
      amount: transactionData.amount,
      currency: "ETH",
      txHash: transactionData.transactionHash || transactionData.txHash,
      blockchainGoalId: transactionData.blockchainGoalId || null,
      status: "completed",
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(transactionsRef, transaction);

    return { id: docRef.id, ...transaction };
  } catch (error) {
    console.error("Error recording deposit transaction:", error);
    throw error;
  }
};

// Get transactions for a goal
export const getGoalTransactions = async (goalId) => {
  try {
    const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);

    // Try the optimized query first
    try {
      const q = query(
        transactionsRef,
        where("goalId", "==", goalId),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(q);
      const transactions = [];

      querySnapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() });
      });

      return transactions;
    } catch (indexError) {
      // Fallback to simpler query if index is missing
      console.warn(
        "Index not available for transactions query, using fallback:",
        indexError.message
      );

      const q = query(transactionsRef, where("goalId", "==", goalId));

      const querySnapshot = await getDocs(q);
      const transactions = [];

      querySnapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() });
      });

      // Sort manually by createdAt
      transactions.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA; // desc order
      });

      return transactions;
    }
  } catch (error) {
    console.error("Error getting goal transactions:", error);
    throw error;
  }
};

// Get user's all transactions
export const getUserTransactions = async (userId) => {
  try {
    const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);

    // Try the optimized query first
    try {
      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(50) // Limit to last 50 transactions
      );

      const querySnapshot = await getDocs(q);
      const transactions = [];

      querySnapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() });
      });

      return transactions;
    } catch (indexError) {
      // Fallback to simpler query if index is missing
      console.warn(
        "Index not available for user transactions query, using fallback:",
        indexError.message
      );

      const q = query(
        transactionsRef,
        where("userId", "==", userId),
        limit(50)
      );

      const querySnapshot = await getDocs(q);
      const transactions = [];

      querySnapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() });
      });

      // Sort manually by createdAt and limit
      transactions.sort((a, b) => {
        const dateA = a.createdAt?.seconds || 0;
        const dateB = b.createdAt?.seconds || 0;
        return dateB - dateA; // desc order
      });

      return transactions.slice(0, 50); // Ensure we don't exceed limit
    }
  } catch (error) {
    console.error("Error getting user transactions:", error);
    throw error;
  }
};

/**
 * User Stats Management (Cache des données blockchain)
 */

// Update user stats (called after successful blockchain transactions)
export const updateUserStats = async (userId, walletAddress, stats) => {
  try {
    const statsRef = doc(db, USER_STATS_COLLECTION, userId);
    const statsData = {
      userId,
      walletAddress: walletAddress?.toLowerCase(),
      totalDeposited: stats.totalDeposited || "0",
      currentBalance: stats.currentBalance || "0",
      activeGoals: stats.activeGoals || 0,
      completedGoals: stats.completedGoals || 0,
      lastUpdated: serverTimestamp(),
    };

    await setDoc(statsRef, statsData, { merge: true });
    return statsData;
  } catch (error) {
    console.error("Error updating user stats:", error);
    throw error;
  }
};

// Get user stats
export const getUserStats = async (userId) => {
  try {
    const statsRef = doc(db, USER_STATS_COLLECTION, userId);
    const statsSnap = await getDoc(statsRef);

    if (statsSnap.exists()) {
      return { id: statsSnap.id, ...statsSnap.data() };
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting user stats:", error);
    throw error;
  }
};
 