"""Recovery Solver — FastAPI microservice for disruption recovery via Column Generation.

Endpoints:
  GET  /health  — Health check
  POST /solve   — SSE-streamed CG solve
"""

from __future__ import annotations

import json

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from app.models import SolveRequest
from app.solver.cg_engine import solve

app = FastAPI(
    title="SkyHub Recovery Solver",
    description="Column Generation solver for airline disruption recovery",
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
    return {"status": "ok", "service": "recovery-solver"}


@app.post("/solve")
async def solve_endpoint(request: SolveRequest):
    """Run CG solver and stream results via SSE."""

    async def event_stream():
        async for event in solve(request):
            yield {
                "event": event["event"],
                "data": json.dumps(event["data"]),
            }

    return EventSourceResponse(event_stream())
