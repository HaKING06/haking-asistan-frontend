"""Build the redistributable desktop ZIP while excluding local training data."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parent
SITE_ROOT = ROOT.parent if (ROOT.parent / "download.html").is_file() else ROOT.parent / "frontend"
DESTINATION = SITE_ROOT / "downloads" / "haking-ai-desktop-v0.1.2.zip"
INCLUDE_FILES = [
    "VERSION", "README.md", "LICENSE", "requirements.txt", "main.py", "train.py",
    "package_release.py", "start.bat", "start.sh", "src/__init__.py", "src/data.py",
    "src/model.py", "src/product_search.py", "src/error_analyzer.py", "src/gui.py",
    "data/KAYNAK.md", "data/ornek_urun_sorgulari.csv", "data/ornek_hata_mesajlari.csv",
    "assets/logo-mark.png", "models/product_search.joblib", "models/error_classifier.joblib",
    "results/metrics.json", "results/synthetic_queries.csv", "results/test_predictions.csv",
]


def main() -> None:
    missing = [relative for relative in INCLUDE_FILES if not (ROOT / relative).is_file()]
    if missing:
        raise SystemExit("Paket dosyaları eksik: " + ", ".join(missing))
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(DESTINATION, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for relative in INCLUDE_FILES:
            archive.write(ROOT / relative, f"HaKING-AI-Desktop/{relative}")
    print(f"{DESTINATION} ({DESTINATION.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
