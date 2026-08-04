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
import type EthereumProvider from "@walletconnect/ethereum-provider";

const CHAIN_ID = 10143;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const monadTestnet = defineChain({
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com" } },
});

type WcProvider = Awaited<ReturnType<typeof EthereumProvider.init>>;

/**
 * One WalletConnect provider for the whole app.
 *
 * Deliberately NOT the injected `window.ethereum`: that slot is a single global every wallet
 * extension races to claim, so whichever one wins silently decides which wallet the user is
 * allowed to use, and stale state from a previous connection gets attributed to whatever
 * claims the slot next. WalletConnect owns wallet selection and session lifetime itself, so
 * that whole class of bug does not exist here.
 *
 * The promise is memoised rather than the resolved provider: `init` is async and several
 * callers can race it on first paint, and initialising twice would open two relay sessions.
 */
let providerPromise: Promise<WcProvider> | null = null;

function getProvider(): Promise<WcProvider> {
  if (!providerPromise) {
    providerPromise = import("@walletconnect/ethereum-provider").then(({ default: EthereumProvider }) =>
      EthereumProvider.init({
        projectId: PROJECT_ID,
        chains: [CHAIN_ID],
        rpcMap: { [CHAIN_ID]: RPC_URL },
        showQrModal: true,
        metadata: {
          name: "Atrum",
          description: "Private prediction markets. The odds are public. You are not.",
          url: "https://markets.atrum.fun",
          icons: ["https://markets.atrum.fun/icon-512.png"],
        },
      }),
    );
  }
  return providerPromise;
}

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
  const [provider, setProvider] = useState<WcProvider | null>(null);

  // The server session cookie survives a reload but React state does not, so without this a
  // refresh shows a signed-in user with no address and no chain -- balance reads as "—" and the
  // header demands a chain switch that already happened.
  useEffect(() => {
    fetch("/api/atrum/auth/session")
      .then((r) => r.json())
      .then((d) => setSession(d.address ?? null))
      .catch(() => {});
  }, []);

  // Resolve the provider and adopt whatever session WalletConnect restored on its own. `init`
  // reloads a live session from its own storage, so `accounts` is already populated here when
  // one exists -- there is no silent-probe request to make, and nothing to reconcile against a
  // wallet that merely happens to be installed.
  useEffect(() => {
    let cancelled = false;
    getProvider()
      .then((p) => {
        if (cancelled) return;
        setProvider(p);
        if (p.accounts?.[0]) {
          setAddress(p.accounts[0] as Address);
          setChainId(p.chainId);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A wallet can change account, change network, or end the session from its own side. Without
  // these the UI keeps showing a stale address and every action fails against the wrong chain
  // or a dead session.
  useEffect(() => {
    if (!provider) return;

    const onAccounts = (accounts: string[]) => {
      const next = (accounts?.[0] as Address) ?? null;
      setAddress(next);
      // The server session belongs to the address that signed it. A different account must
      // prove itself again rather than inheriting the previous one's notes.
      setSession((s) => (s && next && s.toLowerCase() === next.toLowerCase() ? s : null));
      if (!next) fetch("/api/atrum/auth/signout", { method: "POST" }).catch(() => {});
    };
    const onChain = (id: string | number) =>
      setChainId(typeof id === "string" ? parseInt(id, 16) : id);
    const onDisconnect = () => {
      setAddress(null);
      setChainId(null);
      setSession(null);
      fetch("/api/atrum/auth/signout", { method: "POST" }).catch(() => {});
    };

    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    provider.on("disconnect", onDisconnect);
    return () => {
      provider.removeListener("accountsChanged", onAccounts);
      provider.removeListener("chainChanged", onChain);
      provider.removeListener("disconnect", onDisconnect);
    };
  }, [provider]);

  const switchChain = useCallback(async () => {
    const eth = await getProvider();
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
      if (!PROJECT_ID) throw new Error("WalletConnect is not configured (missing project id).");
      const eth = await getProvider();

      // Opening the modal on an already-live session would ask the user to pair a second time
      // for a wallet they are already connected to.
      if (!eth.accounts?.length) await eth.connect();

      const account = eth.accounts?.[0] as Address | undefined;
      if (!account) throw new Error("no account returned");
      setAddress(account);

      setChainId(eth.chainId);
      if (eth.chainId !== CHAIN_ID) await switchChain();

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

  // Ends the WalletConnect session as well as the server one. Dropping only the server session
  // would leave the wallet still paired, so the next "connect" would silently reuse the old
  // pairing instead of letting the user choose a wallet.
  const disconnect = useCallback(async () => {
    await fetch("/api/atrum/auth/signout", { method: "POST" }).catch(() => {});
    setSession(null);
    setAddress(null);
    setChainId(null);
    const eth = await getProvider().catch(() => null);
    if (eth?.session) await eth.disconnect().catch(() => {});
  }, []);

  const walletClient = useCallback((): WalletClient => {
    if (!provider) throw new Error("wallet not ready");
    if (!address) throw new Error("wallet not connected");
    return createWalletClient({ chain: monadTestnet, transport: custom(provider), account: address });
  }, [address, provider]);

  const value: WalletValue = {
    address,
    session,
    chainOk: chainId === CHAIN_ID,
    connecting,
    error,
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
