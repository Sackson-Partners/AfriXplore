import sys
import os

# Ensure `src` package is importable when pytest runs from the repo root
# or from the service directory.
sys.path.insert(0, os.path.dirname(__file__))
