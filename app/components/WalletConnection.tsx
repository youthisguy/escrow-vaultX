"use client";

import { useState, useEffect } from "react";
import { stellar } from "../lib/stellar";
import { FaWallet } from "react-icons/fa";
import { MdLogout } from "react-icons/md";
import { useWallet } from "../contexts/WalletContext";
import { BiCoinStack } from "react-icons/bi";

export default function WalletConnection() {
  const { address, setAddress, walletsKit } = useWallet();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const handleConnect = async () => {
    try {
      setLoading(true);
      await walletsKit.openModal({
        onWalletSelected: async (option) => {
          walletsKit.setWallet(option.id);
          const { address } = await walletsKit.getAddress();
          setAddress(address);
        },
        onClosed: () => setLoading(false),
      });
    } catch (error: any) {
      console.error("Connection error:", error);
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setAddress(null);
    if (stellar.disconnect) stellar.disconnect();
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Updated Emerald Tech Base Class (No Glow)
  const buttonBaseClass = "group relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all active:scale-95 border border-emerald-500/30 bg-zinc-950 hover:bg-emerald-500/5 hover:border-emerald-500/60 overflow-hidden";

  if (!address) {
    return (
      <div className="flex justify-end">
        <button
          onClick={handleConnect}
          disabled={loading}
          className={buttonBaseClass}
        >
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-r-transparent" />
          ) : (
            <FaWallet className="text-emerald-500 text-sm" />
          )}
          <span className="text-sm font-black tracking-widest text-emerald-500 uppercase">
            {loading ? "Connecting..." : "Connect"}
          </span>
          
          {/* Subtle tech sweep animation on hover */}
          <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-700 group-hover:[transform:skew(-12deg)_translateX(100%)]">
            <div className="relative h-full w-8 bg-emerald-500/10" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {toast && (
        <div className="absolute -top-14 right-0 px-4 py-2 rounded-lg shadow-xl text-[10px] font-black uppercase tracking-widest z-50 whitespace-nowrap bg-zinc-900 text-emerald-400 border border-emerald-500/20">
          {toast.message}
        </div>
      )}

      <div className="flex flex-row items-center justify-end gap-3">
        {/* USDC FAUCET  */}
        <a
          href="https://faucet.circle.com/"
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonBaseClass} border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5`}
          title="Get USDC"
        >
          <BiCoinStack size={18} className="text-blue-500" />
          <span className="hidden md:inline text-xs font-black tracking-widest text-blue-500 uppercase">get usdc</span>
        </a>

        {/* DISCONNECT */}
        <button
          onClick={handleDisconnect}
          className={`${buttonBaseClass} border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/5`}
          title="Disconnect"
        >
          <MdLogout size={18} className="text-rose-500" />
          <span className="hidden md:inline text-xs font-black tracking-widest text-rose-500 uppercase">Disconnect</span>
        </button>
      </div>
    </div>
  );
}