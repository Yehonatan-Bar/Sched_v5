#!/bin/bash
# Setup script for Sched_v5 backend
# Creates virtual environment and installs dependencies

cd "$(dirname "$0")"

echo "Setting up Sched_v5 backend..."
echo ""

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create virtual environment"
        exit 1
    fi
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate

# Install/upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo ""
echo "Installing dependencies from backend/requirements.txt..."
pip install -r backend/requirements.txt

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Setup complete!"
    echo ""
    echo "To start the backend server, run:"
    echo "  ./start-backend.sh"
else
    echo ""
    echo "Error: Failed to install dependencies"
    exit 1
fi
