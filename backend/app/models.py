from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class TimestampMixin:
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(255), default="", nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), default="viewer", nullable=False)
    status = Column(String(32), default="active", nullable=False)
    avatar_url = Column(String(500), nullable=True)

    dashboards = relationship("Dashboard", back_populates="owner")
    datasets = relationship("Dataset", back_populates="owner")


class Dataset(Base, TimestampMixin):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    datasource_id = Column(Integer, ForeignKey("datasources.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    sql = Column(Text, default="", nullable=False)

    owner = relationship("User", back_populates="datasets")
    datasource = relationship("Datasource", back_populates="datasets")
    dashboards = relationship("Dashboard", back_populates="dataset")


class Dashboard(Base, TimestampMixin):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(120), default="", nullable=False)
    icon = Column(String(80), default="BarChart3", nullable=False)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=True)
    status = Column(String(32), default="draft", nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_path = Column(String(500), nullable=True)
    file_url = Column(String(500), nullable=True)

    owner = relationship("User", back_populates="dashboards")
    dataset = relationship("Dataset", back_populates="dashboards")


class Datasource(Base, TimestampMixin):
    __tablename__ = "datasources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(32), nullable=False)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=True)
    username = Column(String(255), nullable=False)
    password_encrypted = Column(Text, nullable=True)
    database = Column(String(255), default="", nullable=False)
    status = Column(String(32), default="pending", nullable=False)

    datasets = relationship("Dataset", back_populates="datasource")


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    system_name = Column(String(120), default="AstroCore", nullable=False)
    system_icon = Column(String(80), default="Zap", nullable=False)
    logo_url = Column(String(500), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
