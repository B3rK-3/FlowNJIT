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
MODE="prod"
FORCE_BUILD=true
START_BACKEND=true
START_FRONTEND=true
START_SCRAPERS=true
START_TUNNEL=true
TUNNEL_TOKEN=""
TUNNEL_NAME=""
HOST="${HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="${ROOT_DIR}/website"
LOGS_DIR="${ROOT_DIR}/backend/logs"
mkdir -p "$LOGS_DIR"

# Read only the two Cloudflare values; never execute backend/.env as shell code.
read_env_value() {
    local key="$1"
    local file="$2"
    local line
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%$'\r'}"
        case "$line" in
            "${key}="*)
                printf '%s' "${line#*=}"
                return 0
                ;;
        esac
    done < "$file"
}

ENV_FILE="${ROOT_DIR}/backend/.env"
if [ -f "$ENV_FILE" ]; then
    TUNNEL_TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:-$(read_env_value CLOUDFLARE_TUNNEL_TOKEN "$ENV_FILE")}"
    TUNNEL_NAME="${CLOUDFLARE_TUNNEL_NAME:-$(read_env_value CLOUDFLARE_TUNNEL_NAME "$ENV_FILE")}"
else
    TUNNEL_TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:-$TUNNEL_TOKEN}"
    TUNNEL_NAME="${CLOUDFLARE_TUNNEL_NAME:-$TUNNEL_NAME}"
fi

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
    echo "  --prod, -p           Serve production build (default, uses 'next start')"
    echo "  --dev, -d            Run frontend in development mode (hot reloading, uses 'next dev')"
    echo "  --nobuild            Skip building the production frontend (use existing .next)"
    echo "  --scrapers, -s       Launch background data scrapers (enabled by default)"
    echo "  --no-scrapers        Do not launch background data scrapers"
    echo "  --tunnel, -t         Start Cloudflare tunnel (enabled by default; uses token if set)"
    echo "  --no-tunnel          Do not start Cloudflare tunnel"
    echo "  --tunnel-token <tok> Start Cloudflare Zero Trust tunnel using a dashboard token"
    echo "  --tunnel-name <name> Start Cloudflare named tunnel by name"
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
        --nobuild)
            FORCE_BUILD=false
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
        --no-tunnel)
            START_TUNNEL=false
            shift
            ;;
        --tunnel-token)
            START_TUNNEL=true
            TUNNEL_TOKEN="$2"
            shift 2
            ;;
        --tunnel-name)
            START_TUNNEL=true
            TUNNEL_NAME="$2"
            shift 2
            ;;
        --backend-only)
            START_FRONTEND=false
            START_SCRAPERS=false
            START_TUNNEL=false
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
            START_TUNNEL=false
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
    
    # Model download and Chroma initialization can be slow on a phone.
    echo "Waiting for backend API to initialize..."
    BACKEND_READY=false
    for ((i = 0; i < ${BACKEND_STARTUP_TIMEOUT:-900}; i++)); do
        if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            echo -e "${RED}✗ Backend exited during startup.${NC}"
            exit 1
        fi
        if curl -s -f "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null 2>&1; then
            BACKEND_READY=true
            break
        fi
        sleep 1
    done
    if [ "$BACKEND_READY" != true ]; then
        echo -e "${RED}✗ Backend did not become ready before the timeout.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Backend API is ready!${NC}"
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

    # Browser requests use same-path Next.js rewrites. Server-side rendering
    # reaches FastAPI directly over loopback.
    export BACKEND_INTERNAL_URL="${BACKEND_INTERNAL_URL:-http://127.0.0.1:${BACKEND_PORT}}"
    export PORT="${FRONTEND_PORT}"
    export HOSTNAME="${HOST}"

    if [ "$MODE" = "prod" ]; then
        if [ ! -d ".next" ] || [ "$FORCE_BUILD" = true ]; then
            echo "Building production bundle..."
            npm run build
        else
            echo "Serving existing production build (.next)..."
        fi
        npm run start -- -p "$FRONTEND_PORT" -H "$HOST" &
        FRONTEND_PID=$!
    else
        npm run dev -- -p "$FRONTEND_PORT" -H "$HOST" &
        FRONTEND_PID=$!
    fi

    FRONTEND_READY=false
    for ((i = 0; i < ${FRONTEND_STARTUP_TIMEOUT:-120}; i++)); do
        if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
            echo -e "${RED}✗ Frontend exited during startup.${NC}"
            exit 1
        fi
        if curl -s -f "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null 2>&1; then
            FRONTEND_READY=true
            break
        fi
        sleep 1
    done
    if [ "$FRONTEND_READY" != true ]; then
        echo -e "${RED}✗ Frontend did not become ready before the timeout.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Frontend is ready!${NC}"
fi

# 5. Optional Cloudflare Tunnel
TUNNEL_URL=""
if [ "$START_TUNNEL" = true ]; then
    echo -e "\n${YELLOW}Starting Cloudflare Tunnel...${NC}"
    if command -v cloudflared >/dev/null 2>&1; then
        TUNNEL_LOG="${LOGS_DIR}/tunnel.log"
        > "$TUNNEL_LOG"
        
        if [ -n "$TUNNEL_TOKEN" ]; then
            echo -e "Launching Cloudflare Zero Trust Tunnel via Dashboard Token..."
            cloudflared tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" > "$TUNNEL_LOG" 2>&1 &
            TUNNEL_PID=$!
            TUNNEL_URL="Managed in Cloudflare Zero Trust"
        elif [ -n "$TUNNEL_NAME" ]; then
            echo -e "Launching Cloudflare Named Tunnel: $TUNNEL_NAME..."
            cloudflared tunnel --no-autoupdate run "$TUNNEL_NAME" > "$TUNNEL_LOG" 2>&1 &
            TUNNEL_PID=$!
            TUNNEL_URL="Named tunnel: $TUNNEL_NAME"
        else
            echo -e "Launching Cloudflare Quick Tunnel for http://127.0.0.1:${FRONTEND_PORT}..."
            cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${FRONTEND_PORT}" > "$TUNNEL_LOG" 2>&1 &
            TUNNEL_PID=$!
        fi

        TUNNEL_CONNECTED=false
        for i in {1..30}; do
            if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
                break
            fi
            if [ -z "$TUNNEL_TOKEN" ] && [ -z "$TUNNEL_NAME" ]; then
                QUICK_URL=$(grep -o 'https://[-a-zA-Z0-9]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -n1 || true)
                if [ -n "$QUICK_URL" ]; then
                    TUNNEL_URL="$QUICK_URL"
                fi
            fi
            if grep -Eq 'Registered tunnel connection|Connection .* registered' "$TUNNEL_LOG"; then
                TUNNEL_CONNECTED=true
                break
            fi
            sleep 1
        done

        if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
            echo -e "${RED}✗ Cloudflare tunnel exited during startup:${NC}"
            tail -n 20 "$TUNNEL_LOG"
            exit 1
        elif [ "$TUNNEL_CONNECTED" = true ]; then
            echo -e "${GREEN}✓ Cloudflare tunnel registered a connection.${NC}"
        else
            echo -e "${YELLOW}! cloudflared is running, but registration was not confirmed within 30 seconds.${NC}"
            echo -e "${YELLOW}  Inspect ${TUNNEL_LOG}${NC}"
        fi
    else
        if [ -n "$TUNNEL_TOKEN" ] || [ -n "$TUNNEL_NAME" ]; then
            echo -e "${RED}✗ cloudflared binary is not found in PATH.${NC}"
            echo -e "${YELLOW}  Install with: curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared${NC}"
            exit 1
        else
            echo -e "${YELLOW}! cloudflared is not installed; skipping tunnel.${NC}"
            echo -e "${YELLOW}  To enable Cloudflare Tunnel: curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared${NC}"
        fi
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
    echo -e "  • Local Swagger:   ${BLUE}http://localhost:${BACKEND_PORT}/docs${NC}"
    echo -e "  • Network Swagger: ${BLUE}http://${LAN_IP}:${BACKEND_PORT}/docs${NC}"
    echo -e "  • Endpoints:       ${BLUE}http://${LAN_IP}:${BACKEND_PORT}/getcourses${NC}"
fi
if [ "$START_SCRAPERS" = true ]; then
    echo -e "\n${BOLD}Background Scrapers:${NC}"
    echo -e "  • Status:      ${GREEN}Active (courses every 5m, RMP every 6h)${NC}"
    echo -e "  • Log File:    ${BLUE}backend/logs/scrapers.log${NC}"
fi
if [ "$START_TUNNEL" = true ] && [ -n "$TUNNEL_URL" ]; then
    echo -e "\n${BOLD}Cloudflare Tunnel:${NC}"
    echo -e "  • Public URL:  ${GREEN}${TUNNEL_URL}${NC}"
    echo -e "  • Log File:    ${BLUE}backend/logs/tunnel.log${NC}"
fi
echo -e "\n${YELLOW}Press Ctrl+C anytime to stop all services.${NC}"
echo -e "${GREEN}${BOLD}====================================================${NC}\n"

# Keep the script running and wait for background processes
wait
