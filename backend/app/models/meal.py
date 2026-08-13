import json
from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MealLog(Base):
    __tablename__ = "meal_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    meal_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    calories: Mapped[float | None] = mapped_column(Float, nullable=True)
    data: Mapped[str | None] = mapped_column(Text, nullable=True)
    eaten_on: Mapped[date] = mapped_column(Date, default=date.today, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    owner: Mapped["User"] = relationship(back_populates="meal_logs")

    def get_payload(self) -> dict | None:
        return json.loads(self.data) if self.data else None

    def set_payload(self, payload: dict | None) -> None:
        self.data = json.dumps(payload, ensure_ascii=False) if payload else None
