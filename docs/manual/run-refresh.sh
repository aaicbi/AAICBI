#!/bin/sh
# Retakes only the screens that changed after the password, Trainees page and Dashboard fixes.
cd "$(dirname "$0")/../.." || exit 1
for f in org/forgot-password org/trainees org/login org/admin-dashboard org/settings org/dashboard trainee/settings; do
  node docs/manual/capture.cjs "$f"
done
SHOTS=shots-annotated.json node docs/manual/capture.cjs org/login
SHOTS=shots-annotated.json node docs/manual/capture.cjs org/settings
echo done > /tmp/dev/refresh-done
