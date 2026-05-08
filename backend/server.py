"""
Radar - Search monitoring / change detection backend.
Polls SerpAPI for new pages matching user-defined long-tail Google queries.
"""
from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from pathlib import Path
from contextlib import asynccontextmanager
from urllib.parse import urlparse
import os
import uuid
import logging
import asyncio
import httpx

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

# ----------------------------------------------------------------------------
# Setup
# ----------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("radar")

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
SERPAPI_KEY = os.environ.get('SERPAPI_KEY', '')

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

scheduler = AsyncIOScheduler()


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def get_domain(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


def text_matches(text: str, keywords: List[str], negative: List[str]) -> bool:
    """Validate that text contains at least one keyword and no negative term."""
    t = (text or "").lower()
    if keywords:
        if not any(k.lower() in t for k in keywords if k.strip()):
            return False
    if negative:
        if any(n.lower() in t for n in negative if n.strip()):
            return False
    return True


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class QueryCreate(BaseModel):
    name: str
    query: str
    keywords: List[str] = Field(default_factory=list)
    negative_keywords: List[str] = Field(default_factory=list)
    interval_minutes: int = 15
    enabled: bool = True
    num_results: int = 20


class QueryUpdate(BaseModel):
    name: Optional[str] = None
    query: Optional[str] = None
    keywords: Optional[List[str]] = None
    negative_keywords: Optional[List[str]] = None
    interval_minutes: Optional[int] = None
    enabled: Optional[bool] = None
    num_results: Optional[int] = None


class QueryOut(BaseModel):
    id: str
    name: str
    query: str
    keywords: List[str]
    negative_keywords: List[str]
    interval_minutes: int
    enabled: bool
    num_results: int
    created_at: str
    last_run_at: Optional[str] = None
    total_discoveries: int = 0
    last_run_status: Optional[str] = None


class DiscoveryOut(BaseModel):
    id: str
    query_id: str
    query_name: Optional[str] = None
    url: str
    title: str
    snippet: str
    domain: str
    position: Optional[int] = None
    first_seen_at: str
    last_seen_at: str
    status: str  # new | validated | ignored
    valid: bool
    times_seen: int = 1


class DiscoveryUpdate(BaseModel):
    status: Literal["new", "validated", "ignored"]


class RunOut(BaseModel):
    id: str
    query_id: str
    query_name: Optional[str] = None
    started_at: str
    finished_at: Optional[str] = None
    status: str  # running | success | error
    total_results: int = 0
    new_results: int = 0
    valid_new_results: int = 0
    error: Optional[str] = None


class StatsOut(BaseModel):
    total_queries: int
    enabled_queries: int
    total_discoveries: int
    new_last_24h: int
    validated_total: int
    hit_rate: float
    last_run_at: Optional[str] = None


# ----------------------------------------------------------------------------
# SerpAPI fetch
# ----------------------------------------------------------------------------
async def fetch_serpapi_results(query: str, num: int = 20) -> List[dict]:
    if not SERPAPI_KEY:
        raise RuntimeError("SERPAPI_KEY not configured in backend/.env")
    params = {
        "engine": "google",
        "q": query,
        "api_key": SERPAPI_KEY,
        "num": min(max(num, 10), 100),
        "hl": "en",
    }
    async with httpx.AsyncClient(timeout=30.0) as http:
        r = await http.get("https://serpapi.com/search", params=params)
        r.raise_for_status()
        data = r.json()
    return data.get("organic_results", []) or []


# ----------------------------------------------------------------------------
# Core: execute a monitored query
# ----------------------------------------------------------------------------
async def execute_query(query_id: str) -> dict:
    q = await db.queries.find_one({"id": query_id}, {"_id": 0})
    if not q:
        raise ValueError(f"Query {query_id} not found")

    run_id = str(uuid.uuid4())
    started = now_utc()
    run_doc = {
        "id": run_id,
        "query_id": query_id,
        "query_name": q["name"],
        "started_at": iso(started),
        "finished_at": None,
        "status": "running",
        "total_results": 0,
        "new_results": 0,
        "valid_new_results": 0,
        "error": None,
    }
    await db.runs.insert_one(run_doc.copy())

    try:
        organic = await fetch_serpapi_results(q["query"], q.get("num_results", 20))
        total = len(organic)
        new_count = 0
        valid_new = 0

        for idx, r in enumerate(organic):
            url = r.get("link")
            if not url:
                continue
            title = r.get("title") or ""
            snippet = r.get("snippet") or ""
            domain = get_domain(url)
            position = r.get("position", idx + 1)

            existing = await db.discoveries.find_one(
                {"query_id": query_id, "url": url}, {"_id": 0}
            )
            ts = iso(now_utc())
            if existing:
                await db.discoveries.update_one(
                    {"query_id": query_id, "url": url},
                    {"$set": {"last_seen_at": ts}, "$inc": {"times_seen": 1}},
                )
            else:
                combined = f"{title} {snippet}"
                valid = text_matches(
                    combined, q.get("keywords", []), q.get("negative_keywords", [])
                )
                disc = {
                    "id": str(uuid.uuid4()),
                    "query_id": query_id,
                    "query_name": q["name"],
                    "url": url,
                    "title": title,
                    "snippet": snippet,
                    "domain": domain,
                    "position": position,
                    "first_seen_at": ts,
                    "last_seen_at": ts,
                    "status": "new",
                    "valid": valid,
                    "times_seen": 1,
                }
                await db.discoveries.insert_one(disc.copy())
                new_count += 1
                if valid:
                    valid_new += 1

        finished = now_utc()
        await db.runs.update_one(
            {"id": run_id},
            {"$set": {
                "finished_at": iso(finished),
                "status": "success",
                "total_results": total,
                "new_results": new_count,
                "valid_new_results": valid_new,
            }},
        )
        await db.queries.update_one(
            {"id": query_id},
            {"$set": {
                "last_run_at": iso(finished),
                "last_run_status": "success",
            }},
        )
        logger.info(
            f"Run {run_id} [{q['name']}]: total={total} new={new_count} valid_new={valid_new}"
        )
        return {
            "run_id": run_id,
            "total_results": total,
            "new_results": new_count,
            "valid_new_results": valid_new,
        }
    except Exception as e:
        logger.exception(f"Run {run_id} failed: {e}")
        await db.runs.update_one(
            {"id": run_id},
            {"$set": {
                "finished_at": iso(now_utc()),
                "status": "error",
                "error": str(e),
            }},
        )
        await db.queries.update_one(
            {"id": query_id},
            {"$set": {"last_run_status": "error"}},
        )
        raise


# ----------------------------------------------------------------------------
# Scheduler sync
# ----------------------------------------------------------------------------
def _job_id(query_id: str) -> str:
    return f"q:{query_id}"


async def _scheduled_run(query_id: str):
    try:
        await execute_query(query_id)
    except Exception as e:
        logger.error(f"Scheduled run for {query_id} failed: {e}")


async def sync_scheduler():
    """Align APScheduler jobs with the current DB state of queries."""
    cursor = db.queries.find({}, {"_id": 0})
    db_queries = await cursor.to_list(length=1000)
    wanted = {}
    for q in db_queries:
        if q.get("enabled"):
            wanted[q["id"]] = int(q.get("interval_minutes", 15))

    existing_ids = {j.id for j in scheduler.get_jobs()}

    # Remove jobs no longer wanted
    for jid in list(existing_ids):
        if not jid.startswith("q:"):
            continue
        qid = jid.split("q:", 1)[1]
        if qid not in wanted:
            scheduler.remove_job(jid)

    # Add/replace wanted jobs
    for qid, interval in wanted.items():
        jid = _job_id(qid)
        trigger = IntervalTrigger(minutes=max(1, interval))
        scheduler.add_job(
            _scheduled_run,
            trigger=trigger,
            args=[qid],
            id=jid,
            name=f"Query {qid}",
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )


# ----------------------------------------------------------------------------
# FastAPI app
# ----------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    await sync_scheduler()
    logger.info("Scheduler started and synced")
    yield
    scheduler.shutdown(wait=False)
    mongo_client.close()


app = FastAPI(title="Radar - Search Monitoring", lifespan=lifespan)
api = APIRouter(prefix="/api")


# ---------- Queries ----------
@api.get("/")
async def root():
    return {"service": "Radar", "status": "online"}


async def _enrich_query(q: dict) -> dict:
    count = await db.discoveries.count_documents({"query_id": q["id"]})
    q["total_discoveries"] = count
    return q


@api.get("/queries", response_model=List[QueryOut])
async def list_queries():
    items = await db.queries.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for it in items:
        await _enrich_query(it)
    return items


@api.post("/queries", response_model=QueryOut)
async def create_query(payload: QueryCreate):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "query": payload.query.strip(),
        "keywords": [k.strip() for k in payload.keywords if k.strip()],
        "negative_keywords": [n.strip() for n in payload.negative_keywords if n.strip()],
        "interval_minutes": max(1, payload.interval_minutes),
        "enabled": payload.enabled,
        "num_results": max(10, min(payload.num_results, 100)),
        "created_at": iso(now_utc()),
        "last_run_at": None,
        "last_run_status": None,
    }
    await db.queries.insert_one(doc.copy())
    await sync_scheduler()
    return await _enrich_query(doc)


@api.get("/queries/{query_id}", response_model=QueryOut)
async def get_query(query_id: str):
    q = await db.queries.find_one({"id": query_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Query not found")
    return await _enrich_query(q)


@api.patch("/queries/{query_id}", response_model=QueryOut)
async def update_query(query_id: str, payload: QueryUpdate):
    updates = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if "interval_minutes" in updates:
        updates["interval_minutes"] = max(1, int(updates["interval_minutes"]))
    if "num_results" in updates:
        updates["num_results"] = max(10, min(int(updates["num_results"]), 100))
    if not updates:
        raise HTTPException(400, "No updates")
    r = await db.queries.update_one({"id": query_id}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(404, "Query not found")
    await sync_scheduler()
    q = await db.queries.find_one({"id": query_id}, {"_id": 0})
    return await _enrich_query(q)


@api.delete("/queries/{query_id}")
async def delete_query(query_id: str):
    r = await db.queries.delete_one({"id": query_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Query not found")
    await db.discoveries.delete_many({"query_id": query_id})
    await db.runs.delete_many({"query_id": query_id})
    await sync_scheduler()
    return {"ok": True}


@api.post("/queries/{query_id}/run")
async def run_query_now(query_id: str, background: BackgroundTasks):
    q = await db.queries.find_one({"id": query_id}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Query not found")
    # Fire-and-forget so the UI responds instantly
    asyncio.create_task(_scheduled_run(query_id))
    return {"ok": True, "message": "Run started"}


# ---------- Discoveries ----------
@api.get("/discoveries", response_model=List[DiscoveryOut])
async def list_discoveries(
    query_id: Optional[str] = None,
    status: Optional[str] = None,
    valid_only: Optional[bool] = None,
    last_hours: Optional[int] = None,
    limit: int = 200,
):
    flt: dict = {}
    if query_id:
        flt["query_id"] = query_id
    if status:
        flt["status"] = status
    if valid_only is True:
        flt["valid"] = True
    if last_hours:
        cutoff = now_utc() - timedelta(hours=int(last_hours))
        flt["first_seen_at"] = {"$gte": iso(cutoff)}
    items = (
        await db.discoveries.find(flt, {"_id": 0})
        .sort("first_seen_at", -1)
        .to_list(max(1, min(limit, 1000)))
    )
    return items


@api.patch("/discoveries/{discovery_id}", response_model=DiscoveryOut)
async def update_discovery(discovery_id: str, payload: DiscoveryUpdate):
    r = await db.discoveries.update_one(
        {"id": discovery_id}, {"$set": {"status": payload.status}}
    )
    if r.matched_count == 0:
        raise HTTPException(404, "Discovery not found")
    d = await db.discoveries.find_one({"id": discovery_id}, {"_id": 0})
    return d


@api.delete("/discoveries/{discovery_id}")
async def delete_discovery(discovery_id: str):
    r = await db.discoveries.delete_one({"id": discovery_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Discovery not found")
    return {"ok": True}


# ---------- Runs ----------
@api.get("/runs", response_model=List[RunOut])
async def list_runs(query_id: Optional[str] = None, limit: int = 50):
    flt: dict = {}
    if query_id:
        flt["query_id"] = query_id
    items = (
        await db.runs.find(flt, {"_id": 0})
        .sort("started_at", -1)
        .to_list(max(1, min(limit, 500)))
    )
    return items


# ---------- Stats ----------
@api.get("/stats", response_model=StatsOut)
async def get_stats():
    total_queries = await db.queries.count_documents({})
    enabled_queries = await db.queries.count_documents({"enabled": True})
    total_discoveries = await db.discoveries.count_documents({})
    cutoff = iso(now_utc() - timedelta(hours=24))
    new_last_24h = await db.discoveries.count_documents({"first_seen_at": {"$gte": cutoff}})
    validated_total = await db.discoveries.count_documents({"status": "validated"})
    valid_count = await db.discoveries.count_documents({"valid": True})
    hit_rate = (valid_count / total_discoveries) if total_discoveries else 0.0
    last_run = await db.runs.find({}, {"_id": 0}).sort("started_at", -1).to_list(1)
    last_run_at = last_run[0]["started_at"] if last_run else None
    return StatsOut(
        total_queries=total_queries,
        enabled_queries=enabled_queries,
        total_discoveries=total_discoveries,
        new_last_24h=new_last_24h,
        validated_total=validated_total,
        hit_rate=round(hit_rate, 3),
        last_run_at=last_run_at,
    )

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api)



# Serve the built React frontend (Railway single-service deploy).
# In dev (no build dir present) this is silently skipped.
_FRONTEND_BUILD = ROOT_DIR.parent / "frontend" / "build"
if _FRONTEND_BUILD.is_dir():
    app.mount(
        "/static",
        StaticFiles(directory=_FRONTEND_BUILD / "static"),
        name="static",
    )

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        # Serve specific file if it exists in build/, else fall back to index.html
        candidate = _FRONTEND_BUILD / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_FRONTEND_BUILD / "index.html")
