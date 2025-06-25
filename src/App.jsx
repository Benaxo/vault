import { ConnectButton } from "@rainbow-me/rainbowkit";
import React, { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import logo from "../public/logo.jpeg";
import AuthModal from "./components/AuthModal";
import { DepositForm } from "./components/DepositForm";
import Hero from "./components/Hero";
import HeroC from "./components/HeroC";
import PortfolioOverview from "./components/PortfolioOverview";
import UserDropdown from "./components/UserDropdown";
import WalletConnect from "./components/WalletConnect";
import WithdrawForm from "./components/WithdrawForm";
import { useAuth } from "./hooks/useAuth";
import {
  createUserProfile,
  createWalletOnlyUser,
  findUserByWallet,
  linkWalletToUser,
} from "./services/userService";

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="text-center">
              <div className="text-6xl mb-4">😵</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-4">
                Oups ! Quelque chose s'est mal passé
              </h1>
              <p className="text-gray-600 mb-6">
                Une erreur inattendue s'est produite. Veuillez rafraîchir la
                page ou réessayer plus tard.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Rafraîchir la page
              </button>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500">
                    Détails de l'erreur (développement)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {this.state.error && this.state.error.toString()}
                    {this.state.errorInfo &&
                      this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authMethod, setAuthMethod] = useState(null); // 'firebase', 'wallet', or 'both'
  const [showHero, setShowHero] = useState(true);

  const { address } = useAccount();
  const { user, loading: authLoading, logout } = useAuth();

  // Determine current user from either Firebase auth or wallet
  const getCurrentUser = async () => {
    if (user) {
      // User is authenticated with Firebase
      return {
        source: "firebase",
        profile: await createUserProfile(user, address),
      };
    } else if (address) {
      // Try to find existing user by wallet
      let walletUser = await findUserByWallet(address);
      if (!walletUser) {
        // Create anonymous wallet-only user
        walletUser = await createWalletOnlyUser(address);
      }
      return { source: "wallet", profile: walletUser };
    }
    return { source: null, profile: null };
  };

  // Initialize user profile based on available auth methods
  useEffect(() => {
    const initializeUser = async () => {
      if (authLoading) return; // Wait for Firebase auth to load

      try {
        setIsInitializing(true);
        const currentUser = await getCurrentUser();

        if (currentUser.profile) {
          setUserProfile(currentUser.profile);
          setAuthMethod(currentUser.source);

          // Auto-link if user has Firebase auth but wallet is not linked
          if (
            currentUser.source === "firebase" &&
            address &&
            !currentUser.profile.linkedWallets?.includes(address.toLowerCase())
          ) {
            try {
              await linkWalletToUser(user.uid, address);
              const updatedProfile = await createUserProfile(user, address);
              setUserProfile(updatedProfile);
              setAuthMethod("both");
            } catch (error) {
              console.log("Auto-link failed:", error.message);
              // If auto-link fails (wallet already linked to another account), continue without linking
            }
          }
        } else {
          setUserProfile(null);
          setAuthMethod(null);
        }
      } catch (error) {
        console.error("Error initializing user:", error);
      } finally {
        setIsInitializing(false);
      }
    };

    initializeUser();
  }, [user, address, authLoading]);

  // Check if user has access to the app (either Firebase auth OR wallet connected)
  const hasAppAccess = () => {
    return user || address;
  };

  // Check if user has full access (both Firebase auth AND wallet linked)
  const hasFullAccess = () => {
    return (
      user &&
      address &&
      userProfile?.linkedWallets?.includes(address.toLowerCase())
    );
  };

  // Check if user needs to link wallet for transactions
  const needsWalletForTransaction = () => {
    return (
      user &&
      (!address || !userProfile?.linkedWallets?.includes(address.toLowerCase()))
    );
  };

  // Handle successful authentication
  const handleAuthSuccess = async () => {
    console.log("Authentication successful!");
    // Re-initialize user after auth
    const currentUser = await getCurrentUser();
    setUserProfile(currentUser.profile);
    setAuthMethod(currentUser.source);
  };

  // Handle successful wallet linking
  const handleWalletLinkSuccess = async () => {
    console.log("Wallet linked successfully!");
    // Refresh user profile
    if (user) {
      const updatedProfile = await createUserProfile(user, address);
      setUserProfile(updatedProfile);
      setAuthMethod("both");
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      if (user) {
        await logout();
      }
      setUserProfile(null);
      setAuthMethod(null);
      setActiveTab("dashboard");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Get display name for user
  const getUserDisplayName = () => {
    if (userProfile?.isAnonymous) {
      return `${address?.slice(0, 6)}...${address?.slice(-4)}`;
    }
    return userProfile?.displayName || userProfile?.email || "User";
  };

  // Tab navigation
  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <PortfolioOverview
            userProfile={userProfile}
            authMethod={authMethod}
          />
        );
      case "deposit":
        return (
          <DepositForm userProfile={userProfile} authMethod={authMethod} />
        );
      case "withdraw":
        return (
          <WithdrawForm userProfile={userProfile} authMethod={authMethod} />
        );
      default:
        return (
          <PortfolioOverview
            userProfile={userProfile}
            authMethod={authMethod}
          />
        );
    }
  };

  // Show loading while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300">Initialisation de PiggyBank Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black">
        {/* Header */}
        <header className="bg-black shadow-sm border-b border-gray-800">
          <div className="container mx-auto flex justify-between items-center p-4">
            <div className="flex items-center">
              <img
                src={logo}
                alt="PiggyBank Vault Logo"
                className="h-10 w-10 rounded-full cursor-pointer mr-2 border-2 border-cyan-500"
                onClick={() => setShowHero(true)}
              />
              <span
                className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent cursor-pointer"
                onClick={() => setShowHero(true)}
              >
                PiggyBank Vault
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Dropdown - When user has access */}
              {(user && userProfile) ||
              (address && userProfile && userProfile.isAnonymous) ? (
                <UserDropdown
                  userProfile={userProfile}
                  user={user}
                  address={address}
                  authMethod={authMethod}
                  hasFullAccess={hasFullAccess}
                  needsWalletForTransaction={needsWalletForTransaction}
                  getUserDisplayName={getUserDisplayName}
                  handleLogout={handleLogout}
                />
              ) : null}

              {/* Auth Actions - When no access */}
              {!hasAppAccess() && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow"
                  >
                    Sign In
                  </button>
                </div>
              )}

              {/* Wallet Connect - Always show when no access */}
              {!hasAppAccess() && <WalletConnect />}
            </div>
          </div>

          {/* Quick Access Level Indicator - Only show if incomplete setup */}
          {hasAppAccess() && !hasFullAccess() && (
            <div className="border-b border-gray-800 bg-gradient-to-r from-cyan-900/30 to-purple-900/30">
              <div className="container mx-auto px-4 py-2">
                <div className="flex items-center justify-center">
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="text-yellow-400">⚠️</span>
                    <span className="text-gray-200">
                      {user && !address
                        ? "Connectez votre wallet pour effectuer des transactions"
                        : !user && address
                        ? "Créez un compte pour sauvegarder votre progression"
                        : "Configuration incomplète"}
                    </span>
                    {user ? (
                      <ConnectButton
                        label="Lier le Wallet"
                        showBalance={false}
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setIsAuthModalOpen(true);
                        }}
                        className="text-cyan-400 hover:text-purple-400 font-medium underline"
                      >
                        Créer un compte
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* HERO PAGE PAR DEFAUT */}
          {showHero ? (
            <div className="mb-12">
              <HeroC setShowHero={setShowHero} />
            </div>
          ) : (
            // APP PRINCIPALE
            <>
              {/* Dashboard Section - Show when user has access */}
              {hasAppAccess() && userProfile && (
                <div className="mx-auto max-w-5xl">
                  {/* Tabs for different actions */}
                  <div className="bg-gray-900 rounded-lg shadow-md overflow-hidden mb-8 border border-gray-800">
                    <div className="flex border-b border-gray-800">
                      <button
                        className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                          activeTab === "dashboard"
                            ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white"
                            : "hover:bg-gray-800 text-gray-300"
                        }`}
                        onClick={() => setActiveTab("dashboard")}
                      >
                        Dashboard
                      </button>
                      <button
                        className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                          activeTab === "deposit"
                            ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white"
                            : "hover:bg-gray-800 text-gray-300"
                        }`}
                        onClick={() => setActiveTab("deposit")}
                      >
                        Dépôt
                      </button>
                      <button
                        className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                          activeTab === "withdraw"
                            ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white"
                            : "hover:bg-gray-800 text-gray-300"
                        }`}
                        onClick={() => setActiveTab("withdraw")}
                      >
                        Retrait
                      </button>
                    </div>
                    <div className="p-4">{renderTabContent()}</div>
                  </div>
                </div>
              )}
              {/* Auth/Wallet connect section (si besoin) */}
              {!hasAppAccess() && (
                <div className="mb-12">
                  <Hero setShowHero={setShowHero} />
                  <div className="mt-8 text-center space-y-4">
                    <button
                      className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-lg transition-colors"
                      onClick={() => setIsAuthModalOpen(true)}
                    >
                      Sign In
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>

        {/* Modals */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />

        <footer className="bg-black text-white py-6 mt-16 border-t border-gray-800">
          <div className="container mx-auto px-4 text-center">
            <p>
              PiggyBank Vault - Une application d'épargne décentralisée sur
              Sepolia testnet
            </p>
            <p className="mt-2 text-gray-400 text-sm">
              Ceci est un projet démo. N'utilisez pas de fonds réels.
            </p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;
