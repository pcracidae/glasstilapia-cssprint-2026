"""Ledger entries and a sample ledger for the demo owner (Aling Nena).

There's no ledger API yet, so sharing reads from this sample. When the real
ledger lands, replace `entries_for_owner` with a lookup into it; the lender
summary only depends on the `Entry` model below.

Amounts are whole pesos. Each entry has two dates (see the product brief,
section 5): the `sale_date` the owner picked, and `received_at`, when the
entry reached the server. The gap between them decides "late entry".
"""

import random
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from pydantic import BaseModel

Kind = Literal["sale", "expense", "utang", "utang_paid"]
Tier = Literal["verified", "matched", "corroborated", "self_reported"]

# Entries that reach the server within this long after their sale date are
# on time. A starting guess from the brief; tune with real users.
LATE_AFTER = timedelta(hours=48)

DEMO_OWNER_ID = "nena"
STORE_PROFILES = {
    DEMO_OWNER_ID: {
        "store_name": "Aling Nena's Sari-sari Store",
        "business_type": "Sari-sari store",
        "city": "Quezon City",
        "operating_since": 2019,
    },
}


class Entry(BaseModel):
    id: str
    owner_id: str
    kind: Kind
    amount: int
    tier: Tier
    sale_date: date
    received_at: datetime
    # Utang entries name the customer by nickname. This field must never
    # reach a lender; the lender summary has no field for it.
    customer: str | None = None
    note: str | None = None

    @property
    def is_late(self) -> bool:
        day_end = datetime.combine(self.sale_date, time.max, tzinfo=timezone.utc)
        return self.received_at - day_end > LATE_AFTER


def _sample_entries(owner_id: str, today: date) -> list[Entry]:
    """Sixty days of believable sari-sari store activity, the same every run."""
    rng = random.Random(42)
    customers = ["Mang Jun", "Aling Bebang", "Tisoy", "Ate Lorna"]
    entries: list[Entry] = []

    def add(kind: Kind, amount: int, tier: Tier, day: date, late_days: int = 0,
            customer: str | None = None, note: str | None = None) -> None:
        received = datetime.combine(day, time(20, 0), tzinfo=timezone.utc)
        received += timedelta(days=late_days)
        entries.append(Entry(
            id=f"{owner_id}-{len(entries) + 1}", owner_id=owner_id, kind=kind,
            amount=amount, tier=tier, sale_date=day, received_at=received,
            customer=customer, note=note,
        ))

    for back in range(59, -1, -1):
        day = today - timedelta(days=back)
        # A few days were filled in from the notebook days later.
        late = 5 if back in (40, 41, 23) else 0
        for _ in range(rng.randint(4, 7)):
            tier: Tier = rng.choices(
                ["verified", "matched", "corroborated", "self_reported"],
                weights=[55, 10, 22, 13],
            )[0]
            add("sale", rng.randint(3, 40) * 10, tier, day, late)
        if back % 3 == 0:
            add("expense", rng.randint(8, 20) * 50, "matched", day, late,
                note="Restock from wholesaler")
        if back % 4 == 0:
            add("utang", rng.randint(2, 15) * 10, "self_reported", day, late,
                customer=rng.choice(customers), note="Bigas at sardinas")
        if back % 6 == 0:
            add("utang_paid", rng.randint(2, 10) * 10, "self_reported", day,
                late, customer=rng.choice(customers))
    return entries


def entries_for_owner(owner_id: str, today: date | None = None) -> list[Entry]:
    if owner_id != DEMO_OWNER_ID:
        return []
    return _sample_entries(owner_id, today or date.today())
