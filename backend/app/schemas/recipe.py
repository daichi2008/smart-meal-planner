from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RecipeSuggestionRequest(BaseModel):
    ingredient_ids: list[str] | None = Field(default=None, description="IDs of fridge items to use")
    ingredients: list[str] | None = Field(default=None, description="Free-form ingredient names")
    calorie_target: float | None = Field(default=None, ge=500, le=8000)
    meal_type: str | None = Field(default=None, max_length=30)
    count: int = Field(default=3, ge=1, le=6)
    use_only_available: bool = True
    language: str | None = Field(default=None, max_length=10)


class RecipeOut(BaseModel):
    title: str
    summary: str
    calories_per_serving: float | None = None
    prep_time_minutes: int | None = None
    servings: int
    ingredients: list[str]
    steps: list[str]
    macros: dict[str, Any] | None = None
    tags: list[str] | None = None
    missing_ingredients: list[str] | None = None
    tip: str | None = None


class RecipeSuggestionResponse(BaseModel):
    recipes: list[RecipeOut]
    source: str = "ai"


class SaveRecipeRequest(BaseModel):
    title: str
    summary: str | None = None
    data: RecipeOut


class SavedRecipeOut(BaseModel):
    id: str
    title: str
    summary: str | None = None
    created_at: datetime
    recipe: RecipeOut
