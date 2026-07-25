"""
Async SQLAlchemy engine/session setup for PostgreSQL, plus the ORM models
that back the durable "decision log" and reference data. The live
operational state (flights, gates, disruptions) is kept in the in-memory
SimulatorState for sub-second read/update performance and mirrored to
Postgres for the persisted audit trail (decision_logs, recovery_plans).
"""
from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, JSON, ForeignKey, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(32), default="operator")  # operator | supervisor | admin
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DisruptionLog(Base):
    __tablename__ = "disruption_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    disruption_id: Mapped[str] = mapped_column(String(64), index=True)
    type: Mapped[str] = mapped_column(String(64))
    severity: Mapped[str] = mapped_column(String(16))
    flight_ids: Mapped[dict] = mapped_column(JSON)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    raw_payload: Mapped[dict] = mapped_column(JSON)


class RecoveryPlanLog(Base):
    __tablename__ = "recovery_plan_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    disruption_id: Mapped[str] = mapped_column(String(64), index=True)
    plan_id: Mapped[str] = mapped_column(String(64), index=True)
    rank: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    confidence_score: Mapped[float] = mapped_column(Float)
    estimated_time_saved_minutes: Mapped[float] = mapped_column(Float)
    estimated_cost_usd: Mapped[float] = mapped_column(Float)
    risk_level: Mapped[str] = mapped_column(String(16))
    reasoning: Mapped[dict] = mapped_column(JSON)
    actions: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DecisionLog(Base):
    """Immutable audit trail: every approve/reject/override an operator makes.
    This is the table the 'learning loop' (analytics, future RL fine-tuning)
    is built on top of."""
    __tablename__ = "decision_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    disruption_id: Mapped[str] = mapped_column(String(64), index=True)
    plan_id: Mapped[str] = mapped_column(String(64))
    operator_username: Mapped[str] = mapped_column(String(64))
    decision: Mapped[str] = mapped_column(String(16))  # approved | rejected | overridden
    notes: Mapped[str] = mapped_column(String(500), default="")
    time_to_decision_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    resulting_state: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
