#!/bin/bash
set -e

# Deploy newsfeed-ai bot
# Usage: ./scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="newsfeed-ai-bot"

echo "🚀 Deploying newsfeed-ai..."

cd "$PROJECT_DIR"

# Skip git pull in CI (already checked out by GitHub Actions)
if [ -z "$CI" ]; then
    echo "📥 Pulling latest changes..."
    git pull --ff-only

    echo "📦 Installing dependencies..."
    bun install
fi

# Restart service
echo "🔄 Restarting service..."
sudo systemctl restart "$SERVICE_NAME"

# Check status
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Deploy complete! Service is running."
else
    echo "❌ Service failed to start. Check logs:"
    sudo journalctl -u "$SERVICE_NAME" -n 20 --no-pager
    exit 1
fi
