import { ConnectButton } from "@rainbow-me/rainbowkit";
import React from "react";

const WalletConnect = () => {
  return (
    <div className="flex justify-end p-4">
      <ConnectButton
        label="Connect Wallet"
        showBalance={true}
        chainStatus="icon"
      />
    </div>
  );
};

export default WalletConnect;
