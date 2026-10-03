#!/usr/bin/env python3
"""GrazeOn Stock Plan.

Run:  python3 stockplan.py            # dashboard at http://127.0.0.1:8766/
      python3 stockplan.py --report   # plain-text table in the terminal

Answers "how much should we order?" by splitting demand into the part that is already
committed (active subscriptions) and the part that is not (website, TikTok, wholesale),
then comparing both against what Shopify says is on hand -- for finished jerky bags and
for the printed pouches that gate how many bags we can make.

Needs a Shopify Admin API token; see config.example.json. Standard library only; the
Shopify call goes through the system curl so macOS certificates just work.
"""
import http.server, json, math, os, re, statistics, subprocess, sys, threading, time, urllib.parse, webbrowser
from collections import defaultdict
from datetime import datetime, timedelta, timezone

PORT = int(os.environ.get("STOCKPLAN_PORT", "8766"))
HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, "GrazeOnStockPlan.html")
CONFIG = os.path.join(HERE, "config.json")
CACHE = {}
LOCK = threading.Lock()
CACHE_TTL = 300

# Shopify records more than sales in the order list. These never represent a bag
# leaving the building, so they must not feed the sell-through rate.
PACKAGING_PRODUCT_ID = "9297919443158"          # 2oz pouches from Foshan Baishen
NON_PRODUCT_IDS = {
    "9125189550294",   # gift card
    "9004616614102",   # shipping protection (fixed)
    "9004616646870",   # shipping protection (percentage)
    "9485448773846",   # master case -- wholesale shipping placeholder
    "10311806189782",  # personal item
}
# Variety packs. Simple Bundles explodes these into component bag line items on the
# order, so counting the bundle product too would double-count every bundle sold.
BUNDLE_PRODUCT_IDS = {"9237870444758", "9250795880662", "9250924069078"}
INTERNAL_TAGS = {"internal use", "no fulfillment necessary"}

SUBSCRIPTION_SOURCES = {"subscription_contract_checkout_one"}
WHOLESALE_SOURCES = {"faire", "shopify-collective-automatic-payments"}

DEFAULTS = {
    "window_days": 90,      # history used for the sell-through rate
    "lead_time_days": 30,   # order placed -> stock on the shelf
    "coverage_days": 30,    # how much cover to hold on top of lead time
    "service_level": 0.95,  # drives safety stock
    "rate_mode": "conservative",
    "growth_adjust": False,
}
# z-scores for the service levels the UI offers.
Z = {0.50: 0.00, 0.80: 0.84, 0.90: 1.28, 0.95: 1.65, 0.975: 1.96, 0.99: 2.33}


def z_for(level):
    """Nearest tabulated z. Snapping beats silently falling back to the 95% default,
    which would quietly plan a 99% request at 95%."""
    return Z[min(Z, key=lambda k: abs(k - level))]


# ---------- config ----------
def load_config():
    """Two ways in. Apps made in the Dev Dashboard no longer show a permanent token, so
    they hand over a client id and secret and we trade those for a short-lived one.
    Older custom apps that still show a shpat_ token keep working unchanged."""
    cfg = {"api_version": "2026-07"}
    if os.path.exists(CONFIG):
        try:
            with open(CONFIG) as f:
                cfg.update(json.load(f))
        except (OSError, ValueError) as e:
            die("could not read config.json: %s" % e)

    cfg["store"] = (os.environ.get("SHOPIFY_STORE") or cfg.get("store") or "").strip()
    cfg["token"] = (os.environ.get("SHOPIFY_TOKEN") or cfg.get("token") or "").strip()
    cfg["client_id"] = (os.environ.get("SHOPIFY_CLIENT_ID") or cfg.get("client_id") or "").strip()
    cfg["client_secret"] = (os.environ.get("SHOPIFY_CLIENT_SECRET")
                            or cfg.get("client_secret") or "").strip()
    # The Dev Dashboard calls it a client secret; people paste it into "token" anyway.
    if not cfg["client_secret"] and cfg["token"].startswith("shpss_"):
        cfg["client_secret"], cfg["token"] = cfg["token"], ""

    if not cfg["store"]:
        die("no store in config.json. Use the .myshopify.com domain, e.g. bb0714-49.myshopify.com.")
    cfg["store"] = cfg["store"].replace("https://", "").replace("http://", "").strip("/")

    try:
        cfg["mode"] = auth_mode(cfg)
    except ValueError as e:
        die(str(e))
    return cfg


def auth_mode(cfg):
    """Decide how to authenticate, or explain what is missing. Raises ValueError."""
    if cfg["token"].startswith("shpat_"):
        return "token"
    if cfg["client_id"] and cfg["client_secret"]:
        if not cfg["client_secret"].startswith("shpss_"):
            raise ValueError("client_secret does not look right (expected it to start with shpss_).")
        return "oauth"
    if cfg["token"]:
        raise ValueError(describe_wrong_token(cfg["token"]))
    raise ValueError(
        "missing Shopify credentials. Put either of these in config.json:\n"
        "  - client_id + client_secret  (apps made in the Dev Dashboard)\n"
        "  - token                      (older custom apps, starts with shpat_)\n"
        "See README.md, or set them in the environment instead.")


def describe_wrong_token(tok):
    """Name the secret that was pasted, rather than letting Shopify answer
    'invalid API key' and leave the reason to guesswork."""
    if tok.startswith("shpca_") or tok.startswith("shppa_"):
        return ("that looks like a storefront or partner token. This needs either an Admin API\n"
                "access token (shpat_) or a client id + client secret pair.")
    if len(tok) == 32 and all(c in "0123456789abcdef" for c in tok.lower()):
        return ("that is the client id, not a token. Add the client secret alongside it as\n"
                "\"client_secret\": \"shpss_...\" and the tool will fetch a token itself.")
    return ("token does not look like an Admin API access token (should start with shpat_).\n"
            "Dev Dashboard apps do not show one -- use client_id + client_secret instead.")


def die(msg):
    print("stockplan: " + msg, file=sys.stderr)
    sys.exit(1)


# ---------- auth ----------
_TOKEN = {"value": "", "expires": 0.0}

OAUTH_HINTS = {
    "app_not_installed":
        "the app exists but is not installed on this store.\n"
        "In the Dev Dashboard open the app, then install it on %s.\n"
        "Client credentials only work once the app is installed.",
    "invalid_client":
        "the store did not accept that client id / client secret pair.\n"
        "Check both are from the same app, and that the app belongs to %s.",
    "invalid_request":
        "the store rejected the token request. Confirm the app is installed on %s\n"
        "and that its Admin API scopes have been saved.",
}


def oauth_error(text):
    """Shopify answers these with an HTML page whose title carries the real reason."""
    m = re.search(r"Oauth error (\w+)", text) or re.search(r"<title>[^<]*?(\w+)</title>", text)
    return m.group(1) if m else ""


def access_token(cfg):
    """Current Admin API token, trading client credentials for one when needed."""
    if cfg["mode"] == "token":
        return cfg["token"]
    with LOCK:
        if _TOKEN["value"] and time.time() < _TOKEN["expires"]:
            return _TOKEN["value"]
    url = "https://%s/admin/oauth/access_token" % cfg["store"]
    body = json.dumps({"client_id": cfg["client_id"], "client_secret": cfg["client_secret"],
                       "grant_type": "client_credentials"})
    p = subprocess.run(["curl", "-sS", "-m", "30", "-X", "POST", url,
                        "-H", "Content-Type: application/json", "--data-binary", "@-"],
                       input=body, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError("could not reach Shopify for a token: " + (p.stderr or "").strip())
    try:
        r = json.loads(p.stdout)
    except ValueError:
        code = oauth_error(p.stdout)
        hint = OAUTH_HINTS.get(code)
        raise RuntimeError(("Shopify refused the token request (%s).\n" % (code or "unknown")) +
                           ((hint % cfg["store"]) if hint else p.stdout[:200]))
    if "access_token" not in r:
        raise RuntimeError("Shopify did not return a token: " + json.dumps(r)[:300])
    with LOCK:
        _TOKEN["value"] = r["access_token"]
        # Refresh a minute early rather than racing the expiry mid-run.
        _TOKEN["expires"] = time.time() + max(60, int(r.get("expires_in", 3600))) - 60
    return _TOKEN["value"]


# ---------- Shopify ----------
def graphql(cfg, query, variables=None):
    url = "https://%s/admin/api/%s/graphql.json" % (cfg["store"], cfg["api_version"])
    body = json.dumps({"query": query, "variables": variables or {}})
    cmd = ["curl", "-sS", "--compressed", "-m", "60", "-X", "POST", url,
           "-H", "X-Shopify-Access-Token: " + access_token(cfg),
           "-H", "Content-Type: application/json",
           "--data-binary", "@-"]
    p = subprocess.run(cmd, input=body, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError("curl failed: " + (p.stderr or "").strip())
    try:
        out = json.loads(p.stdout)
    except ValueError:
        raise RuntimeError("Shopify returned non-JSON: " + p.stdout[:300])
    if out.get("errors"):
        msg = json.dumps(out["errors"])
        if "ACCESS_DENIED" in msg or "access denied" in msg.lower():
            raise RuntimeError("Shopify denied part of the query -- the app is probably missing a\n"
                               "scope. It needs read_orders, read_products and read_inventory.\n"
                               "Add them, save, reinstall the app, then try again.\n" + msg[:300])
        raise RuntimeError("Shopify error: " + msg[:400])
    return out["data"]


ORDERS_Q = """
query($q: String!, $after: String) {
  orders(first: 100, query: $q, sortKey: CREATED_AT, reverse: true, after: $after) {
    edges { node {
      name createdAt sourceName tags cancelledAt test
      lineItems(first: 50) { edges { node {
        quantity
        product { id }
        variant { id title }
        sellingPlan { sellingPlanId }
      } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}
"""

PRODUCTS_Q = """
query($after: String) {
  products(first: 100, after: $after, query: "status:ACTIVE OR status:UNLISTED") {
    edges { node {
      id title handle status productType totalInventory
      variants(first: 30) { edges { node {
        id title sku price inventoryQuantity
        inventoryItem { tracked }
      } } }
    } }
    pageInfo { hasNextPage endCursor }
  }
}
"""


def gid_num(gid):
    return gid.rsplit("/", 1)[-1] if gid else ""


def fetch_orders(cfg, window_days):
    since = (datetime.now(timezone.utc) - timedelta(days=window_days)).strftime("%Y-%m-%d")
    orders, after = [], None
    while True:
        data = graphql(cfg, ORDERS_Q, {"q": "created_at:>=%s" % since, "after": after})
        conn = data["orders"]
        for e in conn["edges"]:
            n = e["node"]
            orders.append({
                "name": n["name"],
                "createdAt": n["createdAt"],
                "source": n.get("sourceName") or "",
                "tags": n.get("tags") or [],
                "cancelled": bool(n.get("cancelledAt")),
                "test": bool(n.get("test")),
                "lines": [{
                    "qty": li["node"]["quantity"],
                    "product_id": gid_num((li["node"].get("product") or {}).get("id")),
                    "variant_id": gid_num((li["node"].get("variant") or {}).get("id")),
                    "variant_title": (li["node"].get("variant") or {}).get("title") or "",
                    "subscription": bool(li["node"].get("sellingPlan")),
                } for li in n["lineItems"]["edges"]],
            })
        if not conn["pageInfo"]["hasNextPage"]:
            return orders
        after = conn["pageInfo"]["endCursor"]


def fetch_products(cfg):
    items, after = [], None
    while True:
        data = graphql(cfg, PRODUCTS_Q, {"after": after})
        conn = data["products"]
        for e in conn["edges"]:
            n = e["node"]
            items.append({
                "id": gid_num(n["id"]),
                "title": n["title"],
                "handle": n["handle"],
                "status": n["status"],
                "product_type": n.get("productType") or "",
                "variants": [{
                    "id": gid_num(v["node"]["id"]),
                    "title": v["node"]["title"],
                    "sku": v["node"].get("sku") or "",
                    "price": float(v["node"].get("price") or 0),
                    "on_hand": v["node"].get("inventoryQuantity") or 0,
                    "tracked": bool((v["node"].get("inventoryItem") or {}).get("tracked")),
                } for v in n["variants"]["edges"]],
            })
        if not conn["pageInfo"]["hasNextPage"]:
            return items
        after = conn["pageInfo"]["endCursor"]


# ---------- classification ----------
def flavor_key(text):
    """Fold a flavor name to a comparable key: 'Salt and Pepper' and 'saltpepper2oz'
    both become 'saltpepper', so a pouch variant can be matched to its bag product."""
    t = (text or "").lower()
    for a, b in (("ñ", "n"), ("é", "e"), ("í", "i"), ("á", "a"), ("ó", "o"), ("ú", "u")):
        t = t.replace(a, b)
    t = "".join(c for c in t if c.isalnum())
    for junk in ("2oz", "20oz", "beefjerkycrisps", "grazeon"):
        t = t.replace(junk, "")
    if t.startswith("and"):
        t = t[3:]
    return t.replace("and", "")


def split_catalog(products):
    """Sort the catalog into finished bags, pouches, and things that are not stock."""
    finished, packaging = [], []
    for p in products:
        if p["id"] == PACKAGING_PRODUCT_ID:
            for v in p["variants"]:
                packaging.append({
                    "variant_id": v["id"], "flavor": v["title"],
                    "key": flavor_key(v["title"]), "on_hand": v["on_hand"],
                })
            continue
        if p["id"] in NON_PRODUCT_IDS or p["id"] in BUNDLE_PRODUCT_IDS:
            continue
        if p["status"] != "ACTIVE":
            continue
        for v in p["variants"]:
            if not v["tracked"] or v["price"] <= 0:
                continue
            finished.append({
                "variant_id": v["id"], "product_id": p["id"],
                "title": p["title"], "handle": p["handle"],
                "flavor": short_name(p["title"], p["handle"]),
                "key": flavor_key(p["handle"]),
                "sku": v["sku"], "price": v["price"], "on_hand": v["on_hand"],
            })
    return finished, packaging


def short_name(title, handle):
    """'GrazeOn Salt and Pepper Beef Jerky Crisps- ... - 2.0 oz' -> 'Salt and Pepper'."""
    t = title
    if t.lower().startswith("grazeon "):
        t = t[8:]
    for cut in (" Beef Jerky Crisps", " Beef Jerky"):
        i = t.find(cut)
        if i > 0:
            return t[:i].strip()
    return (handle or title).strip()


def channel_of(order, line):
    """Which demand stream a line belongs to. Subscription is the committed part."""
    if order["source"] in SUBSCRIPTION_SOURCES or line["subscription"]:
        return "subscription"
    if order["source"] in WHOLESALE_SOURCES:
        return "wholesale"
    return "direct"


def is_real_sale(order):
    if order["test"] or order["cancelled"]:
        return False
    tags = {t.strip().lower() for t in order["tags"]}
    return not (tags & INTERNAL_TAGS)


def build_demand(orders, window_days, now=None):
    """Daily units per finished variant per channel, plus pouches consumed.

    Packaging lines are recorded as draft orders when bags get filled, so they measure
    pouch consumption rather than sales and are kept out of the sell-through rate.
    """
    now = now or datetime.now(timezone.utc)
    # Window as whole calendar days ending today, so it lines up exactly with the day
    # buckets rate() walks. A timestamp cutoff here would clip the oldest day.
    start_date = (now - timedelta(days=window_days - 1)).date()
    daily = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))  # vid -> day -> chan -> qty
    pouch_used = defaultdict(int)
    skipped = defaultdict(int)
    oldest = None

    for o in orders:
        when = datetime.strptime(o["createdAt"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        if when.date() < start_date or when > now:
            continue
        if not is_real_sale(o):
            skipped["internal orders"] += 1
            continue
        day = when.date().isoformat()
        if oldest is None or when < oldest:
            oldest = when
        for li in o["lines"]:
            pid, vid, qty = li["product_id"], li["variant_id"], li["qty"]
            if not pid or not vid:
                skipped["lines with no product"] += 1
                continue
            if pid == PACKAGING_PRODUCT_ID:
                pouch_used[flavor_key(li["variant_title"])] += qty
                continue
            if pid in NON_PRODUCT_IDS:
                skipped["non-stock items"] += 1
                continue
            if pid in BUNDLE_PRODUCT_IDS:
                skipped["bundle parents"] += 1
                continue
            daily[vid][day][channel_of(o, li)] += qty
    span = (now.date() - oldest.date()).days + 1 if oldest else 0
    return daily, dict(pouch_used), dict(skipped), span


# ---------- planning ----------
def rate(daily_for_variant, days, end, channel=None):
    """Units per day over the `days` ending at `end`, counting empty days as zero."""
    if days <= 0:
        return 0.0
    total = 0
    for i in range(days):
        d = (end - timedelta(days=i)).date().isoformat()
        buckets = daily_for_variant.get(d)
        if not buckets:
            continue
        total += sum(buckets.values()) if channel is None else buckets.get(channel, 0)
    return total / days


def daily_series(daily_for_variant, days, end):
    out = []
    for i in range(days):
        d = (end - timedelta(days=i)).date().isoformat()
        out.append(sum(daily_for_variant.get(d, {}).values()))
    return out


def plan_variant(item, daily_for_variant, s, now):
    window, lead, cover = s["window_days"], s["lead_time_days"], s["coverage_days"]
    horizon = lead + cover
    z = z_for(s["service_level"])

    r_window = rate(daily_for_variant, window, now)
    r_30 = rate(daily_for_variant, min(30, window), now)
    r_prev30 = rate(daily_for_variant, min(30, window), now - timedelta(days=30)) if window >= 60 else 0.0
    r_sub = rate(daily_for_variant, window, now, "subscription")
    r_dir = rate(daily_for_variant, window, now, "direct")
    r_whl = rate(daily_for_variant, window, now, "wholesale")

    if s["rate_mode"] == "recent":
        base = r_30
    elif s["rate_mode"] == "window":
        base = r_window
    else:  # conservative: never plan below the recent pace
        base = max(r_window, r_30)

    trend = (r_30 / r_prev30) if r_prev30 > 0 else None
    if s["growth_adjust"] and trend:
        base *= max(0.5, min(2.0, trend))

    series = daily_series(daily_for_variant, window, now)
    sigma = statistics.pstdev(series) if len(series) > 1 else 0.0
    safety = z * sigma * math.sqrt(horizon)

    on_hand = item["on_hand"]
    demand_h = base * horizon
    target = demand_h + safety
    reorder_point = base * lead + z * sigma * math.sqrt(lead)
    suggested = max(0, math.ceil(target - on_hand))

    days_cover = (on_hand / base) if base > 0 else None
    sub_only_cover = (on_hand / r_sub) if r_sub > 0 else None
    sub_commit = r_sub * horizon
    sub_commit_lead = r_sub * lead

    if base <= 0:
        status = "no demand"
    elif days_cover is not None and days_cover < lead:
        status = "critical"
    elif on_hand <= reorder_point:
        status = "reorder"
    elif days_cover is not None and days_cover > horizon + 60:
        status = "overstocked"
    else:
        status = "ok"

    return {
        "variant_id": item["variant_id"], "flavor": item["flavor"], "handle": item["handle"],
        "sku": item["sku"], "price": item["price"], "on_hand": on_hand,
        "rate": round(base, 3), "rate_window": round(r_window, 3), "rate_30": round(r_30, 3),
        "rate_sub": round(r_sub, 3), "rate_direct": round(r_dir, 3), "rate_wholesale": round(r_whl, 3),
        "trend": round(trend, 2) if trend else None,
        "sigma": round(sigma, 2), "safety_stock": math.ceil(safety),
        "demand_horizon": math.ceil(demand_h), "target": math.ceil(target),
        "reorder_point": math.ceil(reorder_point), "suggested_order": suggested,
        "days_cover": round(days_cover, 1) if days_cover is not None else None,
        "stockout_on": (now + timedelta(days=days_cover)).date().isoformat() if days_cover is not None else None,
        "sub_commit_horizon": math.ceil(sub_commit),
        "sub_commit_lead": math.ceil(sub_commit_lead),
        "sub_covered": on_hand >= sub_commit_lead,
        "sub_only_cover": round(sub_only_cover, 1) if sub_only_cover is not None else None,
        "sub_share": round(r_sub / base, 3) if base > 0 else 0.0,
        "status": status,
    }


def build_plan(orders, products, settings=None, now=None):
    s = dict(DEFAULTS)
    s.update(settings or {})
    now = now or datetime.now(timezone.utc)
    finished, packaging = split_catalog(products)
    daily, pouch_used, skipped, span = build_demand(orders, s["window_days"], now)

    # The read_orders scope only reaches back 60 days unless read_all_orders was granted.
    # Dividing a 60-day total by a 90-day window would understate demand by a third, so
    # plan on the history we actually got and say so.
    requested = s["window_days"]
    truncated = 0 < span < requested - 2
    if truncated:
        s = dict(s, window_days=span)

    rows = [plan_variant(it, daily[it["variant_id"]], s, now) for it in finished]
    rows.sort(key=lambda r: (r["days_cover"] if r["days_cover"] is not None else 1e9))

    by_key = {flavor_key(r["handle"]): r for r in rows}
    pack_rows = []
    for p in packaging:
        bag = by_key.get(p["key"])
        r = bag["rate"] if bag else 0.0
        horizon = s["lead_time_days"] + s["coverage_days"]
        need = math.ceil(r * horizon)
        cover = (p["on_hand"] / r) if r > 0 else None
        pack_rows.append({
            "flavor": p["flavor"], "on_hand": p["on_hand"],
            "used_in_window": pouch_used.get(p["key"], 0),
            "bag_rate": round(r, 3),
            "need_horizon": need,
            "suggested_order": max(0, need - p["on_hand"]),
            "days_cover": round(cover, 1) if cover is not None else None,
            "bag_days_cover": bag["days_cover"] if bag else None,
            # A pouch shortfall caps production no matter how the bags look.
            "binding": bool(bag and cover is not None and bag["days_cover"] is not None
                            and cover < bag["days_cover"]),
            "status": pouch_status(p["on_hand"], r, s),
        })
    pack_rows.sort(key=lambda r: (r["days_cover"] if r["days_cover"] is not None else 1e9))

    horizon = s["lead_time_days"] + s["coverage_days"]
    return {
        "generated_at": now.strftime("%Y-%m-%d %H:%M UTC"),
        "settings": s, "horizon_days": horizon,
        "history_days": span, "requested_window": requested, "truncated_history": truncated,
        "finished": rows, "packaging": pack_rows,
        "totals": {
            "on_hand": sum(r["on_hand"] for r in rows),
            "suggested_order": sum(r["suggested_order"] for r in rows),
            "demand_horizon": sum(r["demand_horizon"] for r in rows),
            "sub_commit_horizon": sum(r["sub_commit_horizon"] for r in rows),
            "daily_rate": round(sum(r["rate"] for r in rows), 2),
            "sub_daily_rate": round(sum(r["rate_sub"] for r in rows), 2),
            "direct_daily_rate": round(sum(r["rate_direct"] for r in rows), 2),
            "wholesale_daily_rate": round(sum(r["rate_wholesale"] for r in rows), 2),
            "at_risk": sum(1 for r in rows if r["status"] in ("critical", "reorder")),
            "sub_uncovered": [r["flavor"] for r in rows if not r["sub_covered"]],
            "pouch_order": sum(r["suggested_order"] for r in pack_rows),
        },
        "excluded": skipped,
        "orders_considered": len(orders),
    }


def pouch_status(on_hand, bag_rate, s):
    if bag_rate <= 0:
        return "no demand"
    cover = on_hand / bag_rate
    if cover < s["lead_time_days"]:
        return "critical"
    if cover < s["lead_time_days"] + s["coverage_days"]:
        return "reorder"
    return "ok"


# ---------- data loading ----------
def get_plan(settings, force=False):
    s = dict(DEFAULTS)
    s.update(settings or {})
    key = s["window_days"]
    with LOCK:
        hit = CACHE.get(key)
    if force or not hit or time.time() - hit[0] > CACHE_TTL:
        cfg = load_config()
        orders = fetch_orders(cfg, s["window_days"])
        products = fetch_products(cfg)
        with LOCK:
            CACHE[key] = (time.time(), orders, products)
    _, orders, products = CACHE[key]
    return build_plan(orders, products, s)


# ---------- terminal report ----------
def bar(status):
    return {"critical": "!!", "reorder": " >", "overstocked": " ~", "ok": "  ", "no demand": " -"}.get(status, "  ")


def report(plan):
    s = plan["settings"]
    t = plan["totals"]
    print("\nGrazeOn Stock Plan  %s" % plan["generated_at"])
    print("%d-day history | %d-day lead time | %d-day cover | %d%% service level"
          % (s["window_days"], s["lead_time_days"], s["coverage_days"], s["service_level"] * 100))
    if plan["truncated_history"]:
        print("NOTE: asked for %d days but Shopify returned %d. Planning on %d days -- grant\n"
              "      read_all_orders for a longer history."
              % (plan["requested_window"], plan["history_days"], plan["history_days"]))
    print("Selling %.1f bags/day: %.1f subscription, %.1f website, %.1f wholesale"
          % (t["daily_rate"], t["sub_daily_rate"], t["direct_daily_rate"], t["wholesale_daily_rate"]))
    print("\nFINISHED BAGS                on hand   /day    cover   sub/day   order")
    print("-" * 74)
    for r in plan["finished"]:
        print("%s %-24s %7d %6.2f %7s %8.2f %7d" % (
            bar(r["status"]), r["flavor"][:24], r["on_hand"], r["rate"],
            ("%.0fd" % r["days_cover"]) if r["days_cover"] is not None else "-",
            r["rate_sub"], r["suggested_order"]))
    print("-" * 74)
    print("   %-24s %7d %6.2f %7s %8.2f %7d" % (
        "TOTAL", t["on_hand"], t["daily_rate"], "", t["sub_daily_rate"], t["suggested_order"]))

    print("\nPOUCHES                      on hand   used    cover    order")
    print("-" * 74)
    for r in plan["packaging"]:
        print("%s %-24s %7d %6d %8s %8d%s" % (
            bar(r["status"]), r["flavor"][:24], r["on_hand"], r["used_in_window"],
            ("%.0fd" % r["days_cover"]) if r["days_cover"] is not None else "-",
            r["suggested_order"], "  <- caps production" if r["binding"] else ""))

    if t["sub_uncovered"]:
        print("\nWill not cover subscriptions through the %d-day lead time: %s"
              % (s["lead_time_days"], ", ".join(t["sub_uncovered"])))
    if plan["excluded"]:
        print("\nExcluded from the rate: " + ", ".join("%d %s" % (v, k) for k, v in plan["excluded"].items()))
    print("")


# ---------- server ----------
class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if "/api/" in str(args[0] if args else ""):
            sys.stderr.write("%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args))

    def send_json(self, obj, code=200):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path in ("/", "/index.html", "/GrazeOnStockPlan.html"):
            try:
                with open(HTML, "rb") as f:
                    data = f.read()
            except OSError:
                self.send_error(404, "GrazeOnStockPlan.html not found next to stockplan.py"); return
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif u.path == "/favicon.ico":
            self.send_response(204); self.end_headers()
        elif u.path == "/api/plan":
            q = urllib.parse.parse_qs(u.query)
            try:
                s = {
                    "window_days": int(q.get("window", [DEFAULTS["window_days"]])[0]),
                    "lead_time_days": int(q.get("lead", [DEFAULTS["lead_time_days"]])[0]),
                    "coverage_days": int(q.get("cover", [DEFAULTS["coverage_days"]])[0]),
                    "service_level": float(q.get("service", [DEFAULTS["service_level"]])[0]),
                    "rate_mode": q.get("mode", [DEFAULTS["rate_mode"]])[0],
                    "growth_adjust": q.get("growth", ["0"])[0] in ("1", "true", "yes"),
                }
            except ValueError:
                self.send_json({"error": "bad settings"}, 400); return
            if s["window_days"] < 7 or s["window_days"] > 730:
                self.send_json({"error": "window must be 7-730 days"}, 400); return
            if s["rate_mode"] not in ("window", "recent", "conservative"):
                self.send_json({"error": "mode must be window, recent or conservative"}, 400); return
            try:
                self.send_json(get_plan(s, force=q.get("refresh", ["0"])[0] == "1"))
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
        else:
            self.send_error(404)


def main():
    args = sys.argv[1:]
    if "--report" in args or "--json" in args:
        s = dict(DEFAULTS)
        for a in args:
            if a.startswith("--lead="):
                s["lead_time_days"] = int(a.split("=")[1])
            elif a.startswith("--cover="):
                s["coverage_days"] = int(a.split("=")[1])
            elif a.startswith("--window="):
                s["window_days"] = int(a.split("=")[1])
        try:
            plan = get_plan(s)
        except Exception as e:
            die(str(e))
        if "--json" in args:
            print(json.dumps(plan, indent=2))
        else:
            report(plan)
        return

    if not os.path.exists(HTML):
        die("GrazeOnStockPlan.html not found next to stockplan.py")
    load_config()  # fail fast on a missing token rather than in the browser
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = "http://127.0.0.1:%d/" % PORT
    print("GrazeOn Stock Plan running at %s  (Ctrl-C to stop)" % url)
    if "--no-open" not in args:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
