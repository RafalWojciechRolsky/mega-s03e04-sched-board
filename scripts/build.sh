#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SHA=$(git rev-parse HEAD 2>/dev/null || echo "local")
rm -rf dist && mkdir -p dist && cp app/* dist/
sed -i "s/__BUILD__/$SHA/g" dist/index.html
echo "build: $SHA → dist/"
