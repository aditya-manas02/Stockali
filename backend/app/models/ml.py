import uuid
from sqlalchemy import Column, String, Date, DateTime, Numeric, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DemandForecast(Base):
    __tablename__ = "demand_forecasts"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    store_product_listing_id = Column(
        UUID(as_uuid=True),
        ForeignKey("store_product_listings.id", ondelete="CASCADE"),
        nullable=False,
    )
    forecast_date = Column(Date, nullable=False)
    predicted_quantity = Column(Numeric(10, 2), nullable=False)
    model_version = Column(String, nullable=False)
    generated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    listing = relationship("StoreProductListing")


class RestockRecommendation(Base):
    __tablename__ = "restock_recommendations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    store_product_listing_id = Column(
        UUID(as_uuid=True),
        ForeignKey("store_product_listings.id", ondelete="CASCADE"),
        nullable=False,
    )
    recommended_quantity = Column(Numeric(10, 2), nullable=False)
    recommended_by = Column(Date, nullable=True)
    confidence = Column(Numeric(4, 3), nullable=True)
    explanation = Column(String, nullable=True)
    retailer_action = Column(
        String,
        nullable=True,
        default="pending",
        server_default=text("'pending'"),
    )
    generated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    listing = relationship("StoreProductListing")


class DiscountRecommendation(Base):
    __tablename__ = "discount_recommendations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    store_product_listing_id = Column(
        UUID(as_uuid=True),
        ForeignKey("store_product_listings.id", ondelete="CASCADE"),
        nullable=False,
    )
    recommended_discount_pct = Column(Numeric(5, 2), nullable=False)
    reason = Column(String, nullable=True)
    confidence = Column(Numeric(4, 3), nullable=True)
    retailer_action = Column(
        String,
        nullable=True,
        default="pending",
        server_default=text("'pending'"),
    )
    generated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    listing = relationship("StoreProductListing")


class ModelEvaluation(Base):
    __tablename__ = "model_evaluations"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    model_name = Column(String, nullable=False)
    model_version = Column(String, nullable=False)
    evaluated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )
    metrics = Column(JSONB, nullable=False)
