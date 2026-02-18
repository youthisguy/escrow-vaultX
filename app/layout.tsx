import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "./contexts/WalletContext";
import WalletConnection from "./components/WalletConnection";

export const metadata: Metadata = {
  title: "SOROBAN ESCROW",
  description: "Secure onchain escrow and dispute resolution on Stellar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#181818]">
        <WalletProvider>
          <div className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#181818]/80 backdrop-blur-xl border-b border-zinc-800/50">
              <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
                {/* Logo Section */}
                <div className="flex items-center gap-3">
                  <div className="relative h-11 w-11 flex items-center justify-center bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl">
  
                    <div className="absolute inset-0 bg-emerald-500/10 blur-lg rounded-full" />

                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-7 w-7 relative z-10"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 2L4 5V11C4 16.1 7.4 20.9 12 22C16.6 20.9 20 16.1 20 11V5L12 2Z"
                        stroke="url(#emerald-logo-gradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      <circle
                        cx="12"
                        cy="10"
                        r="2.5"
                        stroke="white"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 12.5V16M10 17H14"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />

                      <defs>
                        <linearGradient
                          id="emerald-logo-gradient"
                          x1="4"
                          y1="2"
                          x2="20"
                          y2="22"
                        >
                          <stop stopColor="#10b981" />
                          <stop offset="1" stopColor="#064e3b" />{" "}
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>

                  <div className="flex flex-col -space-y-1">
                    <span className="hidden sm:block font-black tracking-tighter text-white text-xl">
                      VAULT<span className="text-emerald-500">X</span>
                    </span>
                    <span className="hidden sm:block text-[8px] font-bold text-zinc-500 uppercase tracking-[0.3em] pl-0.5">
                      Escrow Protocol
                    </span>
                  </div>
                </div>

                {/* Wallet Section */}
                <div className="flex items-center gap-3">
                  <WalletConnection />
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 overflow-x-hidden">{children}</main>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
