#!/bin/sh
# Rebuilds the app, restarts the demo server, retakes the Trainees screens and rebuilds the three PDFs.
cd "$(dirname "$0")/../.." || exit 1
npx next build > /tmp/dev/next-build.log 2>&1 || { echo build-failed > /tmp/dev/final-done; exit 1; }
for p in $(pgrep -f "next-serve[r]"); do kill "$p"; done
sleep 2
DATABASE_URL=postgresql://dev:dev@127.0.0.1:5544/aaicbi_dev AUTH_SECRET=0123456789012345678901234567890123456789 nohup npx next start -p 3113 > /tmp/dev/server.log 2>&1 &
sleep 8
node docs/manual/capture.cjs org/trainees
node docs/manual/build.cjs > /tmp/dev/build-final.log 2>&1
echo done > /tmp/dev/final-done
