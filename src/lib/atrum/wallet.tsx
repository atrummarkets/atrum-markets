"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  defineChain,
  type Address,
  type WalletClient,
  type PublicClient,
} from "viem";

const CHAIN_ID = 10143;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";

export const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com" } },
});

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, handler: (...args: never[]) => void): void;
  removeListener?(event: string, handler: (...args: never[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193;
  }
}

interface WalletValue {
  address: Address | null;
  /** The address that has proved itself to the server and can touch notes. */
  session: Address | null;
  chainOk: boolean;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchChain: () => Promise<void>;
  walletClient: () => WalletClient;
  publicClient: PublicClient;
}

const WalletContext = createContext<WalletValue | null>(null);

const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) }) as PublicClient;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<Address | null>(null);
  const [session, setSession] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  // Restore on mount. The session cookie survives a reload but React state does not, so
  // without this a refresh shows a signed-in user with no address and no chain -- balance
  // reads as "—" and the header demands a chain switch that already happened.
  //
  // `eth_accounts` (not `eth_requestAccounts`) is the silent form: it returns the already
  // authorised accounts and never opens a wallet prompt.
  useEffect(() => {
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    setHasProvider(!!eth);

    fetch("/api/atrum/auth/session")
      .then((r) => r.json())
      .then((d) => setSession(d.address ?? null))
      .catch(() => {});

    if (!eth) return;
    (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        if (accounts?.[0]) setAddress(accounts[0] as Address);
        const id = (await eth.request({ method: "eth_chainId" })) as string;
        setChainId(parseInt(id, 16));
      } catch {
        /* a locked or absent wallet is not an error here -- the user just is not connected */
      }
    })();
  }, []);

  // A wallet can change account or network underneath us. Without these listeners the UI keeps
  // showing a stale address and every action fails against the wrong chain.
  useEffect(() => {
    const eth = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!eth?.on) return;
    const onAccounts = (accounts: string[]) => {
      const next = (accounts?.[0] as Address) ?? null;
      setAddress(next);
      // The server session belongs to the address that signed it. A different account must
      // prove itself again rather than inheriting the previous one's notes.
      setSession((s) => (s && next && s.toLowerCase() === next.toLowerCase() ? s : null));
      if (!next) fetch("/api/atrum/auth/signout", { method: "POST" }).catch(() => {});
    };
    const onChain = (hex: string) => setChainId(parseInt(hex, 16));
    eth.on("accountsChanged", onAccounts as never);
    eth.on("chainChanged", onChain as never);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts as never);
      eth.removeListener?.("chainChanged", onChain as never);
    };
  }, []);

  const switchChain = useCallback(async () => {
    const eth = window.ethereum;
    if (!eth) throw new Error("no wallet found");
    const hex = `0x${CHAIN_ID.toString(16)}`;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hex }] });
    } catch (e) {
      // 4902 = chain unknown to the wallet. Add it, then it is switched to automatically.
      const code = (e as { code?: number }).code;
      if (code !== 4902) throw e;
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hex,
            chainName: "Monad Testnet",
            nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: ["https://testnet.monadexplorer.com"],
          },
        ],
      });
    }
    setChainId(CHAIN_ID);
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    try {
      const eth = window.ethereum;
      if (!eth) throw new Error("No wallet found. Install MetaMask or another injected wallet.");

      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const account = accounts[0] as Address;
      if (!account) throw new Error("no account returned");
      setAddress(account);

      const current = parseInt((await eth.request({ method: "eth_chainId" })) as string, 16);
      setChainId(current);
      if (current !== CHAIN_ID) await switchChain();

      // Prove control of the address to the server, so it will hand back this address's notes.
      const { nonce, message } = await (await fetch("/api/atrum/auth/nonce")).json();
      const signature = (await eth.request({
        method: "personal_sign",
        params: [message, account],
      })) as `0x${string}`;

      const res = await fetch("/api/atrum/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: account, nonce, signature }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "sign-in failed");
      setSession(body.address);
    } catch (e) {
      const err = e as { code?: number; message?: string };
      setError(err.code === 4001 ? "Request rejected in your wallet." : err.message ?? "connect failed");
    } finally {
      setConnecting(false);
    }
  }, [switchChain]);

  const disconnect = useCallback(async () => {
    await fetch("/api/atrum/auth/signout", { method: "POST" }).catch(() => {});
    setSession(null);
    setAddress(null);
  }, []);

  const walletClient = useCallback((): WalletClient => {
    const eth = window.ethereum;
    if (!eth) throw new Error("no wallet found");
    if (!address) throw new Error("wallet not connected");
    return createWalletClient({ chain: monadTestnet, transport: custom(eth), account: address });
  }, [address]);

  const value: WalletValue = {
    address,
    session,
    chainOk: chainId === CHAIN_ID,
    connecting,
    error,
    hasProvider,
    connect,
    disconnect,
    switchChain,
    walletClient,
    publicClient,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
