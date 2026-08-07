from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser
from app.core.database import get_db
from app.schemas.auth import UserBase, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("/me", response_model=UserBase)
async def get_me(current_user: CurrentUser) -> UserBase:
    return current_user


@router.patch("/me", response_model=UserBase)
async def update_me(payload: UserUpdate, current_user: CurrentUser, db: Db) -> UserBase:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user
