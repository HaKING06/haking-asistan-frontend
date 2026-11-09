"""PriceRunner veri kümesini ve tekrarlanabilir yazım hatalı sorguları hazırlar."""

from __future__ import annotations

import random
import re
import unicodedata
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
RAW_CSV = ROOT / "data" / "raw" / "uci_837" / "pricerunner_aggregate.csv"
WORD_RE = re.compile(r"[\w]+", re.UNICODE)
KEY_NEIGHBORS = {
    "a": "sqw", "b": "vghn", "c": "xdfv", "d": "serfcx", "e": "wsdr",
    "f": "drtgvc", "g": "ftyhbv", "h": "gyujnb", "i": "ujko",
    "j": "huikmn", "k": "jiolm", "l": "kop", "m": "njk", "n": "bhjm",
    "o": "iklp", "p": "ol", "q": "wa", "r": "edft", "s": "awedxz",
    "t": "rfgy", "u": "yhji", "v": "cfgb", "w": "qase", "x": "zsdc",
    "y": "tghu", "z": "asx",
}


def normalize_text(value: object) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return " ".join(WORD_RE.findall(text))


def tokenize(value: object) -> list[str]:
    return normalize_text(value).split()


def load_products(path: Path = RAW_CSV) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(
            f"PriceRunner CSV bulunamadı: {path}. README'deki veri indirme adımını izleyin."
        )
    frame = pd.read_csv(path, low_memory=False)
    frame.columns = [str(column).strip() for column in frame.columns]
    required = {"Product Title", "Cluster ID", "Cluster Label"}
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"Veri kümesinde beklenen sütunlar yok: {', '.join(sorted(missing))}")
    for column in ("Product ID", "Merchant ID", "Cluster ID", "Cluster Label", "Product Title"):
        if column not in frame:
            frame[column] = ""
        frame[column] = frame[column].fillna("").astype(str).str.strip()
    frame = frame[frame["Product Title"].str.len() > 1].copy()
    frame["_normalized"] = frame["Product Title"].map(normalize_text)
    frame = frame[frame["_normalized"].str.len() > 1].reset_index(drop=True)
    return frame


def _mutate(word: str, kind: str, rng: random.Random) -> str:
    letters = [char for char in word if char.isalpha()]
    if len(word) < 4 or not letters:
        return word + rng.choice("aeioru") if kind == "ekleme" else word
    position = rng.randrange(1, len(word) - 1) if len(word) > 3 else rng.randrange(len(word))
    if kind == "silme":
        return word[:position] + word[position + 1 :]
    if kind == "ekleme":
        return word[:position] + rng.choice("aeinrst") + word[position:]
    if kind == "harf_yer_degistirme":
        position = min(position, len(word) - 2)
        return word[:position] + word[position + 1] + word[position] + word[position + 2 :]
    if kind == "klavye_komsusu":
        char = word[position].casefold()
        options = KEY_NEIGHBORS.get(char, "aeinrst")
        replacement = rng.choice(options)
        return word[:position] + replacement + word[position + 1 :]
    return word


def _query_terms(title: str, rng: random.Random, minimum: int = 2) -> list[str] | None:
    terms = [term for term in tokenize(title) if len(term) >= 2]
    if len(terms) < minimum:
        return None
    width = rng.randint(minimum, min(4, len(terms)))
    start = rng.randint(0, len(terms) - width)
    return terms[start : start + width]


def generate_queries(products: pd.DataFrame, per_type: int = 100, seed: int = 20261109) -> pd.DataFrame:
    """Create 600 (default) deterministic 2–4 word queries over disjoint cluster splits."""
    rng = random.Random(seed)
    types = ["temiz", "harf_silme", "harf_ekleme", "harf_degistirme", "klavye_komsusu", "kelime_birlestirme"]
    eligible = products[products["Product Title"].map(lambda title: len(tokenize(title)) >= 3)]
    cluster_groups = eligible.groupby("Cluster ID", sort=False)
    records: list[dict[str, object]] = []
    used_clusters: set[str] = set()
    clusters = list(cluster_groups.groups)
    rng.shuffle(clusters)
    for kind in types:
        made = 0
        attempts = 0
        while made < per_type and attempts < per_type * 40:
            attempts += 1
            cluster = clusters[rng.randrange(len(clusters))]
            if cluster in used_clusters:
                continue
            group = cluster_groups.get_group(cluster)
            title = str(group.iloc[rng.randrange(len(group))]["Product Title"])
            terms = _query_terms(title, rng, minimum=3 if kind == "kelime_birlestirme" else 2)
            if not terms or not 2 <= len(terms) <= 4:
                continue
            if kind == "temiz":
                query_terms = terms
            elif kind == "kelime_birlestirme":
                position = rng.randrange(len(terms) - 1)
                query_terms = terms[:position] + [terms[position] + terms[position + 1]] + terms[position + 2 :]
            else:
                eligible_positions = [i for i, term in enumerate(terms) if len(term) >= 4]
                if not eligible_positions:
                    continue
                position = rng.choice(eligible_positions)
                mutation = {
                    "harf_silme": "silme",
                    "harf_ekleme": "ekleme",
                    "harf_degistirme": "harf_yer_degistirme",
                    "klavye_komsusu": "klavye_komsusu",
                }[kind]
                query_terms = terms.copy()
                query_terms[position] = _mutate(query_terms[position], mutation, rng)
            query = " ".join(query_terms)
            if not 2 <= len(query.split()) <= 4:
                continue
            used_clusters.add(cluster)
            records.append({"query": query, "cluster_id": str(cluster), "error_type": kind, "source_title": title})
            made += 1
    if len(records) < 400:
        raise RuntimeError(f"Yeterli test sorgusu üretilemedi: {len(records)} (en az 400 gerekli).")
    frame = pd.DataFrame(records)
    # Group split prevents the same product cluster appearing in validation and test.
    unique_clusters = frame["cluster_id"].drop_duplicates().tolist()
    rng.shuffle(unique_clusters)
    validation_clusters = set(unique_clusters[: len(unique_clusters) // 2])
    frame["split"] = frame["cluster_id"].map(lambda cluster: "validation" if cluster in validation_clusters else "test")
    return frame
