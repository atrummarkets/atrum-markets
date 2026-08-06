"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  WagmiProvider,
  useAccount,
  useAccountEffect,
  useConfig,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAppKit } from "@reown/appkit/react";
import { createPublicClient, http, defineChain, type Address, type WalletClient, type PublicClient } from "viem";

import { CHAIN_ID, PROJECT_ID, wagmiAdapter } from "./appkit";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";

export const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com" } },
});

interface WalletValue {
  address: Address | null;
  /** The address that has proved itself to the server and can touch notes. */
  session: Address | null;
  chainOk: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: () => Promise<void>;
  /**
   * Async because the wallet client is owned by the connector, which resolves it on demand.
   * Callers await it once per action: `(await walletClient()).writeContract(...)`.
   */
  walletClient: () => Promise<WalletClient>;
  publicClient: PublicClient;
  /**
   * Sign arbitrary text with the connected wallet.
   *
   * Exposed separately from `connect`'s sign-in because the note vault derives its spending
   * keys from a signature that must NEVER reach the server (lib/atrum/client/vault.ts), while
   * sign-in's signature is sent to the server by definition. Same primitive, opposite
   * handling, so the caller has to pick deliberately.
   */
  signMessage: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletValue | null>(null);

const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) }) as PublicClient;

const queryClient = new QueryClient();

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletBridge>{children}</WalletBridge>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/**
 * Maps wagmi/AppKit's connection state onto the shape the rest of the app already speaks, and
 * owns the one thing they do not: proving the address to Atrum's server so it will hand back
 * that address's notes.
 */
function WalletBridge({ children }: { children: ReactNode }) {
  const { address: wagmiAddress, isConnected, chainId, status } = useAccount();
  const { open } = useAppKit();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { signMessageAsync } = useSignMessage();
  const config = useConfig();

  const [serverSession, setServerSession] = useState<Address | null>(null);
  const [authInFlight, setAuthInFlight] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the user asked to connect and the modal is doing the choosing. A ref, not state:
  // it gates a callback rather than any rendered output. Without it the signature prompt would
  // fire on every page load that restored a wallet, turning a passive visit into a signing
  // request.
  const pendingAuth = useRef(false);
  const authenticating = useRef(false);

  const address = (wagmiAddress as Address | undefined) ?? null;
  const chainOk = chainId === CHAIN_ID;
  // Covers the whole span a button should read "Connecting…": the modal picking a wallet, a
  // reconnect on load, and the signature round-trip. Closing the modal without choosing drops
  // wagmi back to "disconnected" on its own, so a cancel needs no bookkeeping of its own.
  const connecting = authInFlight || status === "connecting" || status === "reconnecting";

  // The server session cookie survives a reload but React state does not.
  useEffect(() => {
    fetch("/api/atrum/auth/session")
      .then((r) => r.json())
      .then((d) => setServerSession(d.address ?? null))
      .catch(() => {});
  }, []);

  // Signed in means BOTH: the server issued a session and the wallet that proved it is still
  // connected as that same account. A cookie for a different account than the one now connected
  // is not a session either -- that address has to prove itself before it can touch the first
  // one's notes.
  const session =
    serverSession && address && serverSession.toLowerCase() === address.toLowerCase() ? serverSession : null;

  // The cookie and the wallet connection have independent lifetimes: the cookie outlives the
  // browser session, the wallet connection does not have to. Left unreconciled the app believes
  // it is signed in with no wallet behind it -- which surfaced as a "switch to Monad testnet"
  // prompt for a wallet that was never connected, because the chain is unknown while every gate
  // keyed off the cookie rather than a live connection.
  useEffect(() => {
    if (!serverSession || session) return;
    let cancelled = false;
    // Local state follows the server, not the other way round: clearing it only once the
    // signout lands keeps the two from disagreeing if the request fails.
    fetch("/api/atrum/auth/signout", { method: "POST" })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setServerSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [serverSession, session]);

  const switchChain = useCallback(async () => {
    await switchChainAsync({ chainId: CHAIN_ID });
  }, [switchChainAsync]);

  /** One signature, no transaction, no gas -- proves the address is the caller's. */
  const authenticate = useCallback(
    async (account: Address) => {
      const { nonce, message } = await (await fetch("/api/atrum/auth/nonce")).json();
      const signature = await signMessageAsync({ message, account });
      const res = await fetch("/api/atrum/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: account, nonce, signature }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "sign-in failed");
      setServerSession(body.address);
    },
    [signMessageAsync],
  );

  const runAuth = useCallback(
    async (account: Address) => {
      if (authenticating.current) return;
      authenticating.current = true;
      pendingAuth.current = false;
      setError(null);
      setAuthInFlight(true);
      try {
        if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID });
        await authenticate(account);
      } catch (e) {
        const err = e as { code?: number; name?: string; message?: string };
        setError(
          err.code === 4001 || err.name === "UserRejectedRequestError"
            ? "Request rejected in your wallet."
            : (err.message ?? "connect failed"),
        );
      } finally {
        authenticating.current = false;
        setAuthInFlight(false);
      }
    },
    [authenticate, chainId, switchChainAsync],
  );

  // `open()` resolves when the modal opens, not when a wallet is chosen, so the signature step
  // hangs off wagmi's own connection event instead.
  useAccountEffect({
    onConnect({ address: connected }) {
      if (!pendingAuth.current) return;
      void runAuth(connected as Address);
    },
    onDisconnect() {
      pendingAuth.current = false;
    },
  });

  const connect = useCallback(async () => {
    setError(null);
    if (!PROJECT_ID) {
      setError("WalletConnect is not configured (missing project id).");
      return;
    }
    // A wallet can already be connected while the server session is not -- after a signout, or
    // when the cookie expired first. Re-opening the wallet list to ask for a wallet the user is
    // already on would be noise; go straight to the signature.
    if (isConnected && address) {
      await runAuth(address);
      return;
    }
    pendingAuth.current = true;
    await open();
  }, [isConnected, address, open, runAuth]);

  // Ends the wallet connection as well as the server session. Dropping only the server session
  // would leave the wallet paired, so the next connect would silently reuse it instead of
  // letting the user choose.
  const disconnect = useCallback(async () => {
    await fetch("/api/atrum/auth/signout", { method: "POST" }).catch(() => {});
    setServerSession(null);
    await disconnectAsync().catch(() => {});
  }, [disconnectAsync]);

  const walletClient = useCallback(async (): Promise<WalletClient> => {
    const client = await getWalletClient(config, { chainId: CHAIN_ID });
    if (!client) throw new Error("wallet not connected");
    return client as WalletClient;
  }, [config]);

  const signMessage = useCallback(
    async (message: string): Promise<string> => {
      if (!address) throw new Error("connect your wallet first");
      return signMessageAsync({ message, account: address });
    },
    [signMessageAsync, address],
  );

  const value: WalletValue = {
    address,
    session,
    chainOk,
    connecting,
    error,
    connect,
    disconnect,
    switchChain,
    walletClient,
    publicClient,
    signMessage,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
