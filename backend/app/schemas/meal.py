from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.recipe import RecipeOut


class MealLogCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    meal_type: str | None = Field(default=None, max_length=30)
    calories: float | None = Field(default=None, ge=0, le=10000)
    eaten_on: date | None = None
    data: dict[str, Any] | None = None


class MealLogOut(BaseModel):
    id: str
    title: str
    meal_type: str | None = None
    calories: float | None = None
    eaten_on: date
    created_at: datetime
    recipe: RecipeOut | None = None


class DailyCalories(BaseModel):
    date: date
    calories: float
    meals: int


class MealSummaryOut(BaseModel):
    days: list[DailyCalories]
    average_calories: float
    target: float | None = None
    consumed_today: float
    meals_today: int
    remaining_today: float | None = None
