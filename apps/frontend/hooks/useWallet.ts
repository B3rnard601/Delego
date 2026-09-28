"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isDemoMode,
  DEMO_WALLET_ADDRESS,
  DEMO_NETWORK,
  DEMO_NETWORK_PASSPHRASE,
} from "../lib/demoMode";
import {
  DEFAULT_WALLET_ID,
  WalletAccessDeniedError,
  getWalletAdapter,
  loadSelectedWalletId,
  saveSelectedWalletId,
  toWalletError,
} from "../lib/wallet";
import type { WalletId, WalletNetworkInfo } from "../lib/wallet";
import { useNotifications } from "./useNotifications";
import { useAnnounce } from "./useAnnounce";

export type WalletConnectionStatus =
  | "checking"
  | "unavailable"
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface WalletState {
  status: WalletConnectionStatus;
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  error: string | null;
}

const initialState: WalletState = {
  status: "checking",
  address: null,
  network: null,
  networkPassphrase: null,
  error: null,
};

/** Synthetic connected-wallet state reported while demo mode is active (#632). */
const demoState: WalletState = {
  status: "connected",
  address: DEMO_WALLET_ADDRESS,
  network: DEMO_NETWORK,
  networkPassphrase: DEMO_NETWORK_PASSPHRASE,
  error: null,
};

const DETECT_ERROR_FALLBACK = "Wallet extension not detected";
const ADDRESS_ERROR_FALLBACK = "Couldn't read the wallet address. Please try again.";
const CONNECT_ERROR_FALLBACK =
  "Wallet extension not found. Install it to connect your wallet.";
const DEMO_SIGN_BLOCKED =
  "This is a read-only demo — turn it off to sign transactions with your wallet.";

function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * Connection state for the selected Stellar wallet adapter (#736).
 *
 * Every extension call goes through `lib/wallet`'s `StellarWalletAdapter`
 * interface — Freighter ships as the first adapter (its statuses, messages
 * and change listeners behave exactly as before), LOBSTR as the second, and
 * `selectWallet`/`connect(id)` switch between them with the choice persisted
 * per browser. `signTransaction` delegates to the same adapter and is the
 * signing entry point for FE-013.
 */
export function useWallet() {
  const [state, setState] = useState<WalletState>(
    isDemoMode() ? demoState : initialState
  );
  const [walletId, setWalletId] = useState<WalletId>(
    () => loadSelectedWalletId() ?? DEFAULT_WALLET_ID
  );
  const [toast, setToast] = useState<string | null>(null);
  const prevAddressRef = useRef<string | null>(null);

  const adapter = useMemo(() => getWalletAdapter(walletId), [walletId]);

  let announceFn: ((msg: string) => void) | undefined;
  try {
    const announceCtx = useAnnounce();
    if (announceCtx?.announce) {
      announceFn = announceCtx.announce;
    }
  } catch {
    /* ignore if outside AnnounceProvider */
  }

  let addNotificationFn:
    | ((notification: { type: "info"; title: string }) => void)
    | undefined;
  try {
    const notifCtx = useNotifications();
    if (notifCtx?.add) {
      addNotificationFn = notifCtx.add;
    }
  } catch {
    /* ignore if outside NotificationProvider */
  }

  const announceRef = useRef(announceFn);
  announceRef.current = announceFn;

  const addNotificationRef = useRef(addNotificationFn);
  addNotificationRef.current = addNotificationFn;

  const updateWalletState = useCallback(
    (newState: WalletState) => {
      const prevAddr = prevAddressRef.current;
      const newAddr = newState.address;

      if (
        prevAddr !== null &&
        newAddr !== null &&
        prevAddr !== newAddr &&
        newState.status === "connected"
      ) {
        const msg = `Switched to ${truncateAddress(newAddr)}`;
        setToast(msg);
        addNotificationRef.current?.({ type: "info", title: msg });
        announceRef.current?.(msg);
      }

      prevAddressRef.current = newAddr;
      setState(newState);
    },
    []
  );

  const refresh = useCallback(async () => {
    if (isDemoMode()) {
      setState(demoState);
      return;
    }
    setState((prev) => ({ ...prev, status: "checking", error: null }));

    let detected = false;
    try {
      detected = await adapter.detect();
    } catch (err) {
      updateWalletState({
        ...initialState,
        status: "unavailable",
        error: toWalletError(err, DETECT_ERROR_FALLBACK).message,
      });
      return;
    }

    if (!detected) {
      updateWalletState({ ...initialState, status: "unavailable" });
      return;
    }

    let address: string | null = null;
    try {
      address = await adapter.getAddress();
    } catch (err) {
      updateWalletState({
        ...initialState,
        status: "error",
        error: toWalletError(err, ADDRESS_ERROR_FALLBACK).message,
      });
      return;
    }

    if (!address) {
      updateWalletState({ ...initialState, status: "disconnected" });
      return;
    }

    let network: WalletNetworkInfo | null = null;
    try {
      network = await adapter.getNetwork();
    } catch {
      network = null;
    }

    updateWalletState({
      status: "connected",
      address,
      network: network?.network ?? null,
      networkPassphrase: network?.networkPassphrase ?? null,
      error: null,
    });
  }, [adapter, updateWalletState]);

  useEffect(() => {
    if (isDemoMode()) {
      setState(demoState);
      return;
    }

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        await refresh();
      } catch {
        /* refresh reports its own failures through state */
      }
      if (!isMounted || !adapter.subscribe) return;

      try {
        const registration = await adapter.subscribe(() => {
          if (isMounted) void refresh();
        });
        if (!isMounted) {
          if (typeof registration === "function") registration();
          return;
        }
        if (typeof registration === "function") {
          unsubscribe = registration;
        }
      } catch {
        /* the extension offers no change listeners here */
      }
    })();

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [adapter, refresh]);

  const connect = useCallback(
    async (id?: WalletId): Promise<boolean> => {
      if (isDemoMode()) {
        setState(demoState);
        return true;
      }

      const target = id ? getWalletAdapter(id) : adapter;
      if (id) {
        saveSelectedWalletId(target.id);
        prevAddressRef.current = null;
        if (target.id !== walletId) setWalletId(target.id);
      }

      setState((prev) => ({ ...prev, status: "connecting", error: null }));
      try {
        const address = await target.connect();
        let network: WalletNetworkInfo | null = null;
        try {
          network = await target.getNetwork();
        } catch {
          network = null;
        }
        updateWalletState({
          status: "connected",
          address,
          network: network?.network ?? null,
          networkPassphrase: network?.networkPassphrase ?? null,
          error: null,
        });
        return true;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status:
            err instanceof WalletAccessDeniedError ? "error" : "unavailable",
          error: toWalletError(err, CONNECT_ERROR_FALLBACK).message,
        }));
        return false;
      }
    },
    [adapter, updateWalletState, walletId]
  );

  /**
   * Switches the selected wallet without connecting. The choice is persisted
   * for this browser, and the effect above re-probes the new adapter.
   */
  const selectWallet = useCallback(
    (id: WalletId) => {
      const target = getWalletAdapter(id);
      saveSelectedWalletId(target.id);
      prevAddressRef.current = null;
      if (target.id !== walletId) setWalletId(target.id);
      if (!isDemoMode()) {
        setState((prev) => ({ ...prev, status: "checking", error: null }));
      }
    },
    [walletId]
  );

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (isDemoMode()) {
        throw new Error(DEMO_SIGN_BLOCKED);
      }
      return adapter.signTransaction(xdr);
    },
    [adapter]
  );

  const disconnect = useCallback(() => {
    prevAddressRef.current = null;
    try {
      const result = adapter.disconnect();
      if (result instanceof Promise) void result.catch(() => undefined);
    } catch {
      /* local state is reset regardless of what the extension says */
    }
    setState({ ...initialState, status: "disconnected" });
  }, [adapter]);

  return {
    ...state,
    isConnected: state.status === "connected",
    walletId: adapter.id,
    walletName: adapter.name,
    walletInstallUrl: adapter.installUrl,
    connect,
    selectWallet,
    disconnect,
    refresh,
    signTransaction,
    toast,
  };
}

/** Everything `useWallet` returns — usable as a prop type for shared instances. */
export type WalletHandle = ReturnType<typeof useWallet>;
