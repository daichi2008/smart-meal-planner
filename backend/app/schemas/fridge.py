from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FridgeItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    quantity: float = Field(default=1.0, gt=0)
    unit: str | None = Field(default=None, max_length=30)
    category: str | None = Field(default=None, max_length=50)
    expires_at: datetime | None = None


class FridgeItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    quantity: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=30)
    category: str | None = Field(default=None, max_length=50)
    expires_at: datetime | None = None


class FridgeItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    quantity: float
    unit: str | None = None
    category: str | None = None
    expires_at: datetime | None = None
    created_at: datetime
