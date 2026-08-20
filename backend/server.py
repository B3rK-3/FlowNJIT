from backend.types import CourseDataType
from backend import constants
from backend.constants import COURSE_DATA, LECTURER_DATA
from backend.functions import construct_term_courses
from backend.functions import (
    initialize_database,
    set_local_data,
    gemini_call_stream,
)
from backend.rate_limit import get_client_identity, get_retry_after
from backend.types import (
    ProfsResponse,
    ProfsRequest,
    ChatRequest,
)
from fastapi import FastAPI, HTTPException, Request

from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import json
import logging
import os
import threading

app = FastAPI()

default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://flownjit.com",
    "https://www.flownjit.com",
]

env_origins = os.getenv("CORS_ORIGINS") or os.getenv("ALLOWED_ORIGINS")
if env_origins:
    origins = [o.strip() for o in env_origins.split(",") if o.strip()]
    for default_o in default_origins:
        if default_o not in origins:
            origins.append(default_o)
else:
    origins = default_origins

origin_regex = os.getenv("CORS_ORIGIN_REGEX")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=5)


logger = logging.getLogger(__name__)
update_listener_stop = threading.Event()

CHAT_RATE_LIMIT = 5
CHAT_RATE_LIMIT_WINDOW_SECONDS = 60


def listen_for_scraper_updates():
    pubsub = constants.get_redis().pubsub()
    pubsub.subscribe("course_updates", "lecturer_updates")
    try:
        while not update_listener_stop.is_set():
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if not message:
                continue

            channel = message["channel"]
            update_kind = message["data"]
            try:
                set_local_data()
                if channel == "course_updates":
                    construct_term_courses()
                    if update_kind == "catalog":
                        initialize_database()
                logger.info("Applied %s update from %s", update_kind, channel)
            except Exception:
                logger.exception("Failed to apply %s update from %s", update_kind, channel)
    finally:
        pubsub.close()


@app.on_event("startup")
def startup():
    from backend.constants import warmup_constants

    warmup_constants()

    set_local_data()
    construct_term_courses()
    initialize_database()
    update_listener_stop.clear()
    threading.Thread(
        target=listen_for_scraper_updates,
        name="scraper-update-listener",
        daemon=True,
    ).start()


@app.on_event("shutdown")
def shutdown():
    update_listener_stop.set()


@app.get("/")
async def root():
    return {
        "status": "ok",
        "message": "FlowNJIT Backend API is running",
        "docs": "/docs",
        "endpoints": ["/getcourses", "/getprofs", "/chat", "/docs", "/redoc"],
    }


@app.get("/health")
async def health_check():
    return {"status": "ok"}
@app.post("/chat")
async def chat_endpoint(chat_request: ChatRequest, request: Request):
    client_identity = get_client_identity(request)
    retry_after = get_retry_after(
        constants.get_redis(),
        f"rate-limit:chat:{client_identity}",
        CHAT_RATE_LIMIT,
        CHAT_RATE_LIMIT_WINDOW_SECONDS,
    )
    if retry_after is not None:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 5 chat requests per minute.",
            headers={"Retry-After": str(retry_after)},
        )
    async def generate():
        async for chunk in gemini_call_stream(
            chat_request.query,
            chat_request.sessionID,
            chat_request.term,
            chat_request.attachments,
        ):
            yield json.dumps(chunk) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.post("/getprofs", response_model=ProfsResponse)
async def prof_endpoint(request: ProfsRequest):
    results = {}
    for prof in request.profs:
        results[prof] = None
        if prof in LECTURER_DATA:
            results[prof] = LECTURER_DATA[prof]
    return results


@app.get("/getcourses", response_model=CourseDataType)
async def course_endpoint():
    return COURSE_DATA


def start():
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "3001"))
    uvicorn.run(app, host=host, port=port)

if __name__ == "__main__":
    start()
