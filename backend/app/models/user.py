from datetime import datetime
from enum import Enum
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Plan(str, Enum):
    FREE = "free"
    WEEKLY = "weekly"
    PRO = "pro"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    plan: Mapped[Plan] = mapped_column(SAEnum(Plan), default=Plan.FREE, nullable=False)
    calorie_target: Mapped[float | None] = mapped_column(Float, nullable=True)
    dietary_preferences: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    unlimited_suggestions: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    fridge_items: Mapped[list["FridgeItem"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    saved_recipes: Mapped[list["SavedRecipe"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )
    meal_logs: Mapped[list["MealLog"]] = relationship(
        back_populates="owner", cascade="all, delete-orphan"
    )


from app.models.fridge import FridgeItem  # noqa: E402
from app.models.meal import MealLog  # noqa: E402
from app.models.recipe import SavedRecipe  # noqa: E402
