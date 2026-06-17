#!/bin/sh
# Point this repo at .githooks so pre-commit runs check-updates-md.mjs
set -e
cd "$(dirname "$0")/.."
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
echo "Installed git hooks from .githooks (pre-commit → check-updates-md.mjs)"
