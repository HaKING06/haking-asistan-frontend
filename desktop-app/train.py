"""Veri kümesini, hibrit arama indeksini ve çevrimdışı hata modelini üretir."""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.pipeline import FeatureUnion, Pipeline

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from src.data import generate_queries, load_products
from src.error_analyzer import make_training_data
from src.product_search import evaluate, train_search_bundle, choose_hybrid_alpha, top_results


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def train_error_model() -> tuple[Pipeline, dict]:
    messages, labels, groups = make_training_data()
    # Keep every near-identical prefix/suffix variant of one source signature
    # in the same split; validation holds out one base signature per category.
    grouped: dict[tuple[str, str], list[int]] = {}
    for index, (category, group) in enumerate(zip(labels, groups)):
        grouped.setdefault((category, group), []).append(index)
    train_indices: list[int] = []
    test_indices: list[int] = []
    categories = sorted(set(labels))
    for category in categories:
        category_groups = sorted(group for group_category, group in grouped if group_category == category)
        if len(category_groups) < 2:
            raise ValueError(f"Hata kategorisi için bağımsız örnek imzası yetersiz: {category}")
        held_out = category_groups[-1]
        for group in category_groups:
            target = test_indices if group == held_out else train_indices
            target.extend(grouped[(category, group)])
    X_train = [messages[index] for index in train_indices]
    X_test = [messages[index] for index in test_indices]
    y_train = [labels[index] for index in train_indices]
    y_test = [labels[index] for index in test_indices]
    features = FeatureUnion([
        ("word", TfidfVectorizer(analyzer="word", ngram_range=(1, 2), min_df=1, sublinear_tf=True, max_features=16_000)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=1, sublinear_tf=True, max_features=40_000)),
    ])
    classifier = Pipeline([
        ("features", features),
        ("classifier", LogisticRegression(max_iter=1_200, class_weight="balanced", random_state=42)),
    ])
    classifier.fit(X_train, y_train)
    predictions = classifier.predict(X_test)
    metrics = {
        "train_examples": len(X_train),
        "validation_examples": len(X_test),
        "validation_accuracy": float(accuracy_score(y_test, predictions)),
        "categories": sorted(set(labels)),
        "evaluation_note": "Kategori başına kaynak hata imzası grupları ayrılarak sentetik held-out örneklerde ölçülmüştür; gerçek hata mesajlarında kesinlik garantisi değildir.",
        "classification_report": classification_report(y_test, predictions, output_dict=True, zero_division=0),
    }
    return classifier, metrics


def main() -> int:
    model_dir, results_dir = ROOT / "models", ROOT / "results"
    model_dir.mkdir(parents=True, exist_ok=True)
    results_dir.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()

    print("[1/5] PriceRunner ürün kayıtları yükleniyor…", flush=True)
    products = load_products()
    print(f"      {len(products):,} ürün kaydı · {products['Cluster ID'].nunique():,} ürün kümesi", flush=True)

    print("[2/5] Yazım hatalı sorgular üretiliyor (sabit seed: 20261109)…", flush=True)
    queries = generate_queries(products, per_type=100, seed=20261109)
    queries.to_csv(results_dir / "synthetic_queries.csv", index=False, encoding="utf-8-sig")
    validation = queries[queries["split"] == "validation"].reset_index(drop=True)
    test = queries[queries["split"] == "test"].reset_index(drop=True)
    print(f"      {len(queries)} sorgu · doğrulama {len(validation)} · test {len(test)}", flush=True)

    print("[3/5] BM25 ve karakter TF-IDF dizinleri oluşturuluyor…", flush=True)
    bundle = train_search_bundle(products)
    print("      Hibrit ağırlığı yalnızca doğrulama kümesinde seçiliyor…", flush=True)
    bundle.hybrid_alpha = choose_hybrid_alpha(bundle, validation)
    print(f"      BM25 ağırlığı: {bundle.hybrid_alpha:.1f}", flush=True)

    print("[4/5] Ayrı test kümesinde Recall@5, Recall@10, MRR ve gecikme ölçülüyor…", flush=True)
    product_metrics = {}
    prediction_rows = []
    methods = ["Klasik tam eşleşme", "BM25", "Karakter TF-IDF", "Hibrit"]
    for method in methods:
        method_bundle = bundle
        if method == "Klasik tam eşleşme":
            # Exact baseline deliberately stays simple and is not used to tune the AI index.
            pass
        result = evaluate(method_bundle, test, method=method)
        product_metrics[method] = result
        print(f"      {method}: Recall@5={result['recall_at_5']:.3f}, MRR={result['mrr']:.3f}, {result['mean_latency_ms']:.1f} ms", flush=True)
    for _, example in test.iterrows():
        hits, latency_ms = top_results(bundle, str(example["query"]), "Hibrit", 10)
        for rank, hit in enumerate(hits, 1):
            prediction_rows.append({
                "query": example["query"], "error_type": example["error_type"],
                "expected_cluster": example["cluster_id"], "rank": rank,
                "result_cluster": hit["cluster"], "product_title": hit["title"],
                "latency_ms": round(latency_ms, 3),
            })
    pd.DataFrame(prediction_rows).to_csv(results_dir / "test_predictions.csv", index=False, encoding="utf-8-sig")

    print("[5/5] Çevrimdışı yazılım hata modeli eğitiliyor ve dosyalar kaydediliyor…", flush=True)
    error_model, error_metrics = train_error_model()
    joblib.dump(bundle, model_dir / "product_search.joblib", compress=3)
    joblib.dump(error_model, model_dir / "error_classifier.joblib", compress=3)
    metrics = {
        "app_version": "0.1.2",
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "random_seed": 20261109,
        "dataset": {
            "name": "UCI Product Classification and Clustering (PriceRunner)",
            "rows": int(len(products)), "clusters": int(products["Cluster ID"].nunique()),
            "categories": int(products.get("Category Label", pd.Series(dtype=str)).nunique()),
            "source": "https://archive.ics.uci.edu/dataset/837/product+classification",
            "license": "CC BY 4.0",
        },
        "query_experiment": {
            "total": int(len(queries)), "validation": int(len(validation)), "test": int(len(test)),
            "split_unit": "Cluster ID; a cluster occurs in only one split",
            "per_error_type_counts": queries.groupby(["split", "error_type"]).size().unstack(fill_value=0).to_dict(orient="index"),
        },
        "selected_bm25_weight": bundle.hybrid_alpha,
        "methods": product_metrics,
        "error_classifier": error_metrics,
        "total_training_seconds": round(time.perf_counter() - started, 2),
        "limits": "Offline suggestions are ranked retrievals and likely error diagnoses, not proof or a guarantee for every language/compiler/version.",
    }
    write_json(results_dir / "metrics.json", metrics)
    print(f"Hazır. Modeller: {model_dir}; metrikler: {results_dir / 'metrics.json'}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
