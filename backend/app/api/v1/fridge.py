from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.models.fridge import FridgeItem
from app.schemas.fridge import FridgeItemCreate, FridgeItemOut, FridgeItemUpdate

router = APIRouter(prefix="/fridge", tags=["fridge"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/items", response_model=list[FridgeItemOut])
async def list_items(current_user: CurrentUser, db: Db) -> list[FridgeItem]:
    result = await db.execute(
        select(FridgeItem)
        .where(FridgeItem.user_id == current_user.id)
        .order_by(FridgeItem.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/items", response_model=FridgeItemOut, status_code=status.HTTP_201_CREATED)
async def create_item(payload: FridgeItemCreate, current_user: CurrentUser, db: Db) -> FridgeItem:
    item = FridgeItem(
        user_id=current_user.id,
        name=payload.name.strip(),
        quantity=payload.quantity,
        unit=payload.unit,
        category=payload.category,
        expires_at=payload.expires_at,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/items/{item_id}", response_model=FridgeItemOut)
async def update_item(
    item_id: str, payload: FridgeItemUpdate, current_user: CurrentUser, db: Db
) -> FridgeItem:
    item = await _get_owned_item(db, item_id, current_user.id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if value is not None:
            setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: str, current_user: CurrentUser, db: Db) -> None:
    item = await _get_owned_item(db, item_id, current_user.id)
    await db.delete(item)
    await db.commit()


async def _get_owned_item(db: AsyncSession, item_id: str, user_id: str) -> FridgeItem:
    result = await db.execute(
        select(FridgeItem).where(FridgeItem.id == item_id, FridgeItem.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Fridge item not found")
    return item
