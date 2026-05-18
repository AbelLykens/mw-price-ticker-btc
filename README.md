# PricemonTicker

A small MediaWiki extension that adds a thin sticky bar to the top of every wiki page, showing the current Bitcoin price in USD and EUR (configurable). The bar auto-refreshes every 15 s and flashes green / red when the price moves.

Data comes from a [pricemon](https://price.cheeserobot.org) instance — a self-hosted Django service that aggregates BTC trades across several exchanges and computes per-minute volume-weighted prices (merging stablecoin-quoted volume into fiat using same-window rates).

## Requirements

- MediaWiki ≥ 1.39 (LTS).
- A reachable pricemon instance exposing `GET /api/current/`. The default points at `https://price.cheeserobot.org`.

## Installation

```sh
cd <mediawiki-root>/extensions
git clone git@github.com:AbelLykens/mw-price-ticker-btc.git PricemonTicker
```

Then load it from `LocalSettings.php`:

```php
wfLoadExtension( 'PricemonTicker' );

// Optional overrides — defaults shown.
// $wgPricemonTickerBase      = 'https://price.cheeserobot.org';
// $wgPricemonTickerRefreshMs = 15000;
// $wgPricemonTickerPairs     = [ [ 'USD', '$' ], [ 'EUR', '€' ] ];
```

Hard-reload a wiki page; the bar should appear within ~1 s.

## Configuration

| Variable | Type | Default | Notes |
| --- | --- | --- | --- |
| `$wgPricemonTickerBase` | string | `https://price.cheeserobot.org` | Base URL of the pricemon instance, no trailing slash. Set to `''` to disable the extension at runtime without unloading it. |
| `$wgPricemonTickerRefreshMs` | int | `15000` | Poll interval in milliseconds. Pricemon's `/api/current/` is uncached and updates on every trade, so 10–30 s is reasonable. |
| `$wgPricemonTickerPairs` | array of `[fiat, symbol]` | `[ [ 'USD', '$' ], [ 'EUR', '€' ] ]` | Each entry renders one chip in the bar, in order. Use any fiat code pricemon emits in `weighted_fiat[]`. |

## How it works

The `BeforePageDisplay` hook exposes the three config vars as JS variables (`wgPricemonTickerBase`, `wgPricemonTickerRefreshMs`, `wgPricemonTickerPairs`) and loads the `ext.pricemonTicker` ResourceLoader module.

On every page, `resources/ticker.js` builds a fixed-position `<div id="pm-ticker">` element, appends it to `<html>`, and polls:

```
GET {base}/api/current/?base=BTC&quote=USD&quote=EUR
```

It reads `weighted_fiat[]` and, for each configured pair, prints the parsed `price` formatted to 2 decimals. A green/red flash fires on price changes. Rows marked `fallback: true` (filled from the most recent minute aggregate because no live+fresh state existed) are dimmed; missing fiats render as an em-dash. When `fetch` fails (network down, CORS blocked) the trailing `· updated …` indicator switches to `· offline`.

Polling pauses while the tab is hidden and resumes (with an immediate poll) on focus, to keep idle background tabs quiet.

## CORS

As of writing, `price.cheeserobot.org` does **not** send `Access-Control-Allow-Origin` headers. If your wiki is on a different origin, the browser will block the `fetch`. Two options:

1. Add `django-cors-headers` to pricemon and allow your wiki origin (scoped to `^/api/.*$`). One-line change on the pricemon side. Recommended.
2. Run the wiki and pricemon on the same origin via a reverse proxy (e.g. nginx routing `/pricemon/*` to the pricemon backend, then set `$wgPricemonTickerBase = 'https://yourwiki.example.com/pricemon';`).

Quick way to check whether CORS will work from your wiki:

```sh
curl -i -H "Origin: https://yourwiki.example.com" \
    "https://price.cheeserobot.org/api/current/?base=BTC&quote=USD&quote=EUR" \
    | grep -i access-control
```

If you see no `Access-Control-Allow-Origin` line, you'll be blocked.

## Files

```
PricemonTicker/
├── extension.json        # manifest v2 — config, hooks, ResourceModules
├── i18n/
│   ├── en.json           # description message
│   └── qqq.json          # message documentation
├── src/
│   └── Hooks.php         # BeforePageDisplay handler
├── resources/
│   ├── ticker.js         # builds the bar, polls /api/current/
│   └── ticker.css        # sticky bar styling
└── README.md
```

## Verifying

1. Clone into `extensions/PricemonTicker/`, add `wfLoadExtension( 'PricemonTicker' );` to `LocalSettings.php`.
2. Hard-reload any wiki page. The bar should appear at the top with two prices (USD + EUR) within ~1 s.
3. Watch 1–2 refresh cycles; the value should change and the up/down colour flash should fire when it moves.
4. Open DevTools → Network and confirm `GET /api/current/?…` returns 200 with the expected JSON. A CORS error in the console means you've hit the caveat above.
5. (Optional) If pricemon temporarily can't compute a live price for a configured fiat, the row should dim (`fallback: true`) rather than disappear.

## License

GPL-2.0-or-later — same as MediaWiki core. See [`LICENSE`](LICENSE).
