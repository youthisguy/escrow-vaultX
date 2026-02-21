"use client";

import { useState, useEffect } from "react";
import { useWallet } from "./contexts/WalletContext";
import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  xdr,
  Address,
  scValToNative,
  Contract,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { stellar } from "./lib/stellar";
import {
  ShieldCheck,
  Lock,
  Unlock,
  RefreshCcw,
  ArrowRightLeft,
  Search,
  PlusCircle,
  Users,
  AlertCircle,
  ExternalLink,
  History,
  TrendingUp,
  TrendingDown,
  X,
} from "lucide-react";
import { FaWallet } from "react-icons/fa";
import { BiCoinStack } from "react-icons/bi";
import { AnimatePresence, motion } from "framer-motion";

const CONTRACT_ID = "CCCG5JBZLW2CGYE62OWHM3VPKO3B6GCKUN2KIXG6T644BOW7PAM6LOKJ";
const USDC_ASSET = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const server = new SorobanRpc.Server("https://soroban-testnet.stellar.org:443");
const networkPassphrase = Networks.TESTNET;

export default function EscrowPage() {
  const { address: connectedAddress, walletsKit, setAddress } = useWallet();

  const [view, setView] = useState<"search" | "create">("search");
  const [escrowId, setEscrowId] = useState("");
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<{
    type: "success" | "error" | "pending";
    msg: string;
    hash?: string;
  } | null>(null);

  const [escrowDetail, setEscrowDetail] = useState<any>(null);
  const [userCreatedIds, setUserCreatedIds] = useState<bigint[]>([]);
  const [userReceivedIds, setUserReceivedIds] = useState<bigint[]>([]);
  const [dashboardTab, setDashboardTab] = useState<"sent" | "received">("sent");
  const [usdcBalance, setUsdcBalance] = useState("0");

  const [createForm, setCreateForm] = useState({
    recipient: "",
    amount: "",
    deadlineDays: "7",
  });

  const getStatus = (status: number) => {
    const map = ["Pending", "Approved", "Completed", "Refunded"];
    return map[status] || "Unknown";
  };

  // --- CONTRACT READS ---

  const loadUserDashboard = async () => {
    if (!connectedAddress) return;
    try {
      const contract = new Contract(CONTRACT_ID);
      const userScVal = new Address(connectedAddress).toScVal();

      const account = await server.getAccount(connectedAddress);

      const fetchIds = async (method: string) => {
        const tx = new TransactionBuilder(account, {
          fee: "1000",
          networkPassphrase,
        })
          .addOperation(contract.call(method, userScVal))
          .setTimeout(30)
          .build();
        const sim = await server.simulateTransaction(tx);
        return SorobanRpc.Api.isSimulationSuccess(sim)
          ? scValToNative(sim.result!.retval)
          : [];
      };

      const [created, received] = await Promise.all([
        fetchIds("get_created_ids"),
        fetchIds("get_received_ids"),
      ]);

      setUserCreatedIds(created);
      setUserReceivedIds(received);
    } catch (e) {
      console.error("Dashboard Load Error:", e);
    }
  };

  const fetchEscrow = async (id?: string) => {
    const targetId = id || escrowId;
    if (!targetId) return;
    setLoading(true);
    try {
      const contract = new Contract(CONTRACT_ID);
      const idScVal = nativeToScVal(BigInt(targetId), { type: "u64" });

      const source =
        connectedAddress ||
        "GDXK7EYVBXTITLBW2ZCODJW3B7VTVCNNNWDDEHKJ7Y67TZVW5VKRRMU6";
      const account = await server.getAccount(source);
      const tx = new TransactionBuilder(account, {
        fee: "1000",
        networkPassphrase,
      })
        .addOperation(contract.call("get_escrow", idScVal))
        .setTimeout(30)
        .build();

      const sim = await server.simulateTransaction(tx);
      if (SorobanRpc.Api.isSimulationSuccess(sim)) {
        const data = scValToNative(sim.result!.retval);
        setEscrowDetail(data);
        setEscrowId(targetId);
      } else {
        setEscrowDetail(null);
        alert("Escrow not found");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connectedAddress) loadUserDashboard();
  }, [connectedAddress]);

  // load USDC balance
  useEffect(() => {
    if (!connectedAddress) return;

    const loadUsdc = async () => {
      try {
        const response = await fetch(
          `https://horizon-testnet.stellar.org/accounts/${connectedAddress}`
        );
        const data = await response.json();

        if (data.balances) {
          const usdc = data.balances.find(
            (b: any) =>
              b.asset_code === "USDC" &&
              b.asset_issuer ===
                "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
          );

          setUsdcBalance(usdc ? usdc.balance : "0.00");
        }
      } catch (e) {
        console.error("Error fetching USDC balance:", e);
      }
    };

    loadUsdc();
    const iv = setInterval(loadUsdc, 10000);
    return () => clearInterval(iv);
  }, [connectedAddress]);

  // --- CONTRACT WRITES ---

  const handleAction = async (
    method: "approve" | "claim" | "refund" | "create"
  ) => {
    if (!connectedAddress || !walletsKit) return;

    setLoading(true);
    setTxStatus({ type: "pending", msg: `Broadcasting ${method}...` });

    try {
      const source = await server.getAccount(connectedAddress);
      const contract = new Contract(CONTRACT_ID);
      let ops;

      if (method === "create") {
        // Convert amount to stroops (7 decimals for USDC)
        const amountRaw = BigInt(
          Math.floor(parseFloat(createForm.amount) * 1e7)
        );

        // Calculate deadline timestamp
        const deadline = BigInt(
          Math.floor(Date.now() / 1000) +
            parseInt(createForm.deadlineDays) * 86400
        );

        // Construct recipients vector for Soroban XDR
        const recipientsVec = xdr.ScVal.scvVec([
          xdr.ScVal.scvVec([
            new Address(createForm.recipient).toScVal(),
            nativeToScVal(100, { type: "u32" }), // 100% split
          ]),
        ]);

        ops = contract.call(
          "create",
          new Address(connectedAddress).toScVal(),
          recipientsVec,
          nativeToScVal(amountRaw, { type: "i128" }),
          new Address(USDC_ASSET).toScVal(),
          nativeToScVal(deadline, { type: "u64" })
        );
      } else {
        // Handle ID-based actions (Approve, Claim, Refund)
        const idScVal = nativeToScVal(BigInt(escrowId), { type: "u64" });
        ops =
          method === "claim"
            ? contract.call(
                method,
                idScVal,
                new Address(connectedAddress).toScVal()
              )
            : contract.call(method, idScVal);
      }

      // Build and prepare the transaction
      const tx = new TransactionBuilder(source, {
        fee: "10000",
        networkPassphrase,
      })
        .addOperation(ops)
        .setTimeout(30)
        .build();

      const prepared = await server.prepareTransaction(tx);

      // Request signature from wallet
      const { signedTxXdr } = await walletsKit.signTransaction(
        prepared.toXDR()
      );

      // Submit to network
      const sendResponse = await server.sendTransaction(
        TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase)
      );

      // Handle Success
      if (sendResponse.status === "PENDING") {
        setTxStatus({
          type: "success",
          msg:
            method === "create"
              ? "Escrow Deployed Successfully!"
              : "Action Confirmed!",
          hash: sendResponse.hash,
        });

        if (method === "create") {
          setCreateForm({ recipient: "", amount: "", deadlineDays: "7" });
        }

        // --- THE REFRESH LOGIC ---
        setTxStatus((prev) =>
          prev ? { ...prev, msg: "Transaction sent" } : null
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));

        await loadUserDashboard();

        if (method !== "create") {
          if (typeof fetchEscrow === "function") await fetchEscrow();
        }
      }
    } catch (err: any) {
      console.error(`Action ${method} failed:`, err);
      setTxStatus({
        type: "error",
        msg:
          err.status === 400
            ? "Transaction simulation failed. Check your balance."
            : err.message || "Action failed",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (txStatus && txStatus.type !== "pending") {
      const timer = setTimeout(() => {
        setTxStatus(null);
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [txStatus]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 font-sans p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 pb-8 border-b border-zinc-800">
          {/* <div>
            <h1 className="text-3xl font-black tracking-tighter text-white flex items-center gap-2">
              <ShieldCheck className="text-emerald-500" size={32} />
              SOROBAN <span className="text-emerald-500">ESCROW</span>
            </h1>
            <p className="text-zinc-500 text-sm font-medium">
              Decentralized Trust-as-a-Service
            </p>
          </div> */}

          <div className="flex gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => setView("search")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                view === "search"
                  ? "bg-zinc-800 text-white shadow-xl"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setView("create")}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                view === "create"
                  ? "bg-zinc-800 text-white shadow-xl"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              New Contract
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 gap-8">
          {view === "search" ? (
            <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              {/* Search Bar */}
              <div className="relative group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-emerald-500 transition-colors"
                  size={20}
                />
                <input
                  type="number"
                  placeholder="Search ID"
                  value={escrowId}
                  onChange={(e) => setEscrowId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-5 pl-12 pr-32 text-xl font-bold focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                />
                <button
                  onClick={() => fetchEscrow()}
                  disabled={!escrowId || loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-500 hover:bg-cyan-400 text-black font-black px-6 py-2 rounded-xl text-sm transition-all disabled:opacity-50"
                >
                  {loading ? "FETCHING..." : "LOAD"}
                </button>
              </div>

              {/* User Dashboard Indices */}
              {connectedAddress && (
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <History size={16} className="text-emerald-500" />
                      My Escrow Activity
                    </h3>
                    <div className="flex gap-1 bg-black p-1 rounded-lg border border-zinc-800">
                      <button
                        onClick={() => setDashboardTab("sent")}
                        className={`px-3 py-1 text-[10px] font-bold rounded ${
                          dashboardTab === "sent"
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-600"
                        }`}
                      >
                        SENT
                      </button>
                      <button
                        onClick={() => setDashboardTab("received")}
                        className={`px-3 py-1 text-[10px] font-bold rounded ${
                          dashboardTab === "received"
                            ? "bg-zinc-800 text-white"
                            : "text-zinc-600"
                        }`}
                      >
                        RECEIVED
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(dashboardTab === "sent"
                      ? userCreatedIds
                      : userReceivedIds
                    ).length > 0 ? (
                      (dashboardTab === "sent"
                        ? userCreatedIds
                        : userReceivedIds
                      ).map((id) => (
                        <button
                          key={id.toString()}
                          onClick={() => fetchEscrow(id.toString())}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
                            escrowId === id.toString()
                              ? "bg-cyan-500/10 border-cyan-500 text-cyan-400"
                              : "bg-black border-zinc-800 hover:border-zinc-600 text-zinc-400"
                          }`}
                        >
                          {dashboardTab === "sent" ? (
                            <TrendingUp size={12} />
                          ) : (
                            <TrendingDown size={12} />
                          )}
                          ID #{id.toString()}
                        </button>
                      ))
                    ) : (
                      <p className="text-zinc-600 text-xs italic py-2">
                        No escrows found in this category.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {escrowDetail ? (
                <div className="bg-zinc-900 border border-zinc-800 md:rounded-[2.5rem] rounded-[2rem] overflow-hidden shadow-2xl shadow-black">
                  <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                        Contract Asset
                      </span>
                      <h2 className="text-4xl font-black text-white">
                        {(Number(escrowDetail.amount) / 1e7).toFixed(2)}{" "}
                        <span className="text-lg text-zinc-500">USDC</span>
                      </h2>
                    </div>
                    <div className="text-right">
                      <div
                        className={`px-4 py-1 rounded-full text-xs font-black uppercase border ${
                          escrowDetail.status === 1
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}
                      >
                        {getStatus(escrowDetail.status)}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 md:p-5 grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-zinc-800 rounded-lg">
                          <TrendingUp size={16} className="text-rose-400" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase">
                            Sender
                          </p>
                          <p className="text-sm font-mono text-zinc-300">
                            {stellar.formatAddress(escrowDetail.sender)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-zinc-800 rounded-lg">
                          <TrendingDown
                            size={16}
                            className="text-emerald-400"
                          />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-zinc-500 uppercase">
                            Primary Recipient
                          </p>
                          <p className="text-sm font-mono text-zinc-300">
                            {stellar.formatAddress(
                              escrowDetail.recipients[0][0]
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-black/40 rounded-3xl p-6 border border-zinc-800/50 flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-bold text-zinc-400">
                          Lock Mechanism
                        </p>
                        {escrowDetail.status === 1 ? (
                          <Unlock size={14} className="text-emerald-500" />
                        ) : (
                          <Lock size={14} className="text-amber-500" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-300 font-bold">
                        Release Date:
                      </p>
                      <p className="text-sm text-zinc-500 mb-2">
                        {new Date(
                          Number(escrowDetail.deadline) * 1000
                        ).toLocaleString()}
                      </p>

                      {/* Dynamic Status Helper Text */}
                      <div className="pt-2 border-t border-zinc-800/50">
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter">
                          {escrowDetail.status === 0 &&
                          Math.floor(Date.now() / 1000) <
                            Number(escrowDetail.deadline)
                            ? "Waiting for time-lock to expire..."
                            : escrowDetail.status === 0
                            ? "Pending sender approval..."
                            : "Funds available for claim"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 md:p-6 bg-zinc-950/50 flex flex-wrap gap-4">
                    {/* APPROVE */}
                    {escrowDetail.status === 0 &&
                      escrowDetail.sender === connectedAddress &&
                      Math.floor(Date.now() / 1000) >=
                        Number(escrowDetail.deadline) && (
                        <button
                          onClick={() => handleAction("approve")}
                          className="flex-1 bg-white text-black font-black py-4 rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                        >
                          <ShieldCheck size={20} /> APPROVE RELEASE
                        </button>
                      )}

                    {/* CLAIM */}
                    {escrowDetail.status === 1 &&
                      escrowDetail.recipients.some(
                        (r: any) => r[0] === connectedAddress
                      ) && (
                        <button
                          onClick={() => handleAction("claim")}
                          className="flex-1 bg-emerald-500 text-black font-black py-4 rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                        >
                          <BiCoinStack size={20} /> CLAIM FUNDS
                        </button>
                      )}

                    {/* REFUND */}
                    {(escrowDetail.status === 0 || escrowDetail.status === 1) &&
                      escrowDetail.sender === connectedAddress && (
                        <button
                          onClick={() => handleAction("refund")}
                          className="px-8 border border-zinc-800 text-zinc-400 font-bold rounded-xl hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/20 transition-all"
                        >
                          REFUND
                        </button>
                      )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-[3rem]">
                  <History size={48} className="mx-auto text-zinc-800 mb-4" />
                  <p className="text-zinc-500 font-bold">
                    Connect wallet to view your escrow history
                  </p>
                </div>
              )}
            </section>
          ) : (
            /* CREATE VIEW */
            <section className="bg-zinc-900 border border-zinc-800 rounded-[1.2rem] md:rounded-4xl p-3 md:p-5 space-y-8 animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-emerald-500/10 rounded-2xl">
                    <PlusCircle className="text-emerald-500" size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">
                      Deploy New Escrow
                    </h2>
                    <p className="text-zinc-500 text-sm">
                      Secure your trade with automated on-chain enforcement.
                    </p>
                  </div>
                </div>

                {/* Wallet Balance Chip */}
                <div className="hidden md:flex flex-col items-end">
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    Available Balance
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-lg font-mono font-bold text-white">
                      {usdcBalance}{" "}
                      <span className="text-xs text-zinc-500">USDC</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-6">
                {/* Recipient Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase ml-2">
                    Recipient Public Key
                  </label>
                  <input
                    className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-sm font-mono outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    placeholder="G..."
                    value={createForm.recipient}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        recipient: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Deposit Input with Balance Label */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center ml-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase">
                        Deposit (USDC)
                      </label>
                      <button
                        onClick={() =>
                          setCreateForm({ ...createForm, amount: usdcBalance })
                        }
                        className="text-[9px] font-black text-emerald-500 hover:text-emerald-400 transition-colors uppercase tracking-tighter"
                      >
                        Use Max
                      </button>
                    </div>
                    <input
                      type="number"
                      className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-lg font-bold outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                      placeholder="0.00"
                      value={createForm.amount}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, amount: e.target.value })
                      }
                    />
                    {/* Mobile-only balance view */}
                    <p className="md:hidden text-[10px] text-zinc-500 font-bold ml-2">
                      Wallet: {usdcBalance} USDC
                    </p>
                  </div>

                  {/* Lock Period Input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase ml-2">
                      Lock Period (Days)
                    </label>
                    <input
                      type="number"
                      className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-lg font-bold outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                      placeholder="7"
                      value={createForm.deadlineDays}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          deadlineDays: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                {/* Deploy Button */}
                <button
                  onClick={() => handleAction("create")}
                  disabled={
                    loading ||
                    !connectedAddress ||
                    parseFloat(createForm.amount) > parseFloat(usdcBalance)
                  }
                  className="group relative w-full overflow-hidden rounded-2xl border border-emerald-500/30 bg-zinc-950 py-5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed hover:border-emerald-500/60 hover:bg-emerald-500/5"
                >
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    {loading ? (
                      <RefreshCcw
                        className="animate-spin text-emerald-500"
                        size={20}
                      />
                    ) : parseFloat(createForm.amount) >
                      parseFloat(usdcBalance) ? (
                      <AlertCircle className="text-rose-500" size={20} />
                    ) : (
                      <Lock className="text-emerald-500" size={20} />
                    )}
                    <span className="text-lg font-black tracking-[0.15em] text-emerald-500 uppercase">
                      {loading
                        ? "Initializing..."
                        : parseFloat(createForm.amount) >
                          parseFloat(usdcBalance)
                        ? "Insufficient Balance"
                        : "Deploy & Deposit"}
                    </span>
                  </div>
                </button>
              </div>
            </section>
          )}

          <AnimatePresence>
            {txStatus && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-4 rounded-2xl flex items-center justify-between gap-4 border ${
                  txStatus.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : txStatus.type === "error"
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                }`}
              >
                <div className="flex items-center gap-3 font-bold text-sm">
                  <AlertCircle size={18} />
                  {txStatus.msg}
                </div>

                <div className="flex items-center gap-2">
                  {txStatus.hash && (
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${txStatus.hash}`}
                      target="_blank"
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <ExternalLink size={18} />
                    </a>
                  )}
                  {/* Manual close button */}
                  <button
                    onClick={() => setTxStatus(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {!connectedAddress && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-xs px-4 z-100">
            <button
              onClick={() =>
                walletsKit.openModal({
                  onWalletSelected: async (option) => {
                    const { address } = await walletsKit.getAddress();
                    setAddress(address);
                    return option;
                  },
                })
              }
              className="group relative w-full overflow-hidden rounded-2xl bg-zinc-950 p-[1.5px] transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)]"
            >
              <div className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#10b981_0%,#064e3b_50%,#10b981_100%)]" />

              <div className="relative flex h-full w-full items-center justify-center gap-3 rounded-[15px] bg-zinc-950 px-8 py-4 transition-all group-hover:bg-zinc-900/50 backdrop-blur-xl">
                <FaWallet className="text-emerald-500 text-lg shrink-0" />

                <span className="text-sm font-black tracking-widest text-emerald-500 uppercase leading-none">
                  Connect Wallet
                </span>

                <div className="absolute inset-0 flex h-full w-full justify-center transform-[skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:transform-[skew(-12deg)_translateX(100%)]">
                  <div className="relative h-full w-8 bg-white/10" />
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
