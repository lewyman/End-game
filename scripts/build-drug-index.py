#!/usr/bin/env python3
import json
import re
import sys
import time
import zipfile
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen, Request

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RAW_ZIP = DATA_DIR / "openfda-drug-ndc.json.zip"
RAW_JSON = DATA_DIR / "openfda-drug-ndc.json"
INDEX_JSON = DATA_DIR / "drug-index.json"
DOWNLOAD_JSON = "https://api.fda.gov/download.json"


def fetch_json(url: str):
    req = Request(url, headers={"User-Agent": "BioSyncAcademy/1.0"})
    with urlopen(req, timeout=120) as resp:
        return json.load(resp)


def normalize_name(value):
    if not value:
        return ""
    value = re.sub(r"\s+", " ", str(value)).strip()
    return value


def canonical_generic(name):
    name = normalize_name(name)
    name = re.sub(r"\s*\([^)]*\)", "", name)
    name = re.sub(r"\b\d+(\.\d+)?\s*(mg|mcg|g|ml|unit|units|iu|%)\b", "", name, flags=re.I)
    name = re.sub(r"\s+", " ", name).strip(" -,")
    return name


def add_many(target, values):
    if not values:
        return
    if isinstance(values, str):
        values = [values]
    for value in values:
        value = normalize_name(value)
        if value:
            target.add(value)


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    print("Fetching openFDA download manifest…", flush=True)
    manifest = fetch_json(DOWNLOAD_JSON)
    ndc = manifest["results"]["drug"]["ndc"]
    part = ndc["partitions"][0]
    url = part["file"]

    if not RAW_ZIP.exists():
        print(f"Downloading {url}…", flush=True)
        req = Request(url, headers={"User-Agent": "BioSyncAcademy/1.0"})
        with urlopen(req, timeout=600) as resp:
            RAW_ZIP.write_bytes(resp.read())
    else:
        print(f"Using cached raw zip: {RAW_ZIP}", flush=True)

    print("Extracting NDC JSON…", flush=True)
    with zipfile.ZipFile(RAW_ZIP) as zf:
        names = zf.namelist()
        member = names[0]
        with zf.open(member) as src:
            RAW_JSON.write_bytes(src.read())

    print("Parsing and deduplicating drug records…", flush=True)
    payload = json.loads(RAW_JSON.read_text())
    rows = payload.get("results", [])
    grouped = {}
    total_products = 0
    entries = []

    for item in rows:
        generic = canonical_generic(item.get("generic_name"))
        raw_generic = normalize_name(item.get("generic_name"))
        brand = normalize_name(item.get("brand_name"))
        product_ndc = normalize_name(item.get("product_ndc"))
        routes_list = [normalize_name(v) for v in (item.get("route") or []) if normalize_name(v)]
        dosage_form = normalize_name(item.get("dosage_form"))
        manufacturer = normalize_name(item.get("labeler_name"))
        product_type = normalize_name(item.get("product_type"))
        marketing_category = normalize_name(item.get("marketing_category"))
        substances_list = []

        for ingredient in item.get("active_ingredients") or []:
            name = normalize_name(ingredient.get("name"))
            if name:
                substances_list.append(name)

        pharm_classes = []
        add_many_temp = set()
        add_many(add_many_temp, item.get("pharm_class"))
        pharm_classes = sorted(add_many_temp)

        if raw_generic or brand or product_ndc:
            entry_name = raw_generic or brand or product_ndc
            entries.append({
                "id": product_ndc or re.sub(r"[^a-z0-9]+", "-", f"{entry_name}-{len(entries)}".lower()).strip("-"),
                "entryName": entry_name,
                "genericName": raw_generic or generic or brand,
                "canonicalGeneric": generic or raw_generic or brand,
                "brandName": brand,
                "productNdc": product_ndc,
                "routes": routes_list,
                "dosageForm": dosage_form,
                "manufacturer": manufacturer,
                "productType": product_type,
                "marketingCategory": marketing_category,
                "substances": substances_list[:12],
                "pharmClasses": pharm_classes[:8],
                "searchText": " ".join(str(v).lower() for v in [entry_name, raw_generic, generic, brand, product_ndc, dosage_form, manufacturer, product_type, marketing_category, *routes_list, *substances_list, *pharm_classes] if v),
            })

        if not generic and not brand:
            continue
        key = generic.lower() if generic else brand.lower()
        if key not in grouped:
            grouped[key] = {
                "id": re.sub(r"[^a-z0-9]+", "-", key.lower()).strip("-"),
                "genericName": generic or brand,
                "brandNames": set(),
                "routes": set(),
                "dosageForms": set(),
                "manufacturers": set(),
                "productTypes": set(),
                "marketingCategories": set(),
                "substances": set(),
                "pharmClasses": set(),
                "productCount": 0,
                "sampleProductNdcs": [],
            }
        g = grouped[key]
        if brand:
            g["brandNames"].add(brand)
        add_many(g["routes"], item.get("route"))
        add_many(g["dosageForms"], item.get("dosage_form"))
        add_many(g["manufacturers"], item.get("labeler_name"))
        add_many(g["productTypes"], item.get("product_type"))
        add_many(g["marketingCategories"], item.get("marketing_category"))
        add_many(g["pharmClasses"], item.get("pharm_class"))
        for ingredient in item.get("active_ingredients") or []:
            add_many(g["substances"], ingredient.get("name"))
        ndc_code = normalize_name(item.get("product_ndc"))
        if ndc_code and len(g["sampleProductNdcs"]) < 8:
            g["sampleProductNdcs"].append(ndc_code)
        g["productCount"] += 1
        total_products += 1

    drugs = []
    for value in grouped.values():
        search_terms = [value["genericName"], *value["brandNames"], *value["substances"], *value["routes"], *value["dosageForms"]]
        drugs.append({
            "id": value["id"],
            "genericName": value["genericName"],
            "brandNames": sorted(value["brandNames"]),
            "routes": sorted(value["routes"]),
            "dosageForms": sorted(value["dosageForms"]),
            "manufacturers": sorted(value["manufacturers"])[:20],
            "productTypes": sorted(value["productTypes"]),
            "marketingCategories": sorted(value["marketingCategories"]),
            "substances": sorted(value["substances"]),
            "pharmClasses": sorted(value["pharmClasses"]),
            "productCount": value["productCount"],
            "sampleProductNdcs": value["sampleProductNdcs"],
            "searchText": " ".join(str(v).lower() for v in search_terms if v),
        })

    drugs.sort(key=lambda d: (d["genericName"].lower(), -d["productCount"]))
    index = {
        "source": "openFDA drug NDC bulk download",
        "sourceUrl": url,
        "exportDate": ndc.get("export_date"),
        "builtAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "totalProducts": total_products,
        "totalEntries": len(entries),
        "totalDrugs": len(drugs),
        "entries": sorted(entries, key=lambda d: (d["entryName"].lower(), d.get("brandName", "").lower(), d.get("productNdc", ""))),
        "drugs": drugs,
    }
    INDEX_JSON.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps({
        "index": str(INDEX_JSON),
        "totalProducts": total_products,
        "totalEntries": len(entries),
        "totalDrugs": len(drugs),
        "exportDate": ndc.get("export_date"),
    }, indent=2))


if __name__ == "__main__":
    main()
