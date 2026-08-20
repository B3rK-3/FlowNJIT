# Running FlowNJIT on an Android phone

## Verdict

The backend can probably run on a Snapdragon Samsung Galaxy S22 Ultra with 12 GB RAM for development, personal use, or a small demonstration. It is not a good production host: Android can terminate background processes, CPU-only transformer inference will be slow, sustained work will cause thermal throttling, and a phone is not a reliable always-on server.

A Redmi Note 9S is much less suitable:

| Device | Relevant hardware | Full current backend |
| --- | --- | --- |
| Galaxy S22 Ultra described here | Snapdragon 8 Gen 1, 12 GB RAM, ARM64 | Likely to run; suitable for testing and light traffic |
| Redmi Note 9S, 6 GB model | Snapdragon 720G, 6 GB RAM, ARM64 | Possibly runs, but borderline, slow, and vulnerable to Android low-memory termination |
| Redmi Note 9S, 4 GB model | Snapdragon 720G, 4 GB RAM, ARM64 | Not recommended; likely to run out of usable memory or be killed under model/index load |

These are compatibility assessments, not measured benchmarks. Actual memory and latency must be measured on the target phone.

## Why this backend is demanding

The API is not just FastAPI:

- `backend/constants.py` loads PyTorch and two transformer models:
  - `all-MiniLM-L6-v2` for embeddings
  - `cross-encoder/ms-marco-MiniLM-L-6-v2` for reranking
- ChromaDB stores its persistent index in `./chromadb`.
- Redis must be available at `localhost:6379`.
- `backend/data/graph.json` is about 11 MB and contains 3,513 courses.
- A semantic course query retrieves up to 500 candidates and sends all of them through the CrossEncoder (`fetch_k = 500` in `backend/functions.py`).
- The phone will run PyTorch on its CPU. This setup does not automatically use the Qualcomm Adreno GPU or Hexagon NPU.

The first model download and Chroma index construction may take minutes or longer. A semantic query may take several seconds, especially on the Redmi Note 9S. PRoot and thermal throttling add overhead.

## Repository status before deployment

The following deployment issues have been addressed in the repository:

### 1. Python dependencies included

`requirements.txt` includes all runtime dependencies required by the server:

```text
fastapi
uvicorn
redis
```

A single `pip install -r requirements.txt` installs the complete Python environment.

### 2. Startup order corrected

In `backend/server.py`, the startup handler runs in the correct sequence:

```python
warmup_constants()
set_local_data()
construct_term_courses()
initialize_database()
```

This ensures Redis catalog data is loaded into `COURSE_DATA` and term mapping before ChromaDB synchronizes the vectors.

### 3. Automatic Redis seeding and logging directory

`backend/constants.py` and `backend/scrapers/constants.py` ensure `backend/logs` is automatically created on import, and `set_local_data()` automatically populates Redis from `backend/data/graph.json` and `backend/data/lecturers.json` if Redis is empty upon startup.

### 4. Configurable frontend URL and CORS

- **Frontend (`website/app/constants.ts`, `website/app/components/CourseSidebar.tsx`)**: Configurable via `NEXT_PUBLIC_BACKEND_URL` or `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001` in dev, `https://flownjit.com` in prod).
- **Backend (`backend/server.py`)**: Configurable via `CORS_ORIGINS` (comma-separated list of origins) and `CORS_ORIGIN_REGEX` (e.g. `r"https://.*\.trycloudflare\.com"`), and binds to `HOST` and `PORT` environment variables if set.
## Recommended installation: Termux plus Ubuntu PRoot

Install Termux from F-Droid or the official Termux GitHub releases rather than the obsolete Play Store build.

### 1. Install the Ubuntu environment

In Termux:

```bash
pkg update
pkg upgrade
pkg install proot-distro git
proot-distro install ubuntu
proot-distro login ubuntu
```

The remaining commands run inside Ubuntu.

### 2. Install system packages

```bash
apt update
apt install -y \
  python3 python3-venv python3-pip \
  redis-server git curl build-essential libgomp1
```

Use Python 3.10, 3.11, or 3.12. Chroma's `chroma-hnswlib` package publishes Linux ARM64 wheels for those versions. Avoid choosing a newer Python version until all native dependencies publish compatible ARM64 wheels.

### 3. Clone and install FlowNJIT

```bash
git clone YOUR_REPOSITORY_URL flownjit
cd flownjit

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt

`pip install -r requirements.txt` will download PyTorch, SentenceTransformers, ChromaDB, and their dependencies. The download and installed environment can consume several gigabytes. Keep the repository and Chroma database on internal storage if possible; removable storage is slower and Android filesystem permissions can cause problems.

If `pip` attempts to compile a major native dependency rather than downloading an ARM64 wheel, stop and check the Python version and wheel availability. A long source build on the phone is not the preferred path.

### 4. Configure the Gemini API key

`backend/constants.py` loads environment variables from `backend/.env`:

```bash
cat > backend/.env <<'EOF'
GEMINI_API_KEY=replace_with_your_key
EOF
```

Do not commit this file or expose the API key in frontend code.

### 5. Start and seed Redis

PRoot generally does not run systemd. Start Redis directly:

```bash
redis-server --daemonize yes
redis-cli ping
```

The expected response is:

```text
PONG
```

Seed the checked-in course and lecturer data:

```bash
python -c 'import backend.scrapers.constants'
redis-cli EXISTS courses lecturers
```

The final command should report that both keys exist (`1 1` or integer count).

> **Note on `MAINT_NOTIFICATIONS` log**: If you see `DEBUG: Failed to enable maintenance notifications: unknown subcommand 'MAINT_NOTIFICATIONS'`, this is a harmless informational message from `redis-py` testing if the Redis server supports Redis 7.4+ client maintenance notifications. Standard Linux/PRoot Redis packages (Redis 6.x or 7.0/7.2) do not have this subcommand; Redis and the backend continue to operate normally.
### 6. Verify startup configuration

`backend/server.py` startup handler executes:

```python
warmup_constants()
set_local_data()
construct_term_courses()
initialize_database()
```

The model warmup downloads and loads transformer models on first run. Loading Redis before `initialize_database()` ensures Chroma sees the catalog.
### 7. Start the application

The default command starts the full production stack: Redis, FastAPI, the scraper worker, the Next.js production build (`next start`), and Cloudflare Tunnel:

```bash
./start.sh
```

Development mode (runs `next dev` with hot reloading):

```bash
./start.sh --dev
```

The scraper worker runs separately as `python -m backend.scrapers`. It refreshes course sections every five minutes and professor ratings every six hours. Its logs are in `backend/logs/scrapers.log`. The backend listens for Redis notifications and reloads its in-memory data. Section-only updates do not rescan ChromaDB; Chroma synchronizes only when a course ID, title, or description changes. Before starting, set the desired course term in `backend/scrapers/currentTerm.txt`.

Redis is updated after every scrape, but the large checked-in JSON fallbacks are snapshotted at most once every 24 hours to reduce phone-storage writes. The interval uses each JSON file's modification time and can be configured in `backend/.env`:

```env
JSON_SNAPSHOT_INTERVAL_SECONDS=86400
```

If Redis is lost before the next snapshot, the JSON fallback can be up to one day behind.

Useful alternatives:

```bash
./start.sh --no-tunnel    # Skip Cloudflare tunnel (local LAN only)
./start.sh --no-scrapers  # Skip scrapers
./start.sh --backend-only # Redis + backend only
./start.sh --scrapers-only # Redis + scraper worker only
```

ChromaDB and both transformer models run inside the FastAPI backend process; they do not need separate startup commands. Cloudflare Tunnel runs automatically by default (or use `--no-tunnel` to disable). If automatic LAN detection is wrong inside PRoot, pass the phone address explicitly:

```bash
LAN_IP=192.168.1.50 ./start.sh
```
Test it on the phone before exposing it:

```bash
curl -f http://127.0.0.1:3001/getcourses -o /dev/null
curl -i -X POST http://127.0.0.1:3001/getprofs \
  -H 'Content-Type: application/json' \
  -d '{"profs":[]}'
```

A successful `/getcourses` request proves that FastAPI, Redis loading, and course serialization work. It does not prove semantic search or Gemini streaming; test `/chat` separately with a valid request and API key.

## Exposing FlowNJIT with Cloudflare Tunnel

### Why `service install` fails on Android

If you ran `cloudflared service install`, it will **not** run in the background because Android/Termux/PRoot **does not have `systemd`**. The service installer writes a systemd unit file that Android's init system ignores. You must run `cloudflared` directly as a regular process inside your PRoot session or `tmux`.

### 1. Install the Linux ARM64 binary (inside Ubuntu PRoot)

Make sure `cloudflared` is installed inside Ubuntu PRoot (not just outer Termux):

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared
cloudflared --version
```

### 2. Method A: Cloudflare Zero Trust Dashboard Tunnel (Recommended)

To have your tunnel appear and stay connected on the [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com):

1. In Cloudflare Zero Trust: Go to **Networks → Tunnels → Create a tunnel**.
2. Select **Cloudflared**, name it (e.g. `flownjit-phone`).
3. Select **Docker** or **Linux (arm64)** to reveal your command:
   ```bash
   cloudflared tunnel run --token <EY...YOUR_TOKEN>
   ```
4. In the **Public Hostnames** tab of your tunnel:
   - Add hostname: `flownjit.yourdomain.com` → Service: `HTTP` → `localhost:3000` (Frontend)
   - (Optional) Add API hostname: `api.flownjit.yourdomain.com` → Service: `HTTP` → `localhost:3001` (Backend)
5. Save the token into `backend/.env`:
   ```bash
   echo "CLOUDFLARE_TUNNEL_TOKEN=your_token_here" >> backend/.env
   ```
6. Run with `./start.sh --tunnel`! The tunnel starts automatically and shows **HEALTHY** in your Cloudflare Dashboard.

### 3. Method B: Ephemeral Quick Tunnel (No account needed)

If you do not have a custom domain on Cloudflare:

```bash
./start.sh --tunnel
```

This launches a quick tunnel and prints the public `https://<random>.trycloudflare.com` URL in the console banner (and logs to `backend/logs/tunnel.log`).
## Preventing Android from killing background processes

Android aggressively terminates background processes to conserve battery and RAM. Configure these layers to keep the server running reliably:

### 1. Termux Wake Lock & Foreground Service

In the outer Termux app (before entering Ubuntu PRoot), execute:

```bash
termux-wake-lock
```

Ensure the persistent Termux notification remains visible in the Android notification shade. This acquires an Android `PARTIAL_WAKE_LOCK` preventing the CPU from sleeping when the screen turns off.

### 2. Disable Battery Optimization & Sleep Limits

#### Standard Android / AOSP
1. **Settings → Apps → Termux → Battery**: Set to **Unrestricted** (turn off "Optimize battery usage").
2. **Settings → Apps → Termux → Mobile data**: Enable **Allow background data usage** and **Allow data usage while Data saver is on**.

#### Samsung Galaxy (One UI)
1. **Settings → Battery → Background usage limits → Never sleeping apps**: Add **Termux**.
2. **Settings → Battery → Background usage limits**: Turn off **Put unused apps to sleep**.
3. **Settings → Device Care → Memory → Excluded apps**: Add **Termux**.
4. In the **App Switcher / Recents screen**: Tap the Termux app icon at the top of its tile and select **Keep open** (shows a lock icon).

#### Xiaomi / Redmi (MIUI / HyperOS)
1. **Settings → Apps → Manage Apps → Termux**:
   - Turn on **Autostart**.
   - In **Battery Saver**, select **No restrictions**.
2. **Security app → Boost speed → Settings gear (top right) → Lock apps**: Enable **Termux**.
3. In **Recents screen**: Long-press the Termux window and tap the **Padlock icon**.
4. In **Security → Battery → Settings gear → Clear cache when device is locked**: Set to **Never**.

### 3. Disable Android 12+ "Phantom Process Killer" (PPK)

Starting with Android 12, Android's `ActivityManager` kills child processes spawned by apps (including PRoot, Python, Redis, and Cloudflared) if they consume too much background CPU or exceed 32 child processes.

To disable PPK:

**Via ADB (from a connected computer):**
```bash
adb shell "/system/bin/device_config put activity_manager max_phantom_processes 2147483647"
adb shell "/system/bin/device_config set_sync_disabled_for_tests persistent"
```

**On-device via Shizuku / `rish`:**
```bash
rish -c "/system/bin/device_config put activity_manager max_phantom_processes 2147483647"
rish -c "/system/bin/device_config set_sync_disabled_for_tests persistent"
```

**On Android 13/14+ Developer Options (if available on your ROM):**
Enable **Settings → Developer Options → Disable child process restrictions**.

### 4. Guard against Low-Memory Killer (LMK)

PyTorch, SentenceTransformers, and ChromaDB require substantial memory (~1.5 GB to 3.5 GB peak). When physical RAM is exhausted, the Linux kernel `lmkd` kills the largest process with `SIGKILL` (exit code 137).

1. **Single worker only**: Run with `python -m backend.server` (1 worker). Do not run multiple Uvicorn workers.
2. **Close background apps**: Clear heavy apps (camera, games, heavy browser sessions) from RAM.
3. **Keep plugged in**: Android's power manager is significantly more forgiving while charging.
4. **Keep screen awake while charging (Optional)**: Enable **Settings → Developer Options → Stay awake**.

### 5. Run inside `tmux` with an Auto-Restart Loop

Inside Ubuntu PRoot, use `tmux` so session detachment doesn't kill the server, and wrap the startup in a loop to recover automatically from transient interruptions:

```bash
apt install tmux
tmux new -s flownjit
```

Inside tmux:
```bash
while true; do
  python -m backend.server
  echo "Server stopped with exit code $?. Restarting in 3s..."
  sleep 3
done
```

Detach cleanly from tmux by pressing `Ctrl + B`, then `D`. Re-attach anytime with `tmux attach -t flownjit`.
## Redmi Note 9S assessment

The Redmi Note 9S uses a Snapdragon 720G with two Cortex-A76-derived performance cores and six Cortex-A55-derived efficiency cores. It was sold primarily with 4 GB or 6 GB RAM. It is ARM64, so the same Ubuntu ARM64 wheels are relevant; architecture is not the main problem.

The limitations are available RAM and CPU throughput:

- **4 GB version:** Android and MIUI consume a substantial part of memory before PRoot, Redis, Chroma, Python, and both transformer models start. The complete backend is not a dependable configuration.
- **6 GB version:** It may start with other applications closed, but model loading and 500-pair reranking leave limited headroom. Expect slow requests and possible low-memory termination.
- **Both versions:** The Snapdragon 720G is substantially slower than the Snapdragon 8 Gen 1 for CPU inference. Do not expect useful concurrency.

### Making the Redmi viable

The most effective changes are architectural rather than Android tweaks:

1. Move embeddings and reranking to an external API, eliminating local PyTorch and SentenceTransformers.
2. Alternatively, remove the CrossEncoder and reduce `fetch_k` from 500 to a much smaller measured value. This changes search quality and must be evaluated before deployment.
3. Prebuild the Chroma index on another ARM64-compatible system and copy it to the phone, avoiding initial embedding work. Verify Chroma version compatibility.
4. Keep the Next.js frontend on Cloudflare Pages or Vercel; run only the API on the phone.
5. Limit the API to one worker/process. Multiple Uvicorn workers would duplicate model memory.

With remote ML inference, either Redmi Note 9S variant could handle the remaining lightweight API/data-serving duties much more realistically. With the full current local ML stack, the 6 GB model is experimental and the 4 GB model is not recommended.

## Operational recommendation

Use the S22 Ultra only if the goal is a no-cost experiment or personal demo. Keep the frontend hosted separately, expose the phone API through a named Cloudflare Tunnel, use one Uvicorn process, and measure these values after startup:

```bash
free -h
ps -eo pid,rss,cmd --sort=-rss
```

Also measure cold startup, `/getcourses`, and a representative `/chat` request. Those observations—not hardware specifications alone—determine whether the setup is acceptable.

For a public service expected to remain available, use a Linux server/container or refactor the ML operations to managed APIs rather than relying on either phone.

## Sources

- Xiaomi Redmi Note 9S specifications: <https://www.mi.com/global/redmi-note-9s/specs/>
- PyTorch installation: <https://pytorch.org/get-started/locally/>
- Chroma HNSW package and ARM64 wheel files: <https://pypi.org/project/chroma-hnswlib/>
- Termux PRoot Distro: <https://github.com/termux/proot-distro>
- Termux installation guidance: <https://github.com/termux/termux-app#installation>
- Cloudflare Tunnel documentation: <https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/>
