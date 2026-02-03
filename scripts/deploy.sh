#!/bin/bash
set -e

# Deploy newsfeed-ai bot (web UI is deployed via Cloudflare Workers)
# Usage: ./scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$(dirname "$SCRIPT_DIR")"
BOT_SERVICE="newsfeed-ai-bot"
DEPLOY_USER="${DEPLOY_USER:-exedev}"
DEPLOY_DIR="/home/$DEPLOY_USER/newsfeed-ai"

echo "🚀 Deploying newsfeed-ai..."

# In CI, update the deploy directory from remote
# (CI runner checks out to a different directory, but services run from DEPLOY_DIR)
if [ -n "$CI" ]; then
    echo "📥 Updating deploy directory..."
    cd "$DEPLOY_DIR"
    git fetch origin main
    git reset --hard origin/main

    echo "📦 Installing dependencies..."
    bun install --ignore-scripts
fi

# For manual deploys, pull and install in the current directory
if [ -z "$CI" ]; then
    cd "$SOURCE_DIR"
    echo "📥 Pulling latest changes..."
    git pull --ff-only

    echo "📦 Installing dependencies..."
    bun install --ignore-scripts
    DEPLOY_DIR="$SOURCE_DIR"
fi

# From here, work in the deploy directory
cd "$DEPLOY_DIR"
PROJECT_DIR="$DEPLOY_DIR"

# Update systemd service files from examples
update_service_file() {
    local example_file="$1"
    local service_name="$2"
    local system_file="/etc/systemd/system/${service_name}.service"

    if [ -f "$example_file" ]; then
        # Generate service file from example
        local generated=$(sed "s/__USER__/$DEPLOY_USER/g" "$example_file")

        # Check if system file exists and differs
        if [ -f "$system_file" ]; then
            local current=$(sudo cat "$system_file")
            if [ "$generated" != "$current" ]; then
                echo "📝 Updating $service_name service file..."
                echo "$generated" | sudo tee "$system_file" > /dev/null
                sudo systemctl daemon-reload
            fi
        else
            echo "📝 Installing $service_name service file..."
            echo "$generated" | sudo tee "$system_file" > /dev/null
            sudo systemctl daemon-reload
            sudo systemctl enable "$service_name"
        fi
    fi
}

update_service_file "$PROJECT_DIR/systemd/newsfeed-ai-bot.service" "$BOT_SERVICE"

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

echo "✅ Deploy complete!"
