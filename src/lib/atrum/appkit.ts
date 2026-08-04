"use client";

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import { monadTestnet as appkitMonadTestnet, type AppKitNetwork } from "@reown/appkit/networks";

/**
 * Wallet connection lives behind AppKit (Reown, the WalletConnect people) rather than being
 * assembled here.
 *
 * Two earlier attempts are the reason. Reading `window.ethereum` directly meant whichever
 * extension won that single global slot decided which wallet the user was allowed to use --
 * MetaMask was simply unreachable behind OKX. Speaking the WalletConnect relay protocol alone
 * fixed the arbitration but could only ever produce a QR code, because a browser extension is a
 * different transport entirely and no amount of configuration bridges the two. AppKit is the
 * layer that holds both: its modal lists installed extensions AND offers WalletConnect for
 * phones, as one list.
 */

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";
export const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

/**
 * AppKit ships a Monad testnet definition, but pointed at the public RPC, which rate-limits at
 * 15/sec and this app polls constantly (see the note beside RPC_URL in .env). Keep the chain
 * identity, take our own endpoint.
 */
export const monadNetwork: AppKitNetwork = {
  ...appkitMonadTestnet,
  rpcUrls: { default: { http: [RPC_URL] } },
};

export const CHAIN_ID = Number(monadNetwork.id);

export const wagmiAdapter = new WagmiAdapter({
  networks: [monadNetwork],
  projectId: PROJECT_ID,
  ssr: true,
});

// Runs at module scope, including during prerender: `useAppKit` throws if the modal was never
// created, and the product pages are statically generated. A missing project id therefore must
// not skip this -- it falls back to a placeholder so the build still produces a page, and
// `connect()` refuses with a legible error instead of opening a modal that cannot pair.
createAppKit({
  adapters: [wagmiAdapter],
  networks: [monadNetwork],
  projectId: PROJECT_ID || "0".repeat(32),
  metadata: {
    name: "Atrum",
    description: "Private prediction markets. The odds are public. You are not.",
    url: "https://markets.atrum.fun",
    icons: ["https://markets.atrum.fun/icon-512.png"],
  },
  // Atrum's whole claim is that it cannot see who is betting. Shipping wallet analytics, or
  // email/social sign-in that mints a custodial address, would contradict the product.
  features: { analytics: false, email: false, socials: false },
});
