#!/usr/bin/env python3
"""Checks the planning math against a snapshot of real GrazeOn orders (_fixture.py).

Run: python3 test_stockplan.py     -- no Shopify token needed.

The fixture is a real pull from 2026-09-22 and deliberately includes the things that
must not count as sales: pouch-consumption drafts, internal-use orders, the master-case
shipping placeholder and a variety-pack parent.
"""
import sys
from datetime import datetime, timezone

import _fixture as fx
import stockplan as sp

NOW = datetime(2026, 9, 22, 18, 0, 0, tzinfo=timezone.utc)
WINDOW = 38  # the fixture spans 2026-08-16 .. 2026-09-22
SETTINGS = {"window_days": WINDOW, "lead_time_days": 30, "coverage_days": 30}

failures = []


def check(label, got, want):
    if got != want:
        failures.append("%s: got %r, want %r" % (label, got, want))


def close(label, got, want, tol=0.01):
    if abs(got - want) > tol:
        failures.append("%s: got %r, want ~%r" % (label, got, want))


plan = sp.build_plan(fx.orders(), fx.products(), SETTINGS, now=NOW)
rows = {r["flavor"]: r for r in plan["finished"]}
packs = {r["flavor"]: r for r in plan["packaging"]}

# --- catalog is split correctly -------------------------------------------------
check("finished SKU count", len(plan["finished"]), 7)
check("pouch SKU count", len(plan["packaging"]), 7)
check("gift card excluded", "10% OFF GrazeOn Gift Card" in rows, False)
check("variety pack excluded", any("Variety" in f for f in rows), False)

# --- exclusions -----------------------------------------------------------------
# Two orders carry Internal Use tags; #1692 is an untagged master-case placeholder.
check("internal orders skipped", plan["excluded"].get("internal orders"), 2)
check("non-stock lines skipped", plan["excluded"].get("non-stock items"), 1)

# --- demand, checked by hand ----------------------------------------------------
# Natural subscription lines in window: #1714 x4, #1711 x3, #1704 x2, #1697 x3 = 12.
close("Natural subscription rate", rows["Natural"]["rate_sub"], 12 / WINDOW)
# Natural total in window is 51 units; the trailing 30 days hold 45, so the
# conservative mode must plan on the faster recent pace.
close("Natural window rate", rows["Natural"]["rate_window"], 51 / WINDOW)
close("Natural 30-day rate", rows["Natural"]["rate_30"], 45 / 30)
close("Natural planning rate", rows["Natural"]["rate"], 1.5)
# Faire's 14-bag wholesale line must land in the wholesale stream, not website.
close("Jalapeño wholesale rate", rows["Jalapeño"]["rate_wholesale"], (14 + 1) / WINDOW)

# --- pouches --------------------------------------------------------------------
# Every bag flavor must find its pouch; a missed match would silently read as zero.
check("all pouches matched to a bag", sum(1 for p in packs.values() if p["bag_rate"] > 0), 7)
check("Salt and Pepper pouches used", packs["Salt and Pepper"]["used_in_window"],
      60 + 24 + 70 + 132 + 24 + 72 + 1)
check("pouch consumption is not a sale", rows["Salt and Pepper"]["rate"] < 3, True)

# --- reorder logic --------------------------------------------------------------
n = rows["Natural"]
check("Natural flagged critical", n["status"], "critical")
close("Natural days of cover", n["days_cover"], round(2 / 1.5, 1))
check("Natural cannot cover subscriptions through lead time", n["sub_covered"], False)
check("Red Chile has the most cover", plan["finished"][-1]["flavor"], "Red Chile")
# target = rate*horizon + safety, and the suggestion nets off what is already on hand.
check("suggested order nets on-hand", n["suggested_order"], max(0, n["target"] - n["on_hand"]))
check("order covers horizon demand", n["target"] >= n["demand_horizon"], True)

# --- settings actually move the numbers -----------------------------------------
longer = sp.build_plan(fx.orders(), fx.products(),
                       dict(SETTINGS, lead_time_days=60), now=NOW)
check("longer lead time orders more",
      longer["totals"]["suggested_order"] > plan["totals"]["suggested_order"], True)
flat = sp.build_plan(fx.orders(), fx.products(),
                     dict(SETTINGS, service_level=0.50), now=NOW)
check("no safety stock at 50% service", {r["safety_stock"] for r in flat["finished"]}, {0})

# --- short history is detected, not silently averaged away -----------------------
# Ask for 90 days when the fixture only holds 38: planning on 90 would understate
# demand by more than half.
wide = sp.build_plan(fx.orders(), fx.products(), dict(SETTINGS, window_days=90), now=NOW)
check("short history flagged", wide["truncated_history"], True)
# A 90-day ask reaches one day further back than WINDOW does, to 2026-08-15, so the
# real span is 39 days -- the point is that it plans on that, not on the 90 requested.
check("history span reported", wide["history_days"], 39)
check("planning window shrunk to real span", wide["settings"]["window_days"], 39)
check("requested window remembered", wide["requested_window"], 90)
close("rate unchanged by the wider ask",
      {r["flavor"]: r for r in wide["finished"]}["Natural"]["rate"], 1.5)
check("full history not flagged", plan["truncated_history"], False)

# --- service level snaps to the nearest tabulated z ------------------------------
check("99% is stricter than 95%", sp.z_for(0.99) > sp.z_for(0.95), True)
check("unlisted level snaps to nearest, not to the default", sp.z_for(0.97), sp.z_for(0.975))

# --- both ways of authenticating are recognised ---------------------------------
def mode(**cfg):
    base = {"token": "", "client_id": "", "client_secret": "", "store": "s.myshopify.com"}
    base.update(cfg)
    try:
        return sp.auth_mode(base)
    except ValueError as e:
        return "rejected: " + str(e).split("\n")[0]

check("legacy shpat_ token", mode(token="shpat_" + "a" * 32), "token")
check("dev dashboard client credentials",
      mode(client_id="d" * 32, client_secret="shpss_" + "a" * 32), "oauth")
check("client id with no secret is rejected", mode(token="d" * 32).startswith("rejected"), True)
check("a bare secret key is not a token", mode(token="shpss_" + "a" * 32).startswith("rejected"), True)
check("nothing at all is rejected", mode().startswith("rejected"), True)
check("a wrong-looking client secret is caught",
      mode(client_id="d" * 32, client_secret="nope").startswith("rejected"), True)

# The Dev Dashboard's secret is commonly pasted into "token"; treat it as the secret.
import json as _json, tempfile, os as _os
_tmp = tempfile.mkdtemp()
_cfgp = _os.path.join(_tmp, "config.json")
_json.dump({"store": "s.myshopify.com", "client_id": "d" * 32,
            "token": "shpss_" + "a" * 32}, open(_cfgp, "w"))
_saved = sp.CONFIG
sp.CONFIG = _cfgp
for _v in ("SHOPIFY_STORE", "SHOPIFY_TOKEN", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"):
    _os.environ.pop(_v, None)
_c = sp.load_config()
sp.CONFIG = _saved
check("secret pasted into token is used as the client secret", _c["mode"], "oauth")
check("and is not left sitting in token", _c["token"], "")

# --- OAuth failures are explained, not echoed -----------------------------------
check("app_not_installed is recognised",
      sp.oauth_error("<title>400 - Oauth error app_not_installed</title>"), "app_not_installed")
check("that error has a hint", "app_not_installed" in sp.OAUTH_HINTS, True)

# --- flavor folding -------------------------------------------------------------
check("pouch name folds to handle", sp.flavor_key("Salt and Pepper"), sp.flavor_key("saltpepper2oz"))
check("accents fold", sp.flavor_key("Jalapeño"), sp.flavor_key("jalapeno2oz"))
check("salt is not salt-and-pepper", sp.flavor_key("Salt") != sp.flavor_key("Salt and Pepper"), True)

if failures:
    print("FAILED (%d)" % len(failures))
    for f in failures:
        print("  - " + f)
    sys.exit(1)
print("all checks passed (%d SKUs, %d orders)" % (len(plan["finished"]), plan["orders_considered"]))
