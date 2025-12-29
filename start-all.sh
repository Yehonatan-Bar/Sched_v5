#!/bin/bash
# Start both backend and frontend servers for Sched_v5
# This script runs both services and handles cleanup on exit

cd "$(dirname "$0")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cleanup function to kill background processes
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"

    if [ ! -z "$BACKEND_PID" ]; then
        echo -e "${BLUE}Stopping backend (PID: $BACKEND_PID)...${NC}"
        kill $BACKEND_PID 2>/dev/null
    fi

    if [ ! -z "$FRONTEND_PID" ]; then
        echo -e "${BLUE}Stopping frontend (PID: $FRONTEND_PID)...${NC}"
        kill $FRONTEND_PID 2>/dev/null
    fi

    # Wait a moment for graceful shutdown
    sleep 1

    # Force kill if still running
    if [ ! -z "$BACKEND_PID" ]; then
        kill -9 $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill -9 $FRONTEND_PID 2>/dev/null
    fi

    echo -e "${GREEN}All servers stopped.${NC}"
    exit 0
}

# Set up trap to catch Ctrl+C and other exit signals
trap cleanup SIGINT SIGTERM EXIT

echo -e "${GREEN}Starting Sched_v5 Application${NC}"
echo "======================================"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}Error: Virtual environment not found!${NC}"
    echo "Please run ./setup-backend.sh first to set up the environment."
    exit 1
fi

# Check if node_modules exists in frontend
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}Frontend dependencies not found. Installing...${NC}"
    cd frontend
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to install frontend dependencies${NC}"
        exit 1
    fi
    cd ..
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
    echo ""
fi

# Start backend server
echo -e "${BLUE}Starting Backend Server...${NC}"
source venv/bin/activate
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload > backend.log 2>&1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Check if backend is running
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Backend failed to start. Check backend.log for details.${NC}"
    cat backend.log
    exit 1
fi

echo -e "${GREEN}✓ Backend running on http://0.0.0.0:8000 (PID: $BACKEND_PID)${NC}"
echo -e "  API docs: http://localhost:8000/docs"
echo ""

# Start frontend server
echo -e "${BLUE}Starting Frontend Server...${NC}"
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a moment for frontend to start
sleep 3

# Check if frontend is running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}Error: Frontend failed to start. Check frontend.log for details.${NC}"
    cat frontend.log
    cleanup
    exit 1
fi

echo -e "${GREEN}✓ Frontend running on http://localhost:5173 (PID: $FRONTEND_PID)${NC}"
echo ""
echo "======================================"
echo -e "${GREEN}All servers running!${NC}"
echo ""
echo "Access the application at: ${BLUE}http://localhost:5173${NC}"
echo "Backend API at: ${BLUE}http://localhost:8000${NC}"
echo "API Documentation: ${BLUE}http://localhost:8000/docs${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""
echo "Logs:"
echo "  Backend: tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""

# Keep script running and show logs
tail -f backend.log frontend.log &
TAIL_PID=$!

# Wait for user interrupt
wait
