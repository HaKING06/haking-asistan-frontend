"""HaKING AI Desktop başlatıcısı."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from src.gui import HaKINGDesktopApp


if __name__ == "__main__":
    HaKINGDesktopApp().run()
