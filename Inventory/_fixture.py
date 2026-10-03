"""Real GrazeOn orders + inventory pulled from Shopify on 2026-09-22, as a test fixture."""

V = {  # handle -> (product_id, variant_id)
    "redchile2oz":   ("9107511312598", "47306218176726"),
    "greenchile2oz": ("9108751450326", "47310093615318"),
    "jalapeno2oz":   ("9108752531670", "47310095024342"),
    "christmas2oz":  ("9108752761046", "47310097449174"),
    "saltpepper2oz": ("9108752990422", "47310097678550"),
    "salt2oz":       ("9108753318102", "47310098006230"),
    "natural2oz":    ("9157213552854", "47527634108630"),
}
POUCH = {  # flavor -> (variant_id, on_hand)
    "Green Chile": ("47971414638806", 433), "Red Chile": ("47971414671574", 693),
    "Natural": ("47971414704342", 626), "Jalapeño": ("47971414737110", 688),
    "Christmas": ("47971414769878", 242), "Salt": ("47971414802646", 567),
    "Salt and Pepper": ("47971414835414", 193),
}
ON_HAND = {"redchile2oz": 27, "greenchile2oz": 24, "jalapeno2oz": 16, "christmas2oz": 26,
           "saltpepper2oz": 22, "salt2oz": 15, "natural2oz": 2}
TITLES = {
    "redchile2oz": "GrazeOn Red Chile Beef Jerky Crisps- High Protein, No Sugar, Crunchy Air-Dried Meat Snack - 2.0 oz",
    "greenchile2oz": "GrazeOn Green Chile Beef Jerky Crisps- High Protein, No Sugar, Crunchy Air-Dried Meat Snack, All-Natural - 2.0 oz",
    "jalapeno2oz": "GrazeOn Jalapeño Beef Jerky Crisps- High Protein, No Sugar, Crunchy Air-Dried Meat Snack, All-Natural - 2.0 oz",
    "christmas2oz": "GrazeOn Christmas Beef Jerky Crisps- High Protein, No Sugar, Crunchy Air-Dried Meat Snack, All-Natural - 2.0 oz",
    "saltpepper2oz": "GrazeOn Salt and Pepper Beef Jerky Crisps- High Protein, No Sugar, Crunchy Air-Dried Meat Snack, All-Natural - 2.0 oz",
    "salt2oz": "GrazeOn Salt Beef Jerky Crisps- High Protein, No Sugar, Crunchy Air-Dried Meat Snack, All-Natural - 2.0 oz",
    "natural2oz": "GrazeOn Natural Beef Jerky Crisps- High Protein, No Sugar, Crunchy Air-Dried Meat Snack, All-Natural - 2.0 oz",
}

# (name, date, source, tags, [(handle, qty, is_sub)])
RAW = [
 ("#1714","2026-09-21T17:43:32Z","web",["appstle_subscription_first_order"],
   [("natural2oz",4,1),("christmas2oz",4,1),("saltpepper2oz",2,1),("salt2oz",4,1)]),
 ("#1713","2026-09-21T11:16:50Z","web",["Simple Bundles 2.0 - Bundle Order"],
   [("christmas2oz",1,0),("greenchile2oz",1,0),("jalapeno2oz",1,0),("natural2oz",1,0),
    ("redchile2oz",1,0),("saltpepper2oz",1,0),("salt2oz",1,0)]),
 ("#1712","2026-09-18T21:01:34Z","subscription_contract_checkout_one",["appstle_subscription_recurring_order"],
   [("jalapeno2oz",1,1)]),
 ("#1711","2026-09-15T20:01:38Z","subscription_contract_checkout_one",["appstle_subscription_recurring_order"],
   [("natural2oz",3,1),("redchile2oz",4,1),("christmas2oz",4,1),("greenchile2oz",4,1)]),
 ("#1710","2026-09-14T20:01:29Z","subscription_contract_checkout_one",["appstle_subscription_recurring_order"],
   [("jalapeno2oz",8,1),("redchile2oz",3,1),("greenchile2oz",3,1),("salt2oz",5,1)]),
 ("#1709","2026-09-12T17:17:17Z","web",[],[("natural2oz",14,0)]),
 ("#1707","2026-09-11T02:13:49Z","web",[],[("jalapeno2oz",12,0),("saltpepper2oz",21,0)]),
 ("#1706","2026-09-09T23:04:43Z","shopify_draft_order",[],[("jalapeno2oz",2,0)]),
 ("#1705","2026-09-09T05:56:50Z","web",[],[("natural2oz",1,0)]),
 ("#1704","2026-09-08T17:01:32Z","subscription_contract_checkout_one",["appstle_subscription_recurring_order"],
   [("natural2oz",2,1),("redchile2oz",2,1),("christmas2oz",1,1),("greenchile2oz",2,1)]),
 ("#1703","2026-09-08T05:01:31Z","subscription_contract_checkout_one",["appstle_subscription_recurring_order"],
   [("redchile2oz",2,1),("christmas2oz",3,1),("greenchile2oz",2,1),("salt2oz",1,1)]),
 ("#1702","2026-09-06T01:43:28Z","web",[],
   [("natural2oz",4,0),("redchile2oz",3,0),("christmas2oz",4,0),("greenchile2oz",3,0)]),
 ("#1701","2026-09-05T18:16:18Z","shopify-collective-automatic-payments",["Living.Fit","Shopify Collective"],
   [("salt2oz",2,0),("natural2oz",2,0)]),
 ("#1699","2026-09-03T18:27:32Z","web",[],[("natural2oz",1,0),("salt2oz",1,0)]),
 ("#3RWKDSQ63P","2026-09-03T05:24:50Z","faire",["Faire","Wholesale"],
   [("christmas2oz",14,0),("greenchile2oz",14,0),("jalapeno2oz",14,0),("salt2oz",14,0),("saltpepper2oz",14,0)]),
 ("#1697","2026-09-02T22:01:33Z","subscription_contract_checkout_one",["appstle_subscription_recurring_order"],
   [("natural2oz",3,1),("redchile2oz",3,1),("christmas2oz",3,1),("greenchile2oz",2,1)]),
 ("#1696","2026-09-02T04:54:12Z","tiktok",["Shipped by TikTok"],[("natural2oz",4,0)]),
 ("#1695","2026-09-01T02:23:36Z","web",[],
   [("jalapeno2oz",10,0),("natural2oz",2,0),("redchile2oz",2,0),("christmas2oz",2,0),
    ("greenchile2oz",2,0),("salt2oz",2,0)]),
 ("#1694","2026-09-01T00:07:31Z","shopify-collective-automatic-payments",["Living.Fit","Shopify Collective"],
   [("natural2oz",1,0),("christmas2oz",1,0),("greenchile2oz",1,0)]),
 ("#1693","2026-08-31T19:04:43Z","web",[],[("jalapeno2oz",14,0)]),
 ("#1691","2026-08-31T05:38:10Z","shopify-collective-automatic-payments",["Living.Fit","Shopify Collective"],
   [("natural2oz",1,0),("saltpepper2oz",3,0)]),
 ("#1690","2026-08-26T20:54:17Z","web",[],
   [("jalapeno2oz",2,0),("natural2oz",2,0),("redchile2oz",2,0),("christmas2oz",2,0),
    ("greenchile2oz",2,0),("saltpepper2oz",2,0),("salt2oz",2,0)]),
 ("#1688","2026-08-25T20:59:28Z","shopify-collective-automatic-payments",["Living.Fit","Shopify Collective"],
   [("salt2oz",1,0),("jalapeno2oz",1,0)]),
 ("#1687","2026-08-24T16:09:22Z","3890849",["Shop Cash offers acquired"],
   [("jalapeno2oz",2,0),("greenchile2oz",4,0),("salt2oz",4,0)]),
 ("#1686","2026-08-23T17:15:05Z","tiktok",["Shipped by TikTok"],[("greenchile2oz",1,0)]),
 ("#1685","2026-08-22T23:58:36Z","shopify-collective-automatic-payments",["Living.Fit","Shopify Collective"],
   [("christmas2oz",1,0),("natural2oz",1,0)]),
 ("#1681","2026-08-22T18:34:02Z","web",[],
   [("jalapeno2oz",2,0),("redchile2oz",4,0),("christmas2oz",4,0),("greenchile2oz",4,0),("salt2oz",2,0)]),
 ("#1680","2026-08-22T04:51:14Z","web",["Simple Bundles 2.0 - Bundle Order"],
   [("christmas2oz",1,0),("greenchile2oz",1,0),("jalapeno2oz",1,0),("natural2oz",1,0),
    ("redchile2oz",1,0),("saltpepper2oz",1,0),("salt2oz",1,0)]),
 ("#1679","2026-08-19T03:20:01Z","web",[],
   [("jalapeno2oz",2,0),("christmas2oz",2,0),("greenchile2oz",2,0),("salt2oz",7,0)]),
 ("#1678","2026-08-19T00:28:37Z","web",["Simple Bundles 2.0 - Bundle Order"],
   [("christmas2oz",1,0),("greenchile2oz",1,0),("jalapeno2oz",1,0),("natural2oz",1,0),
    ("redchile2oz",1,0),("saltpepper2oz",1,0),("salt2oz",1,0)]),
 ("#1677","2026-08-18T21:01:31Z","subscription_contract_checkout_one",["appstle_subscription_recurring_order"],
   [("jalapeno2oz",1,1)]),
 ("#1676","2026-08-18T06:45:20Z","tiktok",["Shipped by TikTok"],[("natural2oz",2,0),("saltpepper2oz",1,0)]),
 ("#1675","2026-08-18T01:37:16Z","tiktok",["Shipped by TikTok"],
   [("saltpepper2oz",1,0),("salt2oz",1,0),("natural2oz",1,0)]),
 ("#1674","2026-08-15T20:05:48Z","web",["appstle_subscription_first_order"],
   [("natural2oz",3,1),("redchile2oz",4,1),("christmas2oz",4,1),("greenchile2oz",4,1)]),
 ("#1673","2026-08-15T19:24:27Z","3890849",["Shop Cash offers acquired","Simple Bundles 2.0 - Bundle Order"],
   [("christmas2oz",1,0),("greenchile2oz",1,0),("jalapeno2oz",1,0),("natural2oz",1,0),
    ("redchile2oz",1,0),("saltpepper2oz",1,0),("salt2oz",1,0)]),
 ("#1672","2026-08-15T18:32:09Z","3890849",["Shop Cash offers acquired"],
   [("jalapeno2oz",1,0),("redchile2oz",1,0),("christmas2oz",2,0),("greenchile2oz",2,0),("saltpepper2oz",1,0)]),
]

# Pouch-consumption draft orders and internal orders that must NOT count as sales.
POUCH_RAW = [
 ("#1721","2026-09-22T15:24:33Z",[("Christmas",60),("Salt and Pepper",60)]),
 ("#1720","2026-09-22T15:23:43Z",[("Green Chile",20),("Jalapeño",62),("Christmas",12),("Salt and Pepper",24)]),
 ("#1719","2026-09-22T15:16:40Z",[("Green Chile",40),("Red Chile",30),("Natural",20),("Jalapeño",20),
                                   ("Christmas",70),("Salt",30),("Salt and Pepper",70)]),
 ("#1718","2026-09-22T15:15:17Z",[("Green Chile",74),("Red Chile",12),("Natural",20),("Jalapeño",20),
                                   ("Christmas",135),("Salt",32),("Salt and Pepper",132)]),
 ("#1717","2026-09-22T15:13:51Z",[("Green Chile",24),("Red Chile",24),("Salt",24),("Salt and Pepper",24)]),
 ("#1716","2026-09-22T15:12:28Z",[("Green Chile",48),("Red Chile",12),("Jalapeño",36),("Christmas",84),
                                   ("Salt and Pepper",72)]),
 ("#1715","2026-09-22T15:10:36Z",[("Green Chile",50),("Red Chile",30),("Salt",30),("Salt and Pepper",1)]),
]
INTERNAL_RAW = [
 ("#1708","2026-09-12T16:10:16Z","shopify_draft_order",["Internal Use","no fulfillment necessary"],
   [("9485448773846","50292701987030","4-Case Master",1)]),
 ("#1684","2026-08-22T22:13:31Z","shopify_draft_order",["Internal Use"],
   [("9485448773846","50292701987030","4-Case Master",1)]),
 ("#1692","2026-08-31T16:10:33Z","shopify_draft_order",[],
   [("9485448773846","50292701987030","4-Case Master",1)]),
]


def orders():
    out = []
    for name, when, src, tags, lines in RAW:
        out.append({"name": name, "createdAt": when, "source": src, "tags": tags,
                    "cancelled": False, "test": False,
                    "lines": [{"qty": q, "product_id": V[h][0], "variant_id": V[h][1],
                               "variant_title": "Default Title", "subscription": bool(sub)}
                              for h, q, sub in lines]})
    for name, when, lines in POUCH_RAW:
        out.append({"name": name, "createdAt": when, "source": "shopify_draft_order", "tags": [],
                    "cancelled": False, "test": False,
                    "lines": [{"qty": q, "product_id": "9297919443158", "variant_id": POUCH[f][0],
                               "variant_title": f, "subscription": False} for f, q in lines]})
    for name, when, src, tags, lines in INTERNAL_RAW:
        out.append({"name": name, "createdAt": when, "source": src, "tags": tags,
                    "cancelled": False, "test": False,
                    "lines": [{"qty": q, "product_id": p, "variant_id": v,
                               "variant_title": t, "subscription": False} for p, v, t, q in lines]})
    return out


def products():
    out = []
    for h, (pid, vid) in V.items():
        out.append({"id": pid, "title": TITLES[h], "handle": h, "status": "ACTIVE",
                    "product_type": "Beef Jerky",
                    "variants": [{"id": vid, "title": "Default Title",
                                  "sku": "Natural 2oz" if h == "natural2oz" else "",
                                  "price": 13.99, "on_hand": ON_HAND[h], "tracked": True}]})
    out.append({"id": "9297919443158", "title": "2oz Bags Foshan Baishen Package Products Co., Ltd.",
                "handle": "2oz-bags-foshan", "status": "UNLISTED", "product_type": "",
                "variants": [{"id": vid, "title": f, "sku": "", "price": 0.0,
                              "on_hand": oh, "tracked": True} for f, (vid, oh) in POUCH.items()]})
    # Things that must be filtered out of demand.
    out.append({"id": "9125189550294", "title": "10% OFF GrazeOn Gift Card", "handle": "grazeon-gift-card",
                "status": "ACTIVE", "product_type": "",
                "variants": [{"id": "47385130860758", "title": "$10.00", "sku": "", "price": 9.0,
                              "on_hand": -2, "tracked": False}]})
    out.append({"id": "9485448773846", "title": "Master Case — Wholesale Shipping",
                "handle": "master-case-wholesale-shipping", "status": "ACTIVE", "product_type": "",
                "variants": [{"id": "50292701987030", "title": "4-Case Master", "sku": "GRZ-MSTR-4",
                              "price": 0.0, "on_hand": -5, "tracked": False}]})
    out.append({"id": "9250795880662", "title": "Try All - 7 Flavor Variety Pack", "handle": "7pack",
                "status": "ACTIVE", "product_type": "Beef Jerky",
                "variants": [{"id": "47830564438230", "title": "Default Title", "sku": "", "price": 71.34,
                              "on_hand": 2, "tracked": True}]})
    return out
