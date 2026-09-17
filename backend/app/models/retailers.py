import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from geoalchemy2 import Geography

from app.database import Base


class Retailer(Base):
    __tablename__ = "retailers"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    owner_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    business_name = Column(String, nullable=False)
    verification_status = Column(
        String,
        nullable=False,
        default="pending",
        server_default=text("'pending'"),
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    owner = relationship("User", back_populates="retailers")
    stores = relationship(
        "Store",
        back_populates="retailer",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Store(Base):
    __tablename__ = "stores"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    retailer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("retailers.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    location = Column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=True),
        nullable=False,
    )
    phone = Column(String, nullable=True)
    opening_hours = Column(JSONB, nullable=True)
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    retailer = relationship("Retailer", back_populates="stores")
