"""BM25, karakter TF-IDF ve doğrulama ile seçilen hibrit ürün araması."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from rank_bm25 import BM25Okapi
from rapidfuzz import fuzz, process
from rapidfuzz.distance import Levenshtein
from sklearn.feature_extraction.text import TfidfVectorizer

from .data import normalize_text, tokenize


@dataclass
class SearchBundle:
    products: pd.DataFrame
    vectorizer: TfidfVectorizer
    char_matrix: Any
    bm25: BM25Okapi
    vocabulary: list[str]
    title_terms: list[set[str]]
    hybrid_alpha: float
    metadata: dict[str, Any]
    word_frequencies: dict[str, int] | None = None


def train_search_bundle(products: pd.DataFrame) -> SearchBundle:
    titles = products["_normalized"].tolist()
    vectorizer = TfidfVectorizer(
        analyzer="char_wb", ngram_range=(3, 4), min_df=2, max_features=90_000,
        sublinear_tf=True, dtype=np.float32, norm="l2",
    )
    char_matrix = vectorizer.fit_transform(titles)
    bm25 = BM25Okapi([tokenize(title) for title in titles], k1=1.5, b=0.75)
    counts = pd.Series([token for title in titles for token in tokenize(title)]).value_counts()
    frequencies = {str(word): int(count) for word, count in counts.items()}
    vocabulary = [word for word, count in frequencies.items() if count >= 2 and 3 <= len(word) <= 28]
    title_terms = [set(title.split()) for title in titles]
    return SearchBundle(products, vectorizer, char_matrix, bm25, vocabulary, title_terms, 0.5, {}, frequencies)


def _scores(bundle: SearchBundle, query: str) -> tuple[np.ndarray, np.ndarray]:
    terms = tokenize(query)
    bm25_scores = np.asarray(bundle.bm25.get_scores(terms), dtype=np.float32)
    maximum = float(bm25_scores.max(initial=0))
    if maximum > 0:
        bm25_scores /= maximum
    query_vector = bundle.vectorizer.transform([normalize_text(query)])
    char_scores = np.asarray((bundle.char_matrix @ query_vector.T).toarray()).ravel().astype(np.float32)
    maximum = float(char_scores.max(initial=0))
    if maximum > 0:
        char_scores /= maximum
    return bm25_scores, char_scores


def combined_scores(bundle: SearchBundle, query: str, method: str) -> np.ndarray:
    bm25_scores, char_scores = _scores(bundle, query)
    if method == "BM25":
        return bm25_scores
    if method == "Karakter TF-IDF":
        return char_scores
    if method == "Klasik tam eşleşme":
        query_terms = set(tokenize(query))
        return np.asarray([
            1.0 if query_terms and query_terms.issubset(title_terms) else 0.0
            for title_terms in bundle.title_terms
        ], dtype=np.float32)
    alpha = float(bundle.hybrid_alpha)
    return alpha * bm25_scores + (1.0 - alpha) * char_scores


def top_results(bundle: SearchBundle, query: str, method: str = "Hibrit", limit: int = 10) -> tuple[list[dict[str, str]], float]:
    started = time.perf_counter()
    scores = combined_scores(bundle, query, method)
    order = np.argsort(scores)[::-1]
    products = bundle.products
    results: list[dict[str, str]] = []
    clusters: set[str] = set()
    for index in order:
        score = float(scores[index])
        if score <= 0:
            break
        row = products.iloc[int(index)]
        cluster = str(row["Cluster ID"])
        if cluster in clusters:
            continue
        clusters.add(cluster)
        results.append({
            "title": str(row["Product Title"]),
            "cluster": cluster,
            "category": str(row.get("Category Label", "")),
            "merchant": str(row.get("Merchant ID", "")),
            "score": f"{score:.3f}",
        })
        if len(results) >= limit:
            break
    elapsed_ms = (time.perf_counter() - started) * 1000
    return results, elapsed_ms


def suggest_corrections(bundle: SearchBundle, query: str, max_suggestions: int = 4) -> list[tuple[str, str]]:
    suggestions: list[tuple[str, str]] = []
    seen: set[str] = set()
    frequencies = getattr(bundle, "word_frequencies", None)
    if frequencies is None:
        # Compatibility with model bundles packaged before word frequencies were stored.
        counts: dict[str, int] = {}
        for title in bundle.products["_normalized"].astype(str):
            for token in tokenize(title):
                counts[token] = counts.get(token, 0) + 1
        frequencies = counts
        bundle.word_frequencies = counts
    for word in tokenize(query):
        if len(word) < 4 or word in bundle.vocabulary:
            continue
        candidates = process.extract(word, bundle.vocabulary, scorer=fuzz.ratio, limit=12, score_cutoff=65)
        candidates = [candidate for candidate in candidates if Levenshtein.distance(word, candidate[0]) <= 2]
        if candidates:
            # Prefer the closest spelling first. For equally close words, product-catalog
            # frequency breaks ties (e.g. `tablt` should favor `tablet` over a rarer term).
            best_distance = min(Levenshtein.distance(word, candidate[0]) for candidate in candidates)
            closest = [candidate for candidate in candidates if Levenshtein.distance(word, candidate[0]) == best_distance]
            correction = max(
                closest,
                key=lambda candidate: (
                    candidate[1],
                    int(frequencies.get(candidate[0], 0)),
                    -abs(len(candidate[0]) - len(word)),
                ),
            )[0]
            if correction not in seen:
                suggestions.append((word, correction))
                seen.add(correction)
        if len(suggestions) >= max_suggestions:
            break
    return suggestions


def choose_hybrid_alpha(bundle: SearchBundle, validation: pd.DataFrame) -> float:
    """Pick BM25 weight by validation MRR, only; keep test split untouched."""
    candidates = [round(value, 1) for value in np.linspace(0, 1, 11)]
    accumulated = {alpha: [0.0, 0] for alpha in candidates}
    clusters = bundle.products["Cluster ID"].astype(str).to_numpy()
    for _, example in validation.iterrows():
        bm25_scores, char_scores = _scores(bundle, str(example["query"]))
        target = str(example["cluster_id"])
        for alpha in candidates:
            order = np.argsort(alpha * bm25_scores + (1 - alpha) * char_scores)[::-1]
            seen: set[str] = set()
            rank = 0
            reciprocal = 0.0
            for index in order:
                cluster = clusters[index]
                if cluster in seen:
                    continue
                seen.add(cluster)
                rank += 1
                if cluster == target:
                    reciprocal = 1.0 / rank if rank <= 10 else 0.0
                    break
                if rank >= 10:
                    break
            accumulated[alpha][0] += reciprocal
            accumulated[alpha][1] += 1
    best = max(candidates, key=lambda alpha: accumulated[alpha][0] / max(accumulated[alpha][1], 1))
    return best


def evaluate(bundle: SearchBundle, examples: pd.DataFrame, method: str = "Hibrit") -> dict[str, Any]:
    rows = []
    for _, example in examples.iterrows():
        results, elapsed_ms = top_results(bundle, str(example["query"]), method, limit=10)
        ranked = [item["cluster"] for item in results]
        target = str(example["cluster_id"])
        rank = ranked.index(target) + 1 if target in ranked else None
        rows.append({
            "error_type": str(example["error_type"]),
            "recall@5": int(rank is not None and rank <= 5),
            "recall@10": int(rank is not None and rank <= 10),
            "mrr": 1 / rank if rank else 0,
            "latency_ms": elapsed_ms,
        })
    frame = pd.DataFrame(rows)
    per_type = frame.groupby("error_type").agg(
        count=("error_type", "size"), recall_at_5=("recall@5", "mean"),
        recall_at_10=("recall@10", "mean"), mrr=("mrr", "mean"),
        mean_latency_ms=("latency_ms", "mean"),
    ).reset_index()
    return {
        "query_count": int(len(frame)),
        "recall_at_5": float(frame["recall@5"].mean()),
        "recall_at_10": float(frame["recall@10"].mean()),
        "mrr": float(frame["mrr"].mean()),
        "mean_latency_ms": float(frame["latency_ms"].mean()),
        "per_error_type": per_type.to_dict(orient="records"),
    }
