import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api import ml_routes
from app.api.routes import router
from app.logging_setup import setup_logging

setup_logging()
log = logging.getLogger("app.http")

app = FastAPI(
    title="ISPU DKI Jakarta API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.include_router(router)
app.include_router(ml_routes.router)


@app.middleware("http")
async def access_log(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("unhandled error", extra={"request_id": request_id, "path": request.url.path})
        response = JSONResponse(
            {"detail": "Terjadi kesalahan internal", "request_id": request_id}, status_code=500
        )
    response.headers["x-request-id"] = request_id
    log.info(
        "request",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "ms": round((time.perf_counter() - start) * 1000, 1),
        },
    )
    return response
