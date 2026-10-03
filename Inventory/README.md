# GrazeOn Stock Plan

Works out how many bags to order so we can cover the subscriptions we already owe plus
what the website, TikTok and wholesale keep selling — and whether we have the printed
pouches to actually fill them.

```
python3 stockplan.py            # dashboard at http://127.0.0.1:8766/
python3 stockplan.py --report   # plain-text table, no browser
python3 stockplan.py --json     # raw numbers for a spreadsheet
python3 test_stockplan.py       # checks the math, no Shopify token needed
```

`--report` also takes `--lead=30 --cover=30 --window=90`.

## Setup

The tool reads live data from the Shopify Admin API, so it needs credentials once.

Shopify now creates custom apps in the **Dev Dashboard**, which no longer shows a
permanent access token. Instead the app has a **client id** and **client secret**, and the
tool trades those for a short-lived token on each run (the Client Credentials Grant).
Older custom apps that still show a `shpat_` token keep working — put it in `token`.

1. Shopify **Dev Dashboard** → your app → **API access / scopes**. Tick `read_orders`,
   `read_products`, `read_inventory`. Add `read_all_orders` if you want more than 60 days
   of history. **Save.**
2. **Install the app on the store.** This is the step that is easy to miss: client
   credentials only work against a store the app is actually installed on. Without it
   the token request fails with `app_not_installed`.
3. Copy the **client id** and **client secret** (`shpss_…`).
4. `cp config.example.json config.json` and paste them in. The store is the
   `.myshopify.com` domain (`bb0714-49.myshopify.com`), not `grazeon.co`.

```json
{
  "store": "bb0714-49.myshopify.com",
  "client_id": "…",
  "client_secret": "shpss_…"
}
```

`config.json` is gitignored — credentials never get committed. `SHOPIFY_STORE`,
`SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` and `SHOPIFY_TOKEN` override the file.

If you change scopes after installing, save **and reinstall** — otherwise the new scopes
are not on the token and queries come back `ACCESS_DENIED`.

### When it will not connect

`stockplan.py` names the cause rather than passing Shopify's generic message through:

| What it says | What to do |
|---|---|
| `app_not_installed` | Install the app on the store (step 2). |
| `invalid_client` | Client id and secret are from different apps, or another store. |
| `that is the client id, not a token` | Add `client_secret` alongside it. |
| `Shopify denied part of the query` | A scope is missing; add it, save, reinstall. |

## What it does with the numbers

Demand is split into three streams, because they behave differently:

- **Subscription** — Appstle recurring orders plus first orders placed on a selling plan.
  This is the committed part: those bags are already promised.
- **Website** — online store, Shop, TikTok, POS, ordinary draft orders.
- **Wholesale** — Faire and Shopify Collective. Lumpy, large, and worth seeing separately.

For each flavor it works out units per day, then:

```
order = rate × (lead time + cover) + safety stock − on hand
safety stock = z × σ(daily sales) × √(lead time + cover)
reorder point = rate × lead time + z × σ × √(lead time)
```

**Rate basis** decides which pace to plan on. *Faster of the two* (the default) takes the
higher of the full-window rate and the last 30 days, so a flavor that is picking up does
not get under-ordered. *Full window* is steadier; *Last 30 days* reacts hardest.
**Apply trend** additionally scales by the last 30 days against the 30 before that,
clamped to between 0.5× and 2×.

A flavor is **Order now** when it runs out before a fresh order could land, and
**Reorder** once it drops past the reorder point.

If Shopify hands back less history than the window asked for — which it will on the
plain `read_orders` scope, capped at 60 days — the tool plans on the span it actually
received and says so at the top. It does not divide 60 days of sales by a 90-day window,
which would quietly understate demand by a third.

## What it deliberately ignores

The Shopify order list holds more than sales, and counting the wrong rows would inflate
the sell-through rate badly. Left out:

- **Pouch draft orders** (the Foshan Baishen 2oz bags product). These record pouches being
  consumed in a bagging run, not bags sold. They feed the pouch table instead.
- **Internal orders** tagged `Internal Use` or `no fulfillment necessary`, and the
  `Master Case — Wholesale Shipping` placeholder.
- **Gift cards and shipping protection.**
- **Variety pack parents.** Simple Bundles already explodes a 7-pack into seven individual
  bag line items, so the components are counted and the parent is skipped. Counting both
  would double every bundle sold.
- Cancelled and test orders.

Whatever got dropped is reported at the bottom of the dashboard, so the exclusions stay
visible rather than silently shrinking the numbers.

## Pouches

Pouch cover is measured against how fast the matching bag *sells*, which is the rate
pouches get consumed over time — not against the last bagging run, which is lumpy.
A flavor is flagged `caps production` when the pouches run short before the bags do,
meaning the pouch is the real constraint however much jerky is ready.

Pouch flavour names are matched to bag products by folding both to a comparable key, so
`Salt and Pepper` finds `saltpepper2oz` and `Jalapeño` finds `jalapeno2oz`. If a new
flavor ever fails to match it shows a zero bag rate — that is the signal to check the
naming.

## Adding a flavor

Nothing to edit: any active, inventory-tracked product with a price above zero is picked
up automatically. New non-stock products (another insurance plan, say) or new variety
packs need their product ID added to `NON_PRODUCT_IDS` or `BUNDLE_PRODUCT_IDS` at the top
of `stockplan.py`, or they will be read as bag demand.

## Tests

`test_stockplan.py` runs the planner over `_fixture.py`, a real pull of 46 orders from
2026-09-22 that includes the awkward cases on purpose — pouch drafts, internal orders, a
Faire wholesale order, bundle orders and the master-case placeholder. It checks the
exclusions hold, that hand-computed rates come out right, that every pouch matches a bag,
and that the settings actually move the recommendation. No token required.
