#!/bin/sh
set -e

# If npm ci failed and node_modules is missing — install packages as fallback
if [ ! -f "node_modules/.bin/vite" ]; then
  echo ">>> vite not found — running npm install as fallback..."
  npm install --ignore-scripts
fi

echo ">>> Running vite build..."
./node_modules/.bin/vite build

echo ">>> Bundling server with esbuild..."
./node_modules/.bin/esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --minify \
  --outfile=dist/index.js

echo ">>> Build complete."
