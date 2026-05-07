"""
Radar backend regression tests.
Covers: stats, queries CRUD, run-now + SerpAPI, discoveries, runs, dedup, validation filter, cascade delete.
"""
import os
import time
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL")
# Frontend .env stores REACT_APP_BACKEND_URL at frontend/.env. Fallback read
if not BASE:
    try:
        from pathlib import Path
        for line in Path("/app/frontend/.env").read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().strip('"')
                break
    except Exception:
        pass
assert BASE, "REACT_APP_BACKEND_URL not configured"
BASE = BASE.rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# -------- Stats --------
class TestStats:
    def test_stats_shape(self, http):
        r = http.get(f"{API}/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        for k in [
            "total_queries", "enabled_queries", "total_discoveries",
            "new_last_24h", "validated_total", "hit_rate", "last_run_at",
        ]:
            assert k in d, f"missing key {k}"
        assert isinstance(d["total_queries"], int)
        assert isinstance(d["hit_rate"], (int, float))


# -------- Queries CRUD --------
class TestQueriesCRUD:
    created_id = None

    def test_create_query(self, http):
        payload = {
            "name": "TEST_py_radar_query",
            # High-signal long-tail query expected to return results via SerpAPI
            "query": "\"python\" tutorial site:realpython.com",
            "keywords": ["python", "tutorial"],
            "negative_keywords": ["xxxnegkwunlikely"],
            "interval_minutes": 60,  # keep high to spare SerpAPI quota
            "num_results": 10,
            "enabled": False,  # start disabled so scheduler won't auto-run
        }
        r = http.post(f"{API}/queries", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d and d["name"] == payload["name"]
        assert d["keywords"] == ["python", "tutorial"]
        assert d["interval_minutes"] == 60
        assert d["enabled"] is False
        TestQueriesCRUD.created_id = d["id"]

    def test_list_queries_contains_created(self, http):
        assert TestQueriesCRUD.created_id
        r = http.get(f"{API}/queries", timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        ids = [q["id"] for q in items]
        assert TestQueriesCRUD.created_id in ids
        me = next(q for q in items if q["id"] == TestQueriesCRUD.created_id)
        assert "total_discoveries" in me

    def test_get_query(self, http):
        qid = TestQueriesCRUD.created_id
        r = http.get(f"{API}/queries/{qid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == qid

    def test_get_query_404(self, http):
        r = http.get(f"{API}/queries/nonexistent-id-xyz", timeout=15)
        assert r.status_code == 404

    def test_patch_query(self, http):
        qid = TestQueriesCRUD.created_id
        r = http.patch(f"{API}/queries/{qid}", json={"enabled": True, "interval_minutes": 120}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["enabled"] is True
        assert d["interval_minutes"] == 120
        # verify persisted
        g = http.get(f"{API}/queries/{qid}", timeout=15).json()
        assert g["enabled"] is True
        assert g["interval_minutes"] == 120


# -------- Run-now + SerpAPI + dedup --------
class TestRunAndDiscoveries:
    def _wait_for_run_success(self, http, qid, timeout=45):
        deadline = time.time() + timeout
        last_run = None
        while time.time() < deadline:
            r = http.get(f"{API}/runs", params={"query_id": qid, "limit": 5}, timeout=15)
            runs = r.json() if r.status_code == 200 else []
            if runs:
                last_run = runs[0]
                if last_run["status"] in ("success", "error"):
                    return last_run
            time.sleep(2)
        return last_run

    def test_run_now_triggers_successful_run(self, http):
        qid = TestQueriesCRUD.created_id
        assert qid
        r = http.post(f"{API}/queries/{qid}/run", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True
        run = self._wait_for_run_success(http, qid, timeout=60)
        assert run is not None, "no run record appeared"
        assert run["status"] == "success", f"run failed: {run.get('error')}"
        assert run["total_results"] > 0, "SerpAPI returned 0 results (unexpected for this query)"
        # stash total for dedup test
        TestRunAndDiscoveries.first_new = run["new_results"]

    def test_discoveries_after_run(self, http):
        qid = TestQueriesCRUD.created_id
        r = http.get(f"{API}/discoveries", params={"query_id": qid, "limit": 200}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) > 0, "expected at least one discovery"
        d = items[0]
        for k in ["id", "url", "title", "snippet", "domain", "status", "valid", "times_seen"]:
            assert k in d
        TestRunAndDiscoveries.sample_discovery_id = d["id"]

    def test_validation_filter_and_keywords(self, http):
        qid = TestQueriesCRUD.created_id
        # Keywords 'python tutorial' should match most python results -> valid_only should return items
        r = http.get(f"{API}/discoveries", params={"query_id": qid, "valid_only": "true", "limit": 200}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        for it in items:
            assert it["valid"] is True

    def test_patch_discovery_validated(self, http):
        did = TestRunAndDiscoveries.sample_discovery_id
        r = http.patch(f"{API}/discoveries/{did}", json={"status": "validated"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "validated"
        # verify persisted via GET with status filter
        qid = TestQueriesCRUD.created_id
        g = http.get(f"{API}/discoveries", params={"query_id": qid, "status": "validated"}, timeout=15).json()
        assert any(x["id"] == did for x in g)

    def test_patch_discovery_ignored(self, http):
        did = TestRunAndDiscoveries.sample_discovery_id
        r = http.patch(f"{API}/discoveries/{did}", json={"status": "ignored"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "ignored"

    def test_dedup_on_second_run(self, http):
        qid = TestQueriesCRUD.created_id
        # Count discoveries before
        before = http.get(f"{API}/discoveries", params={"query_id": qid, "limit": 500}, timeout=15).json()
        before_count = len(before)

        # Trigger second run
        http.post(f"{API}/queries/{qid}/run", timeout=15)
        # Wait for new run to finish
        deadline = time.time() + 60
        latest = None
        while time.time() < deadline:
            runs = http.get(f"{API}/runs", params={"query_id": qid, "limit": 5}, timeout=15).json()
            if runs and runs[0]["status"] in ("success", "error"):
                latest = runs[0]
                break
            time.sleep(2)
        assert latest is not None and latest["status"] == "success"
        # Second run should have no or fewer new_results
        assert latest["new_results"] <= TestRunAndDiscoveries.first_new

        after = http.get(f"{API}/discoveries", params={"query_id": qid, "limit": 500}, timeout=15).json()
        # No duplicate URLs allowed
        urls = [d["url"] for d in after]
        assert len(urls) == len(set(urls)), "duplicate URLs found"
        # times_seen for at least one row should be >= 2
        assert any(d["times_seen"] >= 2 for d in after), "times_seen did not increment"
        # total count should not exceed before + new_results
        assert len(after) <= before_count + latest["new_results"]


# -------- Runs endpoint --------
class TestRuns:
    def test_list_runs_for_query(self, http):
        qid = TestQueriesCRUD.created_id
        r = http.get(f"{API}/runs", params={"query_id": qid, "limit": 10}, timeout=15)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for it in items:
            assert it["query_id"] == qid
            for k in ["id", "started_at", "status"]:
                assert k in it


# -------- Cascade delete --------
class TestCascadeDelete:
    def test_delete_query_cascades(self, http):
        qid = TestQueriesCRUD.created_id
        r = http.delete(f"{API}/queries/{qid}", timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # Verify query gone
        g = http.get(f"{API}/queries/{qid}", timeout=15)
        assert g.status_code == 404

        # Discoveries gone
        d = http.get(f"{API}/discoveries", params={"query_id": qid, "limit": 500}, timeout=15).json()
        assert d == []

        # Runs gone
        runs = http.get(f"{API}/runs", params={"query_id": qid, "limit": 50}, timeout=15).json()
        assert runs == []

    def test_delete_nonexistent_returns_404(self, http):
        r = http.delete(f"{API}/queries/nonexistent-id-xyz", timeout=15)
        assert r.status_code == 404
