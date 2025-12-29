#!/bin/bash
# Start the Sched_v5 backend server
# This script ensures uvicorn is run with the correct module path

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Error: Virtual environment not found!"
    echo "Please run ./setup-backend.sh first to set up the environment."
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

# Run uvicorn with correct module path
echo "Starting Sched_v5 backend server..."
echo "Server will be available at http://0.0.0.0:8000"
echo "API docs at http://0.0.0.0:8000/docs"
echo "Press Ctrl+C to stop"
echo ""

uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
