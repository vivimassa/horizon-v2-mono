"""Auto Roster Solver — FastAPI microservice for CP-SAT crew assignment (4.1.6.1).

Endpoints:
  GET  /health  — Health check
  POST /solve   — SSE-streamed CP-SAT solve
"""
from __future__ import annotations

import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from app.models import SolveRequest
from app.solver.cp_sat_engine import solve

app = FastAPI(
    title="SkyHub Auto Roster Solver",
    description="CP-SAT crew auto-roster solver for SkyHub 4.1.6.1",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "auto-roster-solver"}


@app.post("/solve")
async def solve_endpoint(request: SolveRequest):
    """Run CP-SAT solver and stream results via SSE."""

    async def event_stream():
        async for event in solve(request):
            yield {
                "event": event["event"],
                "data": json.dumps(event["data"]),
            }

    return EventSourceResponse(event_stream())
