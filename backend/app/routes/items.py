"""Example resource. Copy this file as a template for real features,
then delete it once the problem statement is in.

Data lives in memory, so it resets when the server restarts. Swap in
SQLite or a real database only if the demo actually needs persistence.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ItemIn(BaseModel):
    name: str
    done: bool = False


class Item(ItemIn):
    id: int


_items: dict[int, Item] = {}
_next_id = 1


@router.get("", response_model=list[Item])
def list_items() -> list[Item]:
    return list(_items.values())


@router.post("", response_model=Item, status_code=201)
def create_item(payload: ItemIn) -> Item:
    global _next_id
    item = Item(id=_next_id, **payload.model_dump())
    _items[item.id] = item
    _next_id += 1
    return item


@router.get("/{item_id}", response_model=Item)
def get_item(item_id: int) -> Item:
    if item_id not in _items:
        raise HTTPException(status_code=404, detail="Item not found")
    return _items[item_id]


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int) -> None:
    if _items.pop(item_id, None) is None:
        raise HTTPException(status_code=404, detail="Item not found")
