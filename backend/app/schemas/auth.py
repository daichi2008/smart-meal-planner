from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=120)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    full_name: str | None = None
    plan: str
    calorie_target: float | None = None
    dietary_preferences: str | None = None
    is_active: bool


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)
    calorie_target: float | None = Field(default=None, ge=500, le=8000)
    dietary_preferences: str | None = Field(default=None, max_length=500)


class UserStatsOut(BaseModel):
    plan: str
    fridge_count: int
    saved_count: int
    meals_logged_total: int
    streak_days: int
    suggestions_used_today: int
    weekly_average_calories: float
