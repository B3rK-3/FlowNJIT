#!/usr/bin/env bash
set -e

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Default configurations
MODE="dev"
START_BACKEND=true
START_FRONTEND=true
START_SCRAPERS=true
START_TUNNEL=false
HOST="${HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="${ROOT_DIR}/website"

# PIDs to manage
BACKEND_PID=""
FRONTEND_PID=""
SCRAPERS_PID=""
TUNNEL_PID=""

# Help text
show_help() {
    echo -e "${BOLD}FlowNJIT Unified Startup Script${NC}"
    echo ""
    echo "Usage: ./start.sh [options]"
    echo ""
    echo "Options:"
    echo "  --dev, -d            Run frontend in development mode (default, uses 'next dev')"
    echo "  --prod, -p           Run frontend in production mode (builds if needed and runs 'next start')"
    echo "  --scrapers, -s       Launch background data scrapers (enabled by default)"
    echo "  --no-scrapers        Do not launch background data scrapers"
    echo "  --tunnel, -t         Start a Cloudflare quick tunnel for the frontend"
    echo "  --backend-only       Start only Redis and the FastAPI backend"
    echo "  --frontend-only      Start only the Next.js frontend"
    echo "  --scrapers-only      Start only Redis and the background scraper worker"
    echo "  --host <ip>          Host to bind services to (default: 0.0.0.0)"
    echo "  --backend-port <p>   Port for backend API (default: 3001)"
    echo "  --port <p>           Port for frontend website (default: 3000)"
    echo "  --help, -h           Show this help message"
    echo ""
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --prod|-p)
            MODE="prod"
            shift
            ;;
        --dev|-d)
            MODE="dev"
            shift
            ;;
        --scrapers|-s)
            START_SCRAPERS=true
            shift
            ;;
        --no-scrapers)
            START_SCRAPERS=false
            shift
            ;;
        --tunnel|-t)
            START_TUNNEL=true
            shift
            ;;
        --backend-only)
            START_FRONTEND=false
            START_SCRAPERS=false
            shift
            ;;
        --frontend-only)
            START_BACKEND=false
            START_SCRAPERS=false
            shift
            ;;
        --scrapers-only)
            START_FRONTEND=false
            START_BACKEND=false
            START_SCRAPERS=true
            shift
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        --port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            ;;
    esac
done

# Cleanup function to kill child processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down FlowNJIT services...${NC}"
    if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "Stopping frontend (PID $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "Stopping backend (PID $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [[ -n "$SCRAPERS_PID" ]] && kill -0 "$SCRAPERS_PID" 2>/dev/null; then
        echo -e "Stopping background scrapers (PID $SCRAPERS_PID)..."
        kill "$SCRAPERS_PID" 2>/dev/null || true
    fi
    if [[ -n "$TUNNEL_PID" ]] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
        echo -e "Stopping Cloudflare tunnel (PID $TUNNEL_PID)..."
        kill "$TUNNEL_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}All services stopped cleanly.${NC}"
}
trap cleanup SIGINT SIGTERM EXIT

# Get local LAN IP address
get_lan_ip() {
    if command -v hostname >/dev/null 2>&1 && hostname -I >/dev/null 2>&1; then
        hostname -I | awk '{print $1}'
    elif command -v ip >/dev/null 2>&1; then
        ip route get 1.1.1.1 2>/dev/null | awk -F"src " 'NR==1{split($2,a," ");print a[1]}'
    elif command -v ifconfig >/dev/null 2>&1; then
        ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1
    else
        echo "127.0.0.1"
    fi
}
LAN_IP="${LAN_IP:-$(get_lan_ip)}"
[ -z "$LAN_IP" ] && LAN_IP="127.0.0.1"

echo -e "${BLUE}${BOLD}=========================================${NC}"
echo -e "${BLUE}${BOLD}        Starting FlowNJIT Stack          ${NC}"
echo -e "${BLUE}${BOLD}=========================================${NC}"

# 1. Check / Start Redis (needed by Backend and Scrapers)
if [ "$START_BACKEND" = true ] || [ "$START_SCRAPERS" = true ]; then
    echo -e "\n${YELLOW}[1/4] Checking Redis...${NC}"
    if command -v redis-cli >/dev/null 2>&1 && redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is already running.${NC}"
    elif command -v redis-server >/dev/null 2>&1; then
        echo -e "Starting Redis server in daemon mode..."
        redis-server --daemonize yes
        sleep 1
        if redis-cli ping >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Redis started successfully.${NC}"
        else
            echo -e "${RED}✗ Failed to start Redis server. Please check your Redis installation.${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}! redis-server or redis-cli not found in PATH. Assuming remote or managed Redis.${NC}"
    fi
fi

# 2. Start Python FastAPI Backend
if [ "$START_BACKEND" = true ]; then
    echo -e "\n${YELLOW}[2/4] Starting FastAPI backend on ${HOST}:${BACKEND_PORT}...${NC}"
    export HOST="${HOST}"
    export PORT="${BACKEND_PORT}"
    
    cd "$ROOT_DIR"
    python3 -m uvicorn backend.server:app --host "$HOST" --port "$BACKEND_PORT" &
    BACKEND_PID=$!
    
    # Wait for backend health check
    echo "Waiting for backend API to initialize..."
    for i in {1..30}; do
        if curl -s -f "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1 || \
           curl -s -f "http://127.0.0.1:${BACKEND_PORT}/" >/dev/null 2>&1; then
            echo -e "${GREEN}✓ Backend API is ready!${NC}"
            break
        fi
        sleep 1
    done
fi

# 3. Background Scrapers
if [ "$START_SCRAPERS" = true ]; then
    echo -e "\n${YELLOW}[3/4] Starting Background Scrapers (course sections and professor ratings)...${NC}"
    cd "$ROOT_DIR"
    python3 -m backend.scrapers &
    SCRAPERS_PID=$!
    sleep 1
    if ! kill -0 "$SCRAPERS_PID" 2>/dev/null; then
        echo -e "${RED}✗ Background scraper worker exited during startup.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Scrapers running in background (logs in backend/logs/scrapers.log).${NC}"
fi

# 4. Start Next.js Frontend
if [ "$START_FRONTEND" = true ]; then
    echo -e "\n${YELLOW}[4/4] Starting Next.js frontend on ${HOST}:${FRONTEND_PORT} (mode: ${MODE})...${NC}"
    cd "$WEBSITE_DIR"

    # Set NEXT_PUBLIC_BACKEND_URL for the frontend if connecting locally/over LAN
    export NEXT_PUBLIC_BACKEND_URL="${NEXT_PUBLIC_BACKEND_URL:-http://${LAN_IP}:${BACKEND_PORT}}"
    export PORT="${FRONTEND_PORT}"
    export HOSTNAME="${HOST}"

    if [ "$MODE" = "prod" ]; then
        echo "Building production bundle with NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}..."
        npm run build
        npm run start -- -p "$FRONTEND_PORT" -H "$HOST" &
        FRONTEND_PID=$!
    else
        npm run dev -- -p "$FRONTEND_PORT" -H "$HOST" &
        FRONTEND_PID=$!
    fi
fi

# 5. Optional Cloudflare Tunnel
if [ "$START_TUNNEL" = true ]; then
    echo -e "\n${YELLOW}Starting Cloudflare Quick Tunnel for frontend (port ${FRONTEND_PORT})...${NC}"
    if command -v cloudflared >/dev/null 2>&1; then
        cloudflared tunnel --url "http://127.0.0.1:${FRONTEND_PORT}" &
        TUNNEL_PID=$!
    else
        echo -e "${RED}cloudflared is not installed. Install it to use --tunnel.${NC}"
    fi
fi

# Summary Banner
echo ""
echo -e "${GREEN}${BOLD}====================================================${NC}"
echo -e "${GREEN}${BOLD}             FlowNJIT is now RUNNING!               ${NC}"
echo -e "${GREEN}${BOLD}====================================================${NC}"
if [ "$START_FRONTEND" = true ]; then
    echo -e "${BOLD}Frontend Web App:${NC}"
    echo -e "  • Local:   ${BLUE}http://localhost:${FRONTEND_PORT}${NC}"
    echo -e "  • Network: ${BLUE}http://${LAN_IP}:${FRONTEND_PORT}${NC}"
fi
if [ "$START_BACKEND" = true ]; then
    echo -e "\n${BOLD}Backend API & Docs:${NC}"
    echo -e "  • Swagger UI:  ${BLUE}http://localhost:${BACKEND_PORT}/docs${NC}"
    echo -e "  • Network API: ${BLUE}http://${LAN_IP}:${BACKEND_PORT}/docs${NC}"
    echo -e "  • Endpoints:   ${BLUE}http://${LAN_IP}:${BACKEND_PORT}/getcourses${NC}"
fi
if [ "$START_SCRAPERS" = true ]; then
    echo -e "\n${BOLD}Background Scrapers:${NC}"
    echo -e "  • Status:      ${GREEN}Active (courses every 5m, RMP every 6h)${NC}"
    echo -e "  • Log File:    ${BLUE}backend/logs/scrapers.log${NC}"
fi
echo -e "\n${YELLOW}Press Ctrl+C anytime to stop all services.${NC}"
echo -e "${GREEN}${BOLD}====================================================${NC}\n"

# Keep the script running and wait for background processes
wait
