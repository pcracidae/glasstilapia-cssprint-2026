"""Who is calling. A stand-in until owner login (PIN or phone) exists.

Every owner-only endpoint depends on `current_owner`, and every lookup is
filtered by the owner id it returns, so swapping in real login later only
changes this function. Tests override it to act as a different owner.
"""

from app.ledger import DEMO_OWNER_ID


def current_owner() -> str:
    # TODO: read the owner's session once login lands.
    return DEMO_OWNER_ID
