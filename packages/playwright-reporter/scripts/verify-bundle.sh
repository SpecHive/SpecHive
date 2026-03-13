#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Playwright Reporter Bundle Verification ==="
echo ""

# 1. Check dist/index.js exists
echo "1. Checking dist/index.js exists..."
if [ ! -f "$PKG_DIR/dist/index.js" ]; then
  echo "FAIL: dist/index.js not found. Run 'pnpm build' first."
  exit 1
fi
echo "   OK"

# 2. Check dist/index.d.ts exists
echo "2. Checking dist/index.d.ts exists..."
if [ ! -f "$PKG_DIR/dist/index.d.ts" ]; then
  echo "FAIL: dist/index.d.ts not found."
  exit 1
fi
echo "   OK"

# 3. Verify no workspace imports leak into .d.ts
echo "3. Checking .d.ts for leaked workspace imports..."
if grep -q '@assertly/shared-types' "$PKG_DIR/dist/index.d.ts" 2>/dev/null; then
  echo "FAIL: dist/index.d.ts contains '@assertly/shared-types' import"
  echo "   Fix: set dts: { resolve: true } in tsup.config.ts"
  exit 1
fi
if grep -q '@assertly/reporter-core-protocol' "$PKG_DIR/dist/index.d.ts" 2>/dev/null; then
  echo "FAIL: dist/index.d.ts contains '@assertly/reporter-core-protocol' import"
  echo "   Fix: set dts: { resolve: true } in tsup.config.ts"
  exit 1
fi
echo "   OK — no workspace imports leaked"

# 4. Verify shared-types code is inlined in dist/index.js
echo "4. Checking shared-types are bundled into dist/index.js..."
if grep -q '@assertly/shared-types' "$PKG_DIR/dist/index.js" 2>/dev/null; then
  echo "WARN: dist/index.js references '@assertly/shared-types' — may not be fully bundled"
fi
if grep -q '@assertly/reporter-core-protocol' "$PKG_DIR/dist/index.js" 2>/dev/null; then
  echo "WARN: dist/index.js references '@assertly/reporter-core-protocol' — may not be fully bundled"
fi
echo "   OK"

# 5. Verify package.json has zero runtime dependencies
echo "5. Checking package.json has no runtime dependencies..."
if node -e "
  const pkg = require('$PKG_DIR/package.json');
  const deps = Object.keys(pkg.dependencies || {});
  if (deps.length > 0) {
    console.error('FAIL: Found runtime dependencies:', deps.join(', '));
    process.exit(1);
  }
" 2>/dev/null; then
  echo "   OK — zero runtime dependencies"
else
  echo "FAIL: package.json should have zero runtime dependencies"
  exit 1
fi

# 6. Verify npm pack contents
echo "6. Checking npm pack --dry-run contents..."
PACK_OUTPUT=$(cd "$PKG_DIR" && npm pack --dry-run 2>&1)
if ! echo "$PACK_OUTPUT" | grep -q 'dist/index.js'; then
  echo "FAIL: dist/index.js not in tarball"
  exit 1
fi
if ! echo "$PACK_OUTPUT" | grep -q 'dist/index.d.ts'; then
  echo "FAIL: dist/index.d.ts not in tarball"
  exit 1
fi
echo "   OK — tarball contains expected files"

# 7. ESM smoke test
echo "7. Running ESM smoke test..."
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cd "$PKG_DIR" && npm pack --pack-destination "$TMPDIR" > /dev/null 2>&1
cd "$TMPDIR"
npm init -y > /dev/null 2>&1
# Set type to module for ESM import
node -e "const p = require('./package.json'); p.type = 'module'; require('fs').writeFileSync('./package.json', JSON.stringify(p, null, 2))"
npm install assertly-playwright-reporter-*.tgz > /dev/null 2>&1
node -e "import('@assertly/playwright-reporter').then(m => { if (!m.default && !m.AssertlyReporter) { console.error('FAIL: No default or named export found'); process.exit(1); } console.log('   OK — ESM import succeeded') }).catch(e => { console.error('FAIL:', e.message); process.exit(1); })"

echo ""
echo "=== All checks passed ==="
