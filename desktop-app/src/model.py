"""Model-agnostic DataFrame interface used by the coursework brief."""

from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd

from .product_search import top_results


MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "product_search.joblib"


class HaKINGModel:
    """Expose the required predict(DataFrame) interface without cloud dependencies."""

    def __init__(self, model_path: Path = MODEL_PATH):
        self.bundle = joblib.load(model_path)

    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        if not isinstance(df, pd.DataFrame):
            raise TypeError("predict() pandas DataFrame bekler.")
        if "query" not in df.columns:
            raise ValueError("Girdi DataFrame'inde 'query' sütunu bulunmalı.")
        output: list[dict[str, object]] = []
        for row_index, row in df.iterrows():
            query = str(row["query"])
            method = str(row.get("method", "Hibrit"))
            results, latency_ms = top_results(self.bundle, query, method, limit=10)
            if not results:
                output.append({"row_index": row_index, "query": query, "rank": None, "product": None, "cluster_id": None, "score": 0.0, "latency_ms": latency_ms})
            for rank, result in enumerate(results, 1):
                output.append({
                    "row_index": row_index, "query": query, "rank": rank,
                    "product": result["title"], "cluster_id": result["cluster"],
                    "score": float(result["score"]), "latency_ms": latency_ms,
                })
        return pd.DataFrame(output)


def predict(df: pd.DataFrame) -> pd.DataFrame:
    """Convenience entry point matching the assignment's model.py contract."""
    return HaKINGModel().predict(df)
