#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
PYTHON_BIN="${PYTHON_BIN:-python3}"
"$PYTHON_BIN" -c 'import sys; assert (3,11) <= sys.version_info[:2] <= (3,13), "Python 3.11–3.13 gerekli"'
if [ ! -x .venv/bin/python ]; then
  "$PYTHON_BIN" -m venv .venv
fi
if [ ! -f .venv/.haking-dependencies-ready ]; then
  .venv/bin/python -m pip install -r requirements.txt
  touch .venv/.haking-dependencies-ready
fi
.venv/bin/python main.py
