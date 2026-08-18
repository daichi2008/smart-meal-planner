from collections.abc import AsyncGenerator

from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _async_database_url() -> str:
    url = make_url(settings.DATABASE_URL)
    if url.drivername in {"postgres", "postgresql"}:
        url = url.set(drivername="postgresql+asyncpg")
        query = dict(url.query)
        if "sslmode" in query:
            query["ssl"] = query.pop("sslmode")
        return url.set(query=query).render_as_string(hide_password=False)
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
    from app.models import fridge, meal, recipe, subscription, user  # noqa: F401

    async with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            await conn.run_sync(_drop_legacy_stripe_schema)
        await conn.run_sync(Base.metadata.create_all)
        if engine.dialect.name == "sqlite":
            await conn.run_sync(_drop_verification_columns)
        await conn.run_sync(_add_unlimited_suggestions_column)


def _drop_legacy_stripe_schema(sync_conn) -> None:
    """Drop the old Stripe-era subscriptions table/columns (SQLite only, idempotent).

    The previous version stored Stripe identifiers. The AdvCash SCI version
    recreates the table with provider-agnostic columns, so the legacy table is
    dropped before create_all runs.
    """
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if "subscriptions" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("subscriptions")}
        if "stripe_subscription_id" in cols:
            sync_conn.execute(text("DROP TABLE subscriptions"))
    if "users" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("users")}
        if "stripe_customer_id" in cols:
            sync_conn.execute(text("DROP INDEX IF EXISTS ix_users_stripe_customer_id"))
            sync_conn.execute(text("ALTER TABLE users DROP COLUMN stripe_customer_id"))


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


def _add_unlimited_suggestions_column(sync_conn) -> None:
    """Add unlimited_suggestions column to users table if missing (idempotent)."""
    from sqlalchemy import inspect, text

    insp = inspect(sync_conn)
    if "users" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("users")}
    if "unlimited_suggestions" in cols:
        return
    dialect = sync_conn.dialect.name
    if dialect == "sqlite":
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN unlimited_suggestions BOOLEAN NOT NULL DEFAULT 0"))
    else:
        sync_conn.execute(text("ALTER TABLE users ADD COLUMN unlimited_suggestions BOOLEAN NOT NULL DEFAULT FALSE"))
