"use client";

import { useCallback, useState } from "react";
import { Button } from "@delegolabs/ui";
import { useWallet } from "../../hooks/useWallet";
import type { WalletHandle } from "../../hooks/useWallet";
import type { WalletId } from "../../lib/wallet";
import { WalletPickerModal } from "./WalletPicker";

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

export interface WalletConnectButtonProps {
  /** Show the connected address and network alongside the button (default: true) */
  showDetails?: boolean;
  /**
   * Reuse an existing wallet instance (the wallet page owns one so its status
   * card, picker, and this button always agree). Defaults to a private instance.
   */
  wallet?: WalletHandle;
}

/**
 * Connect/disconnect control for the selected Stellar wallet adapter.
 * Reusable in the header, dashboard, and the dedicated wallet page.
 * Connecting always goes through the wallet picker, which links to the
 * install page for any extension that is not installed yet.
 */
export function WalletConnectButton({
  showDetails = true,
  wallet: sharedWallet,
}: WalletConnectButtonProps) {
  const ownWallet = useWallet();
  const {
    status,
    address,
    network,
    error,
    connect,
    disconnect,
    walletId,
    walletName,
    walletInstallUrl,
  } = sharedWallet ?? ownWallet;
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleConnect = useCallback(
    async (id: WalletId) => {
      const connected = await connect(id);
      if (connected) setPickerOpen(false);
      return connected;
    },
    [connect]
  );

  if (status === "checking") {
    return (
      <Button variant="secondary" disabled>
        Checking wallet…
      </Button>
    );
  }

  if (status === "connected" && address) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {showDetails && (
          <span
            className="wallet-address"
            title={address}
            aria-label={`Connected wallet ${address}`}
          >
            {network && <span className="wallet-network-badge">{network}</span>}
            {truncateAddress(address)}
          </span>
        )}
        <Button variant="ghost" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Button
          variant="primary"
          onClick={() => setPickerOpen(true)}
          disabled={status === "connecting"}
        >
          {status === "connecting" ? "Connecting…" : "Connect Wallet"}
        </Button>
        {status === "unavailable" && (
          <Button
            variant="secondary"
            onClick={() =>
              window.open(walletInstallUrl, "_blank", "noopener,noreferrer")
            }
          >
            Install {walletName}
          </Button>
        )}
      </div>
      {status === "error" && error && (
        <span className="wallet-error" role="alert">
          {error}
        </span>
      )}
      <WalletPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConnect={handleConnect}
        connecting={status === "connecting"}
        selectedId={walletId}
        connectedId={status === "connected" ? walletId : null}
        error={status === "error" ? error : null}
      />
    </div>
  );
}
