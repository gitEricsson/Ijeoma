"""Builds public/data/cancer-facts.json from the GLOBOCAN 2024 country fact
sheets (IARC/WHO Global Cancer Observatory). Run by hand when IARC publishes
new figures; it isn't part of the build.

    python scripts/build-cancer-facts.py [cache-dir]

Needs pypdf. The PDFs (about 700 KB each) are cached in cache-dir
(default: the system temp folder), so re-runs don't download again.
"""

import json
import os
import re
import sys
import tempfile
import urllib.request

BASE = "https://gco.iarc.who.int/media/globocan/factsheets/populations/"
AFRICA_URL = BASE + "903-africa-fact-sheet.pdf"


def load_urls():
    # ISO2 -> fact sheet URL. The slugs vary (accents, "Republic of"), so they
    # were found once by probing. Seychelles has no GLOBOCAN sheet (null).
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gco-urls.json")
    return json.load(open(path, encoding="utf8"))


def fetch(url, cache):
    path = os.path.join(cache, url.rsplit("/", 1)[1])
    if not os.path.exists(path):
        with urllib.request.urlopen(url, timeout=60) as r, open(path, "wb") as f:
            if "pdf" not in r.headers.get("Content-Type", ""):
                raise RuntimeError(f"not a PDF: {url}")
            f.write(r.read())
    return path


def num(s):
    return int(s.replace(" ", ""))


def parse(pdf_path):
    from pypdf import PdfReader

    text = PdfReader(pdf_path).pages[0].extract_text()
    cases = num(re.search(r"Number of new cases\s+([\d ]+)\n", text).group(1))
    deaths = num(re.search(r"Number of deaths\s+([\d ]+)\n", text).group(1))
    prev = num(re.search(r"\(5-year\)\s+([\d ]+)\n", text).group(1))
    # Wording differs between the 2022 and 2024 templates.
    risk = float(re.search(r"Risk of developing cancer before the age\s*of\s*75 years \((?:cum\. risk )?%\) [\d.]+ [\d.]+ ([\d.]+)", text).group(1))
    year = int(re.search(r"GLOBOCAN (\d{4})", text).group(1))
    # Three top-5 tables in order: males, females, both sexes.
    rows = re.findall(r"^(\d)(?:st|nd|rd|th) (.+?) (\d{1,3}(?: \d{3})*) (\d+\.\d)%$", text, re.M)
    if len(rows) < 15:
        raise RuntimeError(f"expected 15 ranked rows, got {len(rows)} in {pdf_path}")
    table = lambda i: [{"rank": int(r[0]), "site": r[1], "cases": num(r[2]), "pct": float(r[3])} for r in rows[i * 5:(i + 1) * 5]]
    return {"year": year, "cases": cases, "deaths": deaths, "prevalent": prev, "risk": risk, "men": table(0), "women": table(1), "both": table(2)}


SITE = {
    "Breast": "Breast cancer", "Prostate": "Prostate cancer", "Cervix uteri": "Cervical cancer",
    "Colorectum": "Colorectal cancer", "Liver": "Liver cancer", "Lung": "Lung cancer", "NHL": "Non-Hodgkin lymphoma",
    "Kaposi sarcoma": "Kaposi sarcoma", "Corpus uteri": "Uterine cancer", "Ovary": "Ovarian cancer",
    "Stomach": "Stomach cancer", "Oesophagus": "Oesophageal cancer", "Bladder": "Bladder cancer",
    "Leukaemia": "Leukaemia", "Thyroid": "Thyroid cancer", "Larynx": "Laryngeal cancer",
    "Brain, central nervous system": "Brain cancer", "Pancreas": "Pancreatic cancer", "Kidney": "Kidney cancer",
    "Lip, oral cavity": "Mouth cancer", "Nasopharynx": "Nasopharyngeal cancer", "Hodgkin lymphoma": "Hodgkin lymphoma",
    "Multiple myeloma": "Multiple myeloma", "Melanoma of skin": "Skin melanoma",
}
ORD = {1: "most common", 2: "2nd most common", 3: "3rd most common"}


def pct(x):
    return int(x + 0.5)  # half up, as people read percentages


def site(s):
    return SITE.get(s, f"{s} cancer")


def facts_for(name, d):
    out = [
        f"An estimated {d['cases']:,} people in {name} were diagnosed with cancer in {d['year']}.",
        f"Cancer took an estimated {d['deaths']:,} lives in {name} in {d['year']}.",
        f"About 1 in {round(100 / d['risk'])} people in {name} will develop cancer before age 75.",
        f"{d['prevalent']:,} people in {name} are living with a cancer diagnosed in the last five years.",
    ]
    cervix = next((r for r in d["women"][:3] if r["site"] == "Cervix uteri"), None)
    top_w, top_m = d["women"][0], d["men"][0]
    if not cervix or cervix["rank"] != 1:
        out.append(f"{site(top_w['site'])} makes up {pct(top_w['pct'])}% of new cancers in women in {name}.")
    out.append(f"{site(top_m['site'])} makes up {pct(top_m['pct'])}% of new cancers in men in {name}.")
    if cervix:
        out.append(f"Cervical cancer, preventable with HPV vaccination and screening, is the {ORD[cervix['rank']]} cancer in women in {name}.")
    return out


def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), "gco-factsheets")
    os.makedirs(cache, exist_ok=True)
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    seed = open(os.path.join(root, "supabase", "seed.sql"), encoding="utf8").read()
    names = {}
    for iso, name in re.findall(r"\('([A-Z]{2})',\s*'((?:[^']|'')*)'", seed):
        names.setdefault(iso, name.replace("''", "'"))  # first match is the countries insert
    urls = load_urls()

    countries = {}
    for iso, url in urls.items():
        if not url:
            continue
        d = parse(fetch(url, cache))
        countries[iso] = {"y": d["year"], "f": facts_for(names[iso], d)}
        print(iso, d["year"], d["cases"], d["deaths"], d["risk"], d["men"][0]["site"], d["women"][0]["site"])

    a = parse(fetch(AFRICA_URL, cache))
    out = {
        # GLOBOCAN figures; each pool carries its edition year for the source line.
        "africa": {"y": a["year"], "f": facts_for("Africa", a)},
        "countries": countries,
        # From WHO's cancer fact sheet, shown with "WHO" as the source.
        "who": ["Between 30% and 50% of cancers can be prevented by avoiding risk factors and using proven prevention strategies."],
    }
    dest = os.path.join(root, "public", "data", "cancer-facts.json")
    with open(dest, "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print("wrote", dest, os.path.getsize(dest), "bytes")


if __name__ == "__main__":
    main()
