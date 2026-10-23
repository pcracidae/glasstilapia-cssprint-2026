"""Records packages: what the owner's records say, for a date range.

This module only reads the ledger and builds numbers. It knows nothing about
share links, exports, lenders or loan programs, so each of those can use it
without depending on the others:

- Sharing (routes/shares.py) freezes a package behind a link.
- Exports (routes/exports.py) turn the entries into a CSV file.
- The loan coach and program matcher can read `cash_flow` directly.

Privacy rule: nothing here has a field for customer names, notes or entry
ids, so no package or CSV can carry them.
"""

import csv
import io
from datetime import date
from typing import Literal

from pydantic import BaseModel, model_validator

from app.ledger import STORE_PROFILES, Entry, Kind, Tier, entries_for_owner

Section = Literal["profile", "cash_flow", "monthly", "receivables", "entries"]
ALL_SECTIONS: tuple[Section, ...] = ("profile", "cash_flow", "monthly", "receivables", "entries")
DEFAULT_SECTIONS: list[Section] = ["profile", "cash_flow"]
MAX_RANGE_DAYS = 366


class DateRange(BaseModel):
    date_from: date
    date_to: date

    @model_validator(mode="after")
    def check_range(self):
        if self.date_from > self.date_to:
            raise ValueError("date_from must be on or before date_to")
        if self.date_to > date.today():
            raise ValueError("date_to can't be in the future")
        if (self.date_to - self.date_from).days + 1 > MAX_RANGE_DAYS:
            raise ValueError(f"date range can be at most {MAX_RANGE_DAYS} days")
        return self


class StoreProfile(BaseModel):
    store_name: str
    business_type: str
    city: str
    operating_since: int  # year


class TierSplit(BaseModel):
    """Share of income by trust tier, in whole percent."""
    verified: int
    matched: int
    corroborated: int
    self_reported: int


class CashFlow(BaseModel):
    income: int
    expenses: int
    profit: int
    income_by_tier: TierSplit
    days_in_range: int
    days_logged: int  # days with at least one on-time entry
    late_entry_percent: int


class Month(BaseModel):
    month: str  # YYYY-MM
    income: int
    expenses: int
    profit: int


class Receivables(BaseModel):
    """Utang owed to the store, by age. Totals only, never who owes it."""
    outstanding: int
    customers_owing: int
    age_0_30: int
    age_31_60: int
    age_over_60: int


class RecordEntry(BaseModel):
    """One ledger line, without customer, note or id."""
    sale_date: date
    kind: Kind
    amount: int
    tier: Tier
    late: bool


class RecordsPackage(BaseModel):
    date_from: date
    date_to: date
    sections: list[Section]
    profile: StoreProfile | None = None
    cash_flow: CashFlow | None = None
    monthly: list[Month] | None = None
    receivables: Receivables | None = None
    entries: list[RecordEntry] | None = None


def _percent(part: int, whole: int) -> int:
    return round(100 * part / whole) if whole else 0


def _in_range(owner_id: str, date_from: date, date_to: date) -> list[Entry]:
    return sorted(
        (e for e in entries_for_owner(owner_id) if date_from <= e.sale_date <= date_to),
        key=lambda e: (e.sale_date, e.received_at),
    )


def _income(entries: list[Entry]) -> int:
    return sum(e.amount for e in entries if e.kind in ("sale", "utang_paid"))


def _expenses(entries: list[Entry]) -> int:
    return sum(e.amount for e in entries if e.kind == "expense")


def cash_flow(entries: list[Entry], date_from: date, date_to: date) -> CashFlow:
    income_entries = [e for e in entries if e.kind in ("sale", "utang_paid")]
    income = _income(entries)
    by_tier = {t: 0 for t in ("verified", "matched", "corroborated", "self_reported")}
    for e in income_entries:
        by_tier[e.tier] += e.amount
    expenses = _expenses(entries)
    return CashFlow(
        income=income,
        expenses=expenses,
        profit=income - expenses,
        income_by_tier=TierSplit(**{t: _percent(v, income) for t, v in by_tier.items()}),
        days_in_range=(date_to - date_from).days + 1,
        days_logged=len({e.sale_date for e in entries if not e.is_late}),
        late_entry_percent=_percent(sum(e.is_late for e in entries), len(entries)),
    )


def _monthly(entries: list[Entry]) -> list[Month]:
    months: dict[str, list[Entry]] = {}
    for e in entries:
        months.setdefault(e.sale_date.strftime("%Y-%m"), []).append(e)
    out = []
    for key, items in sorted(months.items()):
        income, expenses = _income(items), _expenses(items)
        out.append(Month(month=key, income=income, expenses=expenses, profit=income - expenses))
    return out


def _receivables(owner_id: str, as_of: date) -> Receivables:
    """Utang still owed as of `as_of`. Payments clear each customer's oldest
    utang first. Customer names are used here to match payments, then dropped."""
    open_items: dict[str, list[list]] = {}  # customer -> [[sale_date, amount left], ...]
    for e in sorted(entries_for_owner(owner_id), key=lambda e: e.sale_date):
        if e.sale_date > as_of or not e.customer:
            continue
        items = open_items.setdefault(e.customer, [])
        if e.kind == "utang":
            items.append([e.sale_date, e.amount])
        elif e.kind == "utang_paid":
            paid = e.amount
            for item in items:
                used = min(paid, item[1])
                item[1] -= used
                paid -= used
    buckets = {"age_0_30": 0, "age_31_60": 0, "age_over_60": 0}
    owing = 0
    for items in open_items.values():
        left = [(d, amt) for d, amt in items if amt > 0]
        if left:
            owing += 1
        for d, amt in left:
            age = (as_of - d).days
            key = "age_0_30" if age <= 30 else "age_31_60" if age <= 60 else "age_over_60"
            buckets[key] += amt
    return Receivables(outstanding=sum(buckets.values()), customers_owing=owing, **buckets)


def _strip(e: Entry) -> RecordEntry:
    return RecordEntry(sale_date=e.sale_date, kind=e.kind, amount=e.amount,
                       tier=e.tier, late=e.is_late)


def build_package(owner_id: str, date_from: date, date_to: date,
                  sections: list[Section]) -> RecordsPackage:
    entries = _in_range(owner_id, date_from, date_to)
    wanted = [s for s in ALL_SECTIONS if s in sections]  # fixed order, no repeats
    pkg = RecordsPackage(date_from=date_from, date_to=date_to, sections=wanted)
    if "profile" in wanted:
        pkg.profile = StoreProfile(**STORE_PROFILES[owner_id])
    if "cash_flow" in wanted:
        pkg.cash_flow = cash_flow(entries, date_from, date_to)
    if "monthly" in wanted:
        pkg.monthly = _monthly(entries)
    if "receivables" in wanted:
        pkg.receivables = _receivables(owner_id, date_to)
    if "entries" in wanted:
        pkg.entries = [_strip(e) for e in entries]
    return pkg


CSV_COLUMNS = ["date", "kind", "amount_php", "trust_tier", "late_entry"]


def entries_csv(entries: list[RecordEntry]) -> str:
    """Itemized entries as CSV. Every value is a date, number or fixed word, so
    no cell can start a spreadsheet formula."""
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(CSV_COLUMNS)
    for e in entries:
        writer.writerow([e.sale_date.isoformat(), e.kind, e.amount, e.tier,
                         "yes" if e.late else "no"])
    return buf.getvalue()


def owner_entries(owner_id: str, date_from: date, date_to: date) -> list[RecordEntry]:
    return [_strip(e) for e in _in_range(owner_id, date_from, date_to)]
