#!/usr/bin/env python3
"""GrazeOn Box Fit local helper.

Run:  python3 boxfit.py
Serves GrazeOnBoxFit.html at http://127.0.0.1:8765/ and adds /api/search, which looks
online for boxes of a given size (Amazon search plus Brave web search) and returns
title, link, size, pack count, price and price per box. Standard library only; page
fetches go through the system curl so macOS certificates just work.
"""
import http.server, json, os, re, subprocess, sys, tempfile, threading, time, urllib.parse, webbrowser
from html import unescape

PORT = int(os.environ.get("BOXFIT_PORT", "8765"))
HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, "GrazeOnBoxFit.html")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
JAR = os.path.join(tempfile.gettempdir(), "boxfit-cookies.txt")
CACHE = {}
LOCK = threading.Lock()


# ---------- fetching ----------
def fetch(url, referer=None, timeout=25):
    cmd = ["curl", "-sL", "--compressed", "-m", str(timeout), "-A", UA,
           "-H", "Accept-Language: en-US,en;q=0.9",
           "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
           "-c", JAR, "-b", JAR]
    if referer:
        cmd += ["-H", "Referer: " + referer]
    cmd.append(url)
    try:
        return subprocess.run(cmd, capture_output=True, text=True, errors="replace").stdout
    except Exception:
        return ""


_warmed = [0.0]
def warm_amazon():
    # Amazon serves search pages to sessions that have visited a product page first.
    if time.time() - _warmed[0] < 1800:
        return
    fetch("https://www.amazon.com/dp/B0G4KW322Q")
    _warmed[0] = time.time()


# ---------- parsing ----------
NUM = r"(\d+(?:\.\d+)?(?:\s*-?\s*\d/\d+)?)"
UNIT = r'(?:\s*(?:"|”|\'\'|in\.?|inch(?:es)?))?'
AXIS = r"(?:\s*[LlWwHhDd]\b\.?)?"
X = r"\s*[x×X]\s*"
DIMS_RE = re.compile(NUM + UNIT + AXIS + X + NUM + UNIT + AXIS + X + NUM + UNIT)
PACK_RES = [
    re.compile(r"pack of (\d+)", re.I), re.compile(r"set of (\d+)", re.I), re.compile(r"(\d+)\s*[- ]?pack\b", re.I),
    re.compile(r"(\d+)\s*/\s*(?:pack|bundle|case|ct)", re.I), re.compile(r"(\d+)\s*(?:pcs|pieces|count|ct|boxes|bundle|cartons)\b", re.I),
    re.compile(r"\((\d+)\)\s*$"),
]


def num(t):
    t = t.strip().replace("-", " ")
    m = re.match(r"(\d+)(?:\.(\d+))?(?:\s+(\d)/(\d+))?$", t)
    if not m:
        return None
    v = float(m.group(1) + ("." + m.group(2) if m.group(2) else ""))
    if m.group(3):
        v += int(m.group(3)) / int(m.group(4))
    return v


def parse_dims(text):
    m = DIMS_RE.search(text)
    if not m:
        return None
    d = [num(m.group(i)) for i in (1, 2, 3)]
    if any(v is None or v <= 0 or v > 100 for v in d):
        return None
    return d


def parse_pack(text):
    for r in PACK_RES:
        m = r.search(text)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 2000:
                return n
    return None


def money(s):
    m = re.search(r"\$\s*([\d,]+(?:\.\d+)?)", s or "")
    return float(m.group(1).replace(",", "")) if m else None


def strip_tags(h):
    h = re.sub(r"<script.*?</script>|<style.*?</style>", " ", h, flags=re.S)
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", h))).strip()


def classify(d, want):
    """exact: same box. fits: every side at least as big, within a few inches. else None."""
    a = sorted(d); b = sorted(want)
    if all(abs(x - y) <= 0.26 for x, y in zip(a, b)):
        return "exact"
    if all(x >= y - 0.01 for x, y in zip(a, b)) and sum(x - y for x, y in zip(a, b)) <= 6:
        return "fits"
    return None


# ---------- sources ----------
def amazon_search(query):
    warm_amazon()
    html = fetch("https://www.amazon.com/s?k=" + urllib.parse.quote_plus(query), referer="https://www.amazon.com/")
    out = []
    starts = [m for m in re.finditer(r'data-asin="(B[A-Z0-9]{9})"[^>]*data-component-type="s-search-result"', html)]
    bounds = [m.start() for m in re.finditer(r'data-asin="B[A-Z0-9]{9}"', html)]
    for m in starts:
        asin = m.group(1)
        nxt = next((b for b in bounds if b > m.start()), len(html))
        card = html[m.start():nxt]
        h2 = re.search(r'<h2[^>]*aria-label="([^"]+)"', card)
        title = unescape(h2.group(1)) if h2 else None
        if not title:
            h2 = re.search(r"<h2[^>]*>(.*?)</h2>", card, re.S)
            title = strip_tags(h2.group(1)) if h2 else ""
        text = strip_tags(card)
        prices = [money(p) for p in re.findall(r'a-offscreen">([^<]*)<', card)]
        price = prices[0] if prices else None
        per = None
        if len(prices) > 1 and re.search(r"/\s*count", text, re.I):
            per = prices[1]
        out.append({
            "source": "amazon", "asin": asin, "title": title, "url": "https://www.amazon.com/dp/" + asin,
            "price": price, "perUnit": per, "sponsored": bool(re.search(r"\bSponsored\b", text[:400])),
            "dims": parse_dims(title or ""), "pack": parse_pack(title or ""),
        })
    return out


def brave_search(query):
    html = fetch("https://search.brave.com/search?q=" + urllib.parse.quote_plus(query) + "&source=web")
    seen, out = set(), []
    for m in re.finditer(r'<a[^>]*href="(https?://(?!search\.brave|brave\.com|account\.brave|hackerone|status\.brave)[^"]+)"[^>]*>(.*?)</a>', html, re.S):
        url = unescape(m.group(1))
        parts = [re.sub(r"\s+", " ", unescape(t)).strip() for t in re.split(r"<[^>]+>", m.group(2))]
        parts = [t for t in parts if t and "›" not in t]
        title = max(parts, key=len) if parts else ""
        if len(title) < 15 or url in seen:
            continue
        seen.add(url)
        out.append({"url": url, "title": title})
    return out


def amazon_product(asin):
    html = fetch("https://www.amazon.com/dp/" + asin, referer="https://www.amazon.com/")
    t = re.search(r'id="productTitle"[^>]*>([^<]+)<', html)
    title = unescape(t.group(1)).strip() if t else None
    if not title:
        return None
    core = re.search(r'id="corePrice_feature_div".{0,3000}', html, re.S)
    prices = [money(p) for p in re.findall(r'a-offscreen">([^<]*)<', core.group(0) if core else html[:200000])]
    text = strip_tags(core.group(0)) if core else ""
    per = prices[1] if len(prices) > 1 and re.search(r"/\s*count", text, re.I) else None
    return {"source": "amazon", "asin": asin, "title": title, "url": "https://www.amazon.com/dp/" + asin,
            "price": prices[0] if prices else None, "perUnit": per, "sponsored": False,
            "dims": parse_dims(title), "pack": parse_pack(title)}


def search(l, w, h):
    want = [l, w, h]
    key = tuple(sorted(want))
    with LOCK:
        if key in CACHE:
            return CACHE[key]
    fmt = lambda v: ("%g" % v)
    compact = "x".join(fmt(v) for v in want)
    spaced = " x ".join(fmt(v) for v in want)

    results, seen_asin = [], set()
    for q in (compact + " corrugated boxes", spaced + " shipping boxes"):
        for r in amazon_search(q):
            if r["asin"] in seen_asin:
                continue
            seen_asin.add(r["asin"]); results.append(r)

    web = []
    extra_asins = []
    for r in brave_search('"' + compact + '" corrugated shipping boxes'):
        m = re.search(r"amazon\.com/.*?/dp/(B[A-Z0-9]{9})", r["url"]) or re.search(r"amazon\.com/dp/(B[A-Z0-9]{9})", r["url"])
        if m:
            if m.group(1) not in seen_asin:
                extra_asins.append(m.group(1))
            continue
        if "amazon.com" in r["url"]:
            continue
        host = urllib.parse.urlparse(r["url"]).netloc.replace("www.", "")
        web.append({"source": host, "title": r["title"], "url": r["url"], "dims": parse_dims(r["title"]) or parse_dims(r["url"].replace("-", " ")), "pack": parse_pack(r["title"])})
    for asin in extra_asins[:3]:
        p = amazon_product(asin)
        if p:
            seen_asin.add(asin); results.append(p)

    boxes = []
    for r in results:
        if not r["dims"]:
            continue
        fit = classify(r["dims"], want)
        if not fit:
            continue
        pack = r["pack"]
        if r["price"] and r["perUnit"] and r["perUnit"] > 0 and not pack:
            pack = round(r["price"] / r["perUnit"])
        per = r["perUnit"] or (r["price"] / pack if r["price"] and pack else None)
        boxes.append({**r, "pack": pack, "perBox": round(per, 2) if per else None, "fit": fit})
    boxes.sort(key=lambda b: (b["fit"] != "exact", b["sponsored"], b["perBox"] if b["perBox"] is not None else 1e9))
    uniq, seen_t = [], set()
    for b in boxes:
        k = (b["title"].strip().lower(), b["price"])
        if k in seen_t:
            continue
        seen_t.add(k); uniq.append(b)
    boxes = uniq

    links = []
    for r in web:
        fit = classify(r["dims"], want) if r["dims"] else None
        links.append({**r, "fit": fit})
    links.sort(key=lambda b: (b["fit"] != "exact", b["fit"] is None))

    res = {"want": want, "boxes": boxes, "links": links[:12], "fetchedAt": time.strftime("%Y-%m-%d %H:%M")}
    with LOCK:
        CACHE[key] = res
    return res


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
        if u.path in ("/", "/index.html", "/GrazeOnBoxFit.html"):
            try:
                with open(HTML, "rb") as f:
                    data = f.read()
            except OSError:
                self.send_error(404, "GrazeOnBoxFit.html not found next to boxfit.py"); return
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif u.path == "/favicon.ico":
            self.send_response(204); self.end_headers()
        elif u.path == "/api/ping":
            self.send_json({"ok": True})
        elif u.path == "/api/search":
            q = urllib.parse.parse_qs(u.query)
            try:
                l, w, h = (float(q[k][0]) for k in ("l", "w", "h"))
                if min(l, w, h) <= 0:
                    raise ValueError
            except (KeyError, ValueError):
                self.send_json({"error": "need l, w, h as positive numbers"}, 400); return
            try:
                self.send_json(search(l, w, h))
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
        else:
            self.send_error(404)


def main():
    if not os.path.exists(HTML):
        print("GrazeOnBoxFit.html not found next to boxfit.py", file=sys.stderr); sys.exit(1)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = "http://127.0.0.1:%d/" % PORT
    print("GrazeOn Box Fit running at %s  (Ctrl-C to stop)" % url)
    if "--no-open" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
