#!/bin/sh
# Full gate before a commit: typecheck + build, lint and tests. Fails on the first error.
set -e
npm run build --silent > /dev/null
npx oxlint --deny-warnings
npx vitest run --silent > /dev/null
echo "check OK"
