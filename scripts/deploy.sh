#!/bin/bash
set -e

# Deploy newsfeed-ai bot and web UI
# Usage: ./scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BOT_SERVICE="newsfeed-ai-bot"
WEB_SERVICE="newsfeed-ai-web"

echo "🚀 Deploying newsfeed-ai..."

cd "$PROJECT_DIR"

# Skip git pull in CI (already checked out by GitHub Actions)
if [ -z "$CI" ]; then
    echo "📥 Pulling latest changes..."
    git pull --ff-only

    echo "📦 Installing dependencies..."
    bun install
fi

# Build web UI
echo "🔨 Building web UI..."
cd "$PROJECT_DIR/web"
bun install
bun run build
cd "$PROJECT_DIR"

# Restart bot service
echo "🔄 Restarting bot service..."
sudo systemctl restart "$BOT_SERVICE"

# Check bot status
sleep 2
if systemctl is-active --quiet "$BOT_SERVICE"; then
    echo "✅ Bot service is running."
else
    echo "❌ Bot service failed to start. Check logs:"
    sudo journalctl -u "$BOT_SERVICE" -n 20 --no-pager
    exit 1
fi

# Restart web service (if exists)
if systemctl list-unit-files | grep -q "$WEB_SERVICE"; then
    echo "🔄 Restarting web service..."
    sudo systemctl restart "$WEB_SERVICE"

    sleep 2
    if systemctl is-active --quiet "$WEB_SERVICE"; then
        echo "✅ Web service is running."
    else
        echo "❌ Web service failed to start. Check logs:"
        sudo journalctl -u "$WEB_SERVICE" -n 20 --no-pager
        exit 1
    fi
else
    echo "⚠️  Web service not configured. Skipping."
fi

echo "✅ Deploy complete!"
