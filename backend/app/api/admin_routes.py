"""Login admin dan operasi tulis: upload CSV, retraining, rollback model."""

import logging
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Query, Request, Response, UploadFile
from sqlalchemy import select

from app.api.deps import SessionDep
from app.auth import (
    COOKIE,
    AdminDep,
    check_login_rate,
    client_ip,
    issue_token,
    reset_login_rate,
    verify_credentials,
)
from app.config import get_settings
from app.db import session_factory
from app.ingest.service import ingest_csv
from app.models import Upload
from app.schemas import LoginIn, MeOut, QueuedOut, TrainingRunOut, UploadDetail, UploadOut
from app.training import rollback

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# Browser/OS melaporkan CSV dengan tipe yang berbeda-beda; isi tetap divalidasi oleh parser.
_CSV_TYPES = {
    "text/csv",
    "application/csv",
    "text/plain",
    "application/vnd.ms-excel",
    "application/octet-stream",
    "",
}


def _enqueue(trigger: str, upload_id: int | None = None) -> str | None:
    """Antrekan training di worker; None bila broker tidak terjangkau."""
    from app.worker import train

    try:
        return train.apply_async(
            kwargs={"trigger": trigger, "upload_id": upload_id},
            retry_policy={"max_retries": 2, "interval_start": 0, "interval_step": 0.5},
        ).id
    except Exception:
        log.exception("gagal mengantrekan training", extra={"trigger": trigger})
        return None


@router.post("/auth/login", response_model=MeOut)
def login(body: LoginIn, request: Request, response: Response) -> MeOut:
    ip = client_ip(request)
    check_login_rate(ip)
    if not verify_credentials(body.username, body.password):
        log.warning("login gagal", extra={"ip": ip})
        raise HTTPException(401, "Username atau password salah")
    reset_login_rate(ip)
    token, max_age = issue_token(body.username)
    response.set_cookie(
        COOKIE,
        token,
        max_age=max_age,
        httponly=True,
        secure=get_settings().cookie_secure,
        samesite="strict",
        path="/api",
    )
    log.info("login berhasil", extra={"ip": ip})
    return MeOut(username=body.username)


@router.post("/auth/logout", status_code=204)
def logout(response: Response) -> Response:
    response.delete_cookie(COOKIE, path="/api")
    response.status_code = 204
    return response


@router.get("/auth/me", response_model=MeOut)
def me(user: AdminDep) -> MeOut:
    return MeOut(username=user)


@router.post("/admin/uploads", response_model=UploadOut, status_code=201)
async def upload_csv(
    user: AdminDep, file: Annotated[UploadFile, File(description="CSV mentah atau bersih")]
) -> UploadOut:
    limit = get_settings().upload_max_bytes
    name = file.filename or ""
    if not name.lower().endswith(".csv"):
        raise HTTPException(415, "Hanya file .csv yang diterima")
    if (file.content_type or "").split(";")[0].strip().lower() not in _CSV_TYPES:
        raise HTTPException(415, f"Tipe file tidak didukung: {file.content_type}")
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File melebihi batas {limit // (1024 * 1024)} MB")
    if not data.strip():
        raise HTTPException(400, "File kosong")

    with session_factory()() as s:
        try:
            u = ingest_csv(s, data, name[:255], source="admin")
        except UnicodeDecodeError:
            raise HTTPException(400, "File harus berkodean UTF-8") from None
        queued = None
        if u.status == "success" and (u.inserted or u.updated):
            queued = _enqueue("ingest", u.id) is not None
        log.info("upload admin", extra={"user": user, "upload_id": u.id, "status": u.status})
        return UploadOut.model_validate(u, from_attributes=True).model_copy(
            update={"retrain_queued": queued}
        )


@router.get("/admin/uploads", response_model=list[UploadOut])
def list_uploads(
    session: SessionDep, _: AdminDep, limit: Annotated[int, Query(ge=1, le=100)] = 20
) -> list[UploadOut]:
    rows = session.scalars(select(Upload).order_by(Upload.id.desc()).limit(limit))
    return [UploadOut.model_validate(u, from_attributes=True) for u in rows]


@router.get("/admin/uploads/{upload_id}", response_model=UploadDetail)
def get_upload(session: SessionDep, _: AdminDep, upload_id: int) -> UploadDetail:
    u = session.get(Upload, upload_id)
    if u is None:
        raise HTTPException(404, "Upload tidak ditemukan")
    return UploadDetail.model_validate(u, from_attributes=True)


@router.post("/admin/train", response_model=QueuedOut, status_code=202)
def trigger_training(user: AdminDep) -> QueuedOut:
    task_id = _enqueue("manual")
    if task_id is None:
        raise HTTPException(503, "Worker/antrean tidak tersedia; coba lagi nanti")
    log.info("training manual diantrekan", extra={"user": user, "task_id": task_id})
    return QueuedOut(queued=True, task_id=task_id, message="Training diantrekan")


@router.post("/admin/models/{model_id}/rollback", response_model=TrainingRunOut)
def rollback_model(user: AdminDep, model_id: int) -> TrainingRunOut:
    try:
        run = rollback(session_factory(), model_id)
    except LookupError as e:
        raise HTTPException(404, str(e)) from None
    except ValueError as e:
        raise HTTPException(409, str(e)) from None
    log.info("rollback", extra={"user": user, "model_id": model_id})
    return TrainingRunOut.model_validate(run, from_attributes=True)
