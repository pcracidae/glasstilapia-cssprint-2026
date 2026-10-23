"""Record sharing: the owner shares chosen parts of their records with one
lender through a link that expires and can be revoked any time.

Sharing is separate from loan coaching and program matching. It doesn't know
about programs; it only packages records (see app/records.py) behind a link.

Security rules this file keeps (see the product brief, section 6):
- The lender only gets a `RecordsPackage` plus who it's for. Packages have no
  field for customer names, notes or entry ids, so they can't leak by accident.
- What the lender sees is frozen when the owner confirms, so the owner
  consents to exactly what they previewed. To share newer numbers, share again.
- Links are random 256-bit tokens. We store only a SHA-256 hash, so a leak of
  this store doesn't leak working links.
- Expired, revoked and unknown links all get the same 404.
- Every lender view and CSV download is logged and shown to the owner.

Data lives in memory, so shares reset when the server restarts.
"""

import hashlib
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field, field_validator

from app.auth import current_owner
from app.records import (
    DEFAULT_SECTIONS, DateRange, RecordsPackage, Section, build_package, entries_csv,
)

owner_router = APIRouter()
lender_router = APIRouter()

NOT_AVAILABLE = "This link is not available. Ask the store owner for a new one."
NO_STORE = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex",
}


# ---- Models -------------------------------------------------------------


class ShareIn(DateRange):
    lender_name: str = Field(min_length=1, max_length=80)
    purpose: str = Field(min_length=1, max_length=120)
    sections: list[Section] = Field(default_factory=lambda: list(DEFAULT_SECTIONS))
    expires_in_days: Literal[7, 14, 30] = 7

    @field_validator("sections")
    @classmethod
    def at_least_one(cls, v: list[Section]) -> list[Section]:
        if not v:
            raise ValueError("pick at least one section to share")
        return v


class LenderView(BaseModel):
    lender_name: str
    purpose: str
    shared_at: datetime
    expires_at: datetime
    csv_available: bool
    records: RecordsPackage


class Share(BaseModel):
    """A share as its owner sees it in "Shared with lenders"."""
    id: str
    lender_name: str
    purpose: str
    date_from: date
    date_to: date
    sections: list[Section]
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    status: Literal["active", "expired", "revoked"]
    view_count: int
    last_viewed_at: datetime | None


class ShareCreated(Share):
    # Shown once, right after creating. We can't show it again later.
    token: str
    link: str


class View(BaseModel):
    viewed_at: datetime
    device: str
    action: Literal["opened", "downloaded CSV"]


class _ShareRecord(BaseModel):
    id: str
    owner_id: str
    token_hash: str
    request: ShareIn
    snapshot: LenderView
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None
    views: list[View] = []


_shares: dict[str, _ShareRecord] = {}


# ---- Helpers ------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _lender_view(owner_id: str, req: ShareIn, shared_at: datetime,
                 expires_at: datetime) -> LenderView:
    pkg = build_package(owner_id, req.date_from, req.date_to, req.sections)
    return LenderView(lender_name=req.lender_name, purpose=req.purpose,
                      shared_at=shared_at, expires_at=expires_at,
                      csv_available=pkg.entries is not None, records=pkg)


def _status(rec: _ShareRecord) -> Literal["active", "expired", "revoked"]:
    if rec.revoked_at:
        return "revoked"
    if _now() >= rec.expires_at:
        return "expired"
    return "active"


def _to_share(rec: _ShareRecord) -> Share:
    return Share(
        id=rec.id,
        lender_name=rec.request.lender_name,
        purpose=rec.request.purpose,
        date_from=rec.request.date_from,
        date_to=rec.request.date_to,
        sections=rec.snapshot.records.sections,
        created_at=rec.created_at,
        expires_at=rec.expires_at,
        revoked_at=rec.revoked_at,
        status=_status(rec),
        view_count=len(rec.views),
        last_viewed_at=rec.views[-1].viewed_at if rec.views else None,
    )


def _owned(share_id: str, owner_id: str) -> _ShareRecord:
    rec = _shares.get(share_id)
    # Someone else's share looks exactly like a missing one.
    if rec is None or rec.owner_id != owner_id:
        raise HTTPException(status_code=404, detail="Share not found")
    return rec


def _active_by_token(token: str) -> _ShareRecord:
    token_hash = _hash(token)
    rec = next((r for r in _shares.values()
                if secrets.compare_digest(r.token_hash, token_hash)), None)
    if rec is None or _status(rec) != "active":
        raise HTTPException(status_code=404, detail=NOT_AVAILABLE, headers=NO_STORE)
    return rec


def _device(user_agent: str | None) -> str:
    ua = (user_agent or "").lower()
    if "android" in ua:
        return "Android phone"
    if "iphone" in ua or "ipad" in ua:
        return "iPhone or iPad"
    if "windows" in ua or "macintosh" in ua or "linux" in ua:
        return "Computer"
    return "Unknown device"


# ---- Owner endpoints (/api/shares) --------------------------------------


@owner_router.post("/preview", response_model=LenderView)
def preview_share(payload: ShareIn, owner_id: str = Depends(current_owner)) -> LenderView:
    """What the lender would see. The consent screen shows this before Confirm."""
    now = _now()
    return _lender_view(owner_id, payload, now, now + timedelta(days=payload.expires_in_days))


@owner_router.post("", response_model=ShareCreated, status_code=201)
def create_share(payload: ShareIn, owner_id: str = Depends(current_owner)) -> ShareCreated:
    now = _now()
    expires_at = now + timedelta(days=payload.expires_in_days)
    token = secrets.token_urlsafe(32)
    rec = _ShareRecord(
        id=uuid.uuid4().hex,
        owner_id=owner_id,
        token_hash=_hash(token),
        request=payload,
        snapshot=_lender_view(owner_id, payload, now, expires_at),
        created_at=now,
        expires_at=expires_at,
    )
    _shares[rec.id] = rec
    return ShareCreated(**_to_share(rec).model_dump(), token=token, link=f"/s/{token}")


@owner_router.get("", response_model=list[Share])
def list_shares(owner_id: str = Depends(current_owner)) -> list[Share]:
    mine = [r for r in _shares.values() if r.owner_id == owner_id]
    return [_to_share(r) for r in sorted(mine, key=lambda r: r.created_at, reverse=True)]


@owner_router.post("/{share_id}/revoke", response_model=Share)
def revoke_share(share_id: str, owner_id: str = Depends(current_owner)) -> Share:
    rec = _owned(share_id, owner_id)
    if rec.revoked_at is None:
        rec.revoked_at = _now()
    return _to_share(rec)


@owner_router.get("/{share_id}/views", response_model=list[View])
def list_views(share_id: str, owner_id: str = Depends(current_owner)) -> list[View]:
    return list(reversed(_owned(share_id, owner_id).views))


# ---- Lender endpoints (/api/shared/{token}), no login -------------------


@lender_router.get("/{token}", response_model=LenderView)
def open_share(token: str, response: Response,
               user_agent: str | None = Header(default=None)) -> LenderView:
    response.headers.update(NO_STORE)
    rec = _active_by_token(token)
    rec.views.append(View(viewed_at=_now(), device=_device(user_agent), action="opened"))
    return rec.snapshot


@lender_router.get("/{token}/entries.csv", response_class=PlainTextResponse)
def download_share_csv(token: str,
                       user_agent: str | None = Header(default=None)) -> PlainTextResponse:
    rec = _active_by_token(token)
    entries = rec.snapshot.records.entries
    if entries is None:  # the owner didn't share itemized entries
        raise HTTPException(status_code=404, detail=NOT_AVAILABLE, headers=NO_STORE)
    rec.views.append(View(viewed_at=_now(), device=_device(user_agent),
                          action="downloaded CSV"))
    pkg = rec.snapshot.records
    name = f"records-{pkg.date_from}-to-{pkg.date_to}.csv"
    return PlainTextResponse(entries_csv(entries), media_type="text/csv", headers={
        **NO_STORE, "Content-Disposition": f'attachment; filename="{name}"'})
