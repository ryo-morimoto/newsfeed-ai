#!/bin/bash
set -e

# Setup GitHub Actions self-hosted runner on exe.dev VM
#
# Prerequisites:
# 1. Get a runner token from GitHub:
#    - Go to https://github.com/ryo-morimoto/newsfeed-ai/settings/actions/runners/new
#    - Copy the token shown in the configure step
#
# Usage:
#    ./scripts/setup-gh-runner.sh <RUNNER_TOKEN>
#
# After setup, the runner will automatically start on boot via systemd.

if [ -z "$1" ]; then
    echo "Usage: $0 <RUNNER_TOKEN>"
    echo ""
    echo "Get a runner token from:"
    echo "  https://github.com/ryo-morimoto/newsfeed-ai/settings/actions/runners/new"
    exit 1
fi

RUNNER_TOKEN="$1"
RUNNER_DIR="/home/exedev/actions-runner"
REPO_URL="https://github.com/ryo-morimoto/newsfeed-ai"

echo "Setting up GitHub Actions runner..."

# Create runner directory
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

# Download latest runner
if [ ! -f "./config.sh" ]; then
    echo "Downloading GitHub Actions runner..."
    RUNNER_VERSION=$(curl -s https://api.github.com/repos/actions/runner/releases/latest | grep '"tag_name":' | sed -E 's/.*"v([^"]+)".*/\1/')
    curl -o actions-runner-linux-x64.tar.gz -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
    tar xzf actions-runner-linux-x64.tar.gz
    rm actions-runner-linux-x64.tar.gz
fi

# Configure runner
echo "Configuring runner..."
./config.sh --url "$REPO_URL" --token "$RUNNER_TOKEN" --unattended --replace

# Create systemd service
echo "Creating systemd service..."
cat > gh-actions-runner.service << 'EOF'
[Unit]
Description=GitHub Actions Runner
After=network.target

[Service]
ExecStart=/home/exedev/actions-runner/run.sh
User=exedev
WorkingDirectory=/home/exedev/actions-runner
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo mv gh-actions-runner.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gh-actions-runner.service

echo ""
echo "GitHub Actions runner setup complete!"
echo "Checking status..."
sudo systemctl status gh-actions-runner.service --no-pager
