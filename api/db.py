"""SQLAlchemy models. SQLite locally; set DATABASE_URL for Neon/Supabase Postgres."""

import os
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, UniqueConstraint, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

REPO_ROOT = Path(__file__).resolve().parent.parent   # .../floodsense
DEFAULT_SQLITE = f"sqlite:///{REPO_ROOT / 'data' / 'processed' / 'floodsense.db'}"
DATABASE_URL = os.environ.get("DATABASE_URL", DEFAULT_SQLITE)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True)
    phone = Column(String, nullable=False)          # E.164, e.g. +919xxxxxxxxx
    district = Column(String, nullable=False)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)
    __table_args__ = (UniqueConstraint("phone", "district", name="uq_phone_district"),)


class RiskState(Base):
    """Latest inference snapshot per station; history kept for charts."""
    __tablename__ = "risk_state"
    id = Column(Integer, primary_key=True)
    station_id = Column(String, index=True, nullable=False)
    district = Column(String, index=True, nullable=False)
    as_of = Column(String, nullable=False)          # window end date (ISO)
    p24 = Column(Float, nullable=False)
    p48 = Column(Float, nullable=False)
    p72 = Column(Float, nullable=False)
    tier24 = Column(Integer, nullable=False)
    tier48 = Column(Integer, nullable=False)
    tier72 = Column(Integer, nullable=False)
    updated_at = Column(DateTime, default=utcnow)


Base.metadata.create_all(engine)
