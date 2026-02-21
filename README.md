# 🛡️ VaultX | Escrow Protocol

**VaultX** is a decentralized escrow and settlement protocol built on the Stellar Testnet. It allows users to lock funds in smart contracts that enforce "Proof of Agreement," ensuring secure transactions with automated split-payments and time-locked safety nets.

## 🔗 Project Links

| | |
|---|---|
| 🌐 **Live Demo** | [escrow-vault-x.vercel.app](https://escrow-vault-x.vercel.app/) |
| 🎬 **Demo Video** | [YouTube — 1-min walkthrough](https://youtu.be/cCwh-2OHqEE?si=vQmMQsP5C_nQ4X-I) |
| 💻 **Repository** | [github.com/youthisguy/escrow-vaultX](https://github.com/youthisguy/escrow-vaultX) |

---

## ✨ Features

- 🔒 **Secure Escrow** — Funds are held on-chain via Soroban smart contracts
- 📊 **Contract Indexing** — Contract-side indexing for instant "Sent" vs "Received" history
- ✅ **Validation Logic** — Frontend checks for insufficient balances and trustlines before deployment
- ⏱️ **Automated Deadlines** — 7-day default lock periods with automated refund capability

---

## 🛠️ Technical Stack

| Layer | Technology |
|---|---|
| Smart Contract | Rust, Soroban SDK |
| Frontend | Next.js 14, Tailwind CSS, Lucide Icons |
| Blockchain | `@stellar/stellar-sdk`, `@stellar/stellar-wallets-kit` |
| Testing | `cargo test` (Contract), Vitest/Jest (Frontend) |

---

## 📸 Test Output

> ✅ **3 tests passing** — `cargo test --features testutils`

![Test Results](./app/screenshots/test-output.png)

| Test | Description | Result |
|------|-------------|--------|
| `test_create_and_get_escrow` | Verifies escrow initialization and on-chain storage | ✅ Pass |
| `test_create_approve_claim_single_recipient` | Verifies full approve → claim flow with correct fund transfer | ✅ Pass |
| `test_create_fails_on_invalid_percentage_sum` | Verifies contract rejects invalid recipient percentages | ✅ Pass |

---

## 🚀 Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/youthisguy/escrow-vaultX
npm install
```

### 2. Deploy Contract

```bash
soroban contract build
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/vaultx.wasm \
  --source <YOUR_KEY> \
  --network testnet
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.