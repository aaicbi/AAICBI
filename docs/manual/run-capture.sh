#!/bin/sh
# Captures every screenshot the manuals use. Needs the app on :3113 with the demo database.
# The three lists run side by side to save time; annotated figures run last so their marks win.
cd "$(dirname "$0")/../.." || exit 1
node docs/manual/capture.cjs > /tmp/dev/cap-a.log 2>&1 &
SHOTS=shots2.json node docs/manual/capture.cjs > /tmp/dev/cap-b.log 2>&1 &
SHOTS=shots-games.json node docs/manual/capture.cjs > /tmp/dev/cap-c.log 2>&1 &
wait
SHOTS=shots-annotated.json node docs/manual/capture.cjs > /tmp/dev/cap-d.log 2>&1
echo done > /tmp/dev/cap-done
