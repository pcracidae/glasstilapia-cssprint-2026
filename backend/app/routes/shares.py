"""Consent-based sharing: the owner shares a summary of their records with
one lender, for one purpose, for a set time, and can revoke it any time.

Security rules this file keeps (see the product brief, section 6):
- The lender only ever gets a `LenderView`. It has no field for customer
  names, notes or entry ids, so they can't leak by accident.
- What the lender sees is frozen when the owner confirms, so the owner
  consents to exactly what they previewed. To share newer numbers, share again.
- Links are random 256-bit tokens. We store only a SHA-256 hash, so a leak of
  this store doesn't leak working links.
- Expired, revoked and unknown links all get the same 404.
- Every lender view is logged and shown to the owner.

Data lives in memory, so shares reset when the server restarts.
"""

import hashlib
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, Field, model_validator

from app.auth import current_owner
from app.ledger import STORE_NAMES, Entry, Kind, Tier, entries_for_owner

owner_router = APIRouter()
lender_router = APIRouter()

MAX_RANGE_DAYS = 180
NOT_AVAILABLE = "This link is not available. Ask the store owner for a new one."


# ---- Models -------------------------------------------------------------


class ShareIn(BaseModel):
    lender_name: str = Field(min_length=1, max_length=80)
    purpose: str = Field(min_length=1, max_length=120)
    date_from: date
    date_to: date
    expires_in_days: Literal[7, 14, 30] = 7
    include_entries: bool = False
    # Set when the share starts from a program's "Apply" on the Loan tab.
    program_id: str | None = Field(default=None, max_length=40)

    @model_validator(mode="after")
    def check_range(self) -> "ShareIn":
        if self.date_from > self.date_to:
            raise ValueError("date_from must be on or before date_to")
        if self.date_to > date.today():
            raise ValueError("date_to can't be in the future")
        if (self.date_to - self.date_from).days + 1 > MAX_RANGE_DAYS:
            raise ValueError(f"date range can be at most {MAX_RANGE_DAYS} days")
        return self


class TierSplit(BaseModel):
    """Share of income by trust tier, in whole percent."""
    verified: int
    matched: int
    corroborated: int
    self_reported: int


class Summary(BaseModel):
    income: int
    expenses: int
    profit: int
    utang_outstanding: int
    income_by_tier: TierSplit
    days_in_range: int
    days_logged: int  # days with at least one on-time entry
    late_entry_percent: int


class SharedEntry(BaseModel):
    """One ledger line as a lender sees it: no customer, no note, no id."""
    sale_date: date
    kind: Kind
    amount: int
    tier: Tier
    late: bool


class LenderView(BaseModel):
    store_name: str
    lender_name: str
    purpose: str
    date_from: date
    date_to: date
    shared_at: datetime
    expires_at: datetime
    summary: Summary
    entries: list[SharedEntry] | None = None


class Share(BaseModel):
    """A share as its owner sees it in "Shared with lenders"."""
    id: str
    lender_name: str
    purpose: str
    program_id: str | None
    date_from: date
    date_to: date
    include_entries: bool
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


def _percent(part: int, whole: int) -> int:
    return round(100 * part / whole) if whole else 0


def build_lender_view(owner_id: str, req: ShareIn, shared_at: datetime,
                      expires_at: datetime) -> LenderView:
    entries: list[Entry] = [
        e for e in entries_for_owner(owner_id)
        if req.date_from <= e.sale_date <= req.date_to
    ]
    income_entries = [e for e in entries if e.kind in ("sale", "utang_paid")]
    income = sum(e.amount for e in income_entries)
    by_tier = {t: 0 for t in ("verified", "matched", "corroborated", "self_reported")}
    for e in income_entries:
        by_tier[e.tier] += e.amount
    expenses = sum(e.amount for e in entries if e.kind == "expense")
    utang = sum(e.amount for e in entries if e.kind == "utang")
    utang -= sum(e.amount for e in entries if e.kind == "utang_paid")

    summary = Summary(
        income=income,
        expenses=expenses,
        profit=income - expenses,
        utang_outstanding=max(utang, 0),
        income_by_tier=TierSplit(**{t: _percent(v, income) for t, v in by_tier.items()}),
        days_in_range=(req.date_to - req.date_from).days + 1,
        days_logged=len({e.sale_date for e in entries if not e.is_late}),
        late_entry_percent=_percent(sum(e.is_late for e in entries), len(entries)),
    )
    shared = None
    if req.include_entries:
        shared = [
            SharedEntry(sale_date=e.sale_date, kind=e.kind, amount=e.amount,
                        tier=e.tier, late=e.is_late)
            for e in sorted(entries, key=lambda e: e.sale_date)
        ]
    return LenderView(
        store_name=STORE_NAMES.get(owner_id, "Store"),
        lender_name=req.lender_name,
        purpose=req.purpose,
        date_from=req.date_from,
        date_to=req.date_to,
        shared_at=shared_at,
        expires_at=expires_at,
        summary=summary,
        entries=shared,
    )


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
        program_id=rec.request.program_id,
        date_from=rec.request.date_from,
        date_to=rec.request.date_to,
        include_entries=rec.request.include_entries,
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
    return build_lender_view(owner_id, payload, now,
                             now + timedelta(days=payload.expires_in_days))


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
        snapshot=build_lender_view(owner_id, payload, now, expires_at),
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


# ---- Lender endpoint (/api/shared/{token}), no login --------------------


@lender_router.get("/{token}", response_model=LenderView)
def open_share(token: str, response: Response,
               user_agent: str | None = Header(default=None)) -> LenderView:
    # Don't let browsers, proxies or search engines keep a copy.
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["X-Robots-Tag"] = "noindex"

    token_hash = _hash(token)
    rec = next((r for r in _shares.values()
                if secrets.compare_digest(r.token_hash, token_hash)), None)
    if rec is None or _status(rec) != "active":
        raise HTTPException(status_code=404, detail=NOT_AVAILABLE,
                            headers={"Cache-Control": "no-store"})
    rec.views.append(View(viewed_at=_now(), device=_device(user_agent)))
    return rec.snapshot
