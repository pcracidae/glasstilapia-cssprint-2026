"""Exports: the owner downloads their own records as a file to keep, print or
hand over themselves. No link is created and nothing is logged as shared.

The CSV has the same columns as a lender's CSV download: date, kind, amount,
trust tier and late flag. Customer names and notes are never in it.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import ValidationError

from app.auth import current_owner
from app.records import DateRange, entries_csv, owner_entries

router = APIRouter()


@router.get("/entries.csv", response_class=PlainTextResponse)
def export_entries(date_from: date = Query(), date_to: date = Query(),
                   owner_id: str = Depends(current_owner)) -> PlainTextResponse:
    try:
        rng = DateRange(date_from=date_from, date_to=date_to)
    except ValidationError as err:
        raise HTTPException(status_code=422, detail=[e["msg"] for e in err.errors()])
    name = f"records-{rng.date_from}-to-{rng.date_to}.csv"
    return PlainTextResponse(
        entries_csv(owner_entries(owner_id, rng.date_from, rng.date_to)),
        media_type="text/csv",
        headers={"Cache-Control": "no-store",
                 "Content-Disposition": f'attachment; filename="{name}"'},
    )
