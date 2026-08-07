from collections.abc import AsyncGenerator

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _async_database_url() -> str:
    url = make_url(settings.DATABASE_URL)
    if url.drivername in {"postgres", "postgresql"}:
        return url.set(drivername="postgresql+asyncpg").render_as_string(hide_password=False)
    return settings.DATABASE_URL


engine = create_async_engine(
    _async_database_url(),
    echo=False,
    pool_pre_ping=True,
)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    from app.models import fridge, recipe, subscription, user  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if engine.dialect.name == "sqlite":
            await conn.run_sync(_drop_verification_columns)


def _drop_verification_columns(sync_conn) -> None:
    """Remove email-verification columns added by an earlier version (SQLite only, idempotent)."""
    from sqlalchemy import text

    has = sync_conn.execute(
        text(
            "SELECT COUNT(*) FROM pragma_table_info('users') "
            "WHERE name = 'is_email_verified'"
        )
    ).scalar()
    if not has:
        return
    sync_conn.execute(text("ALTER TABLE users DROP COLUMN is_email_verified"))
    sync_conn.execute(text("ALTER TABLE users DROP COLUMN verification_code_hash"))
    sync_conn.execute(text("ALTER TABLE users DROP COLUMN verification_code_expires_at"))
