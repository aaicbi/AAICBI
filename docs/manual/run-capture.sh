#!/bin/sh
# Captures every screenshot the manuals use (server on :3113 with the demo database).
cd "$(dirname "$0")/../.." || exit 1
node docs/manual/capture.cjs
SHOTS=shots-games.json node docs/manual/capture.cjs
SHOTS=shots2.json node docs/manual/capture.cjs
