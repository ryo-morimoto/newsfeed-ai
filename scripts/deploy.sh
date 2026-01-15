#!/bin/bash
set -e

# Deploy newsfeed-ai bot and web UI
# Usage: ./scripts/deploy.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BOT_SERVICE="newsfeed-ai-bot"
WEB_SERVICE="newsfeed-ai-web"
DEPLOY_USER="${DEPLOY_USER:-exedev}"

echo "🚀 Deploying newsfeed-ai..."

cd "$PROJECT_DIR"

# Skip git pull in CI (already checked out by GitHub Actions)
if [ -z "$CI" ]; then
    echo "📥 Pulling latest changes..."
    git pull --ff-only

    echo "📦 Installing dependencies..."
    bun install
fi

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
update_service_file "$PROJECT_DIR/systemd/newsfeed-ai-web.service" "$WEB_SERVICE"

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

# Restart web service (if installed)
if [ -f "/etc/systemd/system/${WEB_SERVICE}.service" ]; then
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
    echo "⚠️  Web service not configured (no example file). Skipping."
fi

echo "✅ Deploy complete!"
