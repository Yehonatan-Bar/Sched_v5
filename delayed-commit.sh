#!/bin/bash
# Script: delayed-commit.sh
# Waits 10 minutes then adds, commits, and pushes all changes

WAIT_MINUTES=10
WAIT_SECONDS=$((WAIT_MINUTES * 60))

echo "Waiting $WAIT_MINUTES minutes before committing..."
echo "Will commit at: $(date -d "+$WAIT_MINUTES minutes" 2>/dev/null || date)"

sleep $WAIT_SECONDS

echo "Time's up! Adding, committing, and pushing..."

git add .
git commit -m "Auto-commit after $WAIT_MINUTES minute delay"
git push

echo "Done!"
