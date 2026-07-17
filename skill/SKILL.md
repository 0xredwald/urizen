---
name: urizen
description: Price, buy, hold and mirror URIZEN ($URI) — the first autonomous fund on Robinhood Chain, allocating across tokenized stocks, RWAs and crypto 24/7.
emoji: "▚"
homepage: https://urizen.fund
---

# URIZEN — the autonomous fund, as a skill

URIZEN ($URI) is the first autonomous fund on **Robinhood Chain** (chain 4663). It runs rules-based
strategies across the on-chain stock market — tokenized NVDA, AAPL, the Magnificent Seven, SPY/QQQ —
plus real-world assets and crypto, from a non-custodial vault (can-trade, **cannot-withdraw**). This
skill lets any agent read the fund's live state and route value into it.

## Token

- Symbol: **$URI** · Name: Urizen · Decimals: 18
- Address: `0x970078468807853bc316432e745165eb34398ba3`
- Chain: Robinhood Chain (id **4663**) · WETH-paired · pool `0xdb1548…c10d`

## What agents can do

All endpoints are public, key-less, CORS-open, and live under `https://urizen.fund`:

| Capability | Call |
|---|---|
| **Price / stats** | `GET /api/fund/stats` — price, market cap, liquidity, holders |
| **Positions / NAV** | `GET /api/fund/book` — the fund's live tokenized-equity + crypto book |
| **Live execution** | `GET /api/fund/trades` — the fund's on-chain fills |
| **Strategies** | `GET /api/fund/strategies` — the autonomous mandates it runs |
| **Quote + buy** | `GET /api/fund/quote?side=buy&amount=0.01&taker=0x…` — est-out + a ready-to-sign swap tx |
| **This manifest** | `GET /api/skill` |

## Buy

- Natural language: **`@bankrbot buy $URI`**
- App: **https://ctrl.build/urizen** (connect wallet → buy on Robinhood Chain; native ETH in, no approval)

## Positioning

Robinhood put the stock market on-chain and open 24/7. URIZEN is the fund built for it — the liquid,
one-token way to own an autonomously-managed book of the on-chain stock market that never closes.
