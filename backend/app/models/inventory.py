import uuid
from sqlalchemy import Column, Numeric, Boolean, DateTime, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class StoreProductListing(Base):
    __tablename__ = "store_product_listings"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_variant_id = Column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="CASCADE"),
        nullable=False,
    )
    current_price = Column(Numeric(10, 2), nullable=False)
    is_available = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    last_confirmed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("store_id", "product_variant_id", name="uq_store_product_variant"),
    )

    store = relationship("Store", backref="listings")
    product_variant = relationship("ProductVariant", lazy="joined")
    inventory = relationship(
        "InventoryRecord",
        uselist=False,
        back_populates="listing",
        cascade="all, delete-orphan",
        lazy="joined",
    )
    price_history = relationship(
        "PriceHistory",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="desc(PriceHistory.effective_from)",
    )
    stock_movements = relationship(
        "StockMovement",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="desc(StockMovement.created_at)",
    )


class InventoryRecord(Base):
    __tablename__ = "inventory_records"

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
    quantity_on_hand = Column(Numeric(10, 2), nullable=False, default=0, server_default=text("0"))
    reorder_threshold = Column(Numeric(10, 2), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
    )

    listing = relationship("StoreProductListing", back_populates="inventory")


class PriceHistory(Base):
    __tablename__ = "price_history"

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
    price = Column(Numeric(10, 2), nullable=False)
    effective_from = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    listing = relationship("StoreProductListing", back_populates="price_history")


class StockMovement(Base):
    __tablename__ = "stock_movements"

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
    change_qty = Column(Numeric(10, 2), nullable=False)
    reason = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )

    listing = relationship("StoreProductListing", back_populates="stock_movements")
