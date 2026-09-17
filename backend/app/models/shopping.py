import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class ShoppingList(Base):
    __tablename__ = "shopping_lists"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    customer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    store_id = Column(
        UUID(as_uuid=True),
        ForeignKey("stores.id", ondelete="CASCADE"),
        nullable=False,
    )
    status = Column(
        String,
        nullable=False,
        default="draft",
        server_default=text("'draft'"),
    )
    notes = Column(String, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=func.now(),
        server_default=func.now(),
        onupdate=func.now(),
    )

    customer = relationship("User")
    store = relationship("Store")
    items = relationship("ShoppingListItem", back_populates="shopping_list", cascade="all, delete-orphan")


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    shopping_list_id = Column(
        UUID(as_uuid=True),
        ForeignKey("shopping_lists.id", ondelete="CASCADE"),
        nullable=False,
    )
    store_product_listing_id = Column(
        UUID(as_uuid=True),
        ForeignKey("store_product_listings.id"),
        nullable=False,
    )
    quantity = Column(
        Numeric(10, 2),
        nullable=False,
        default=1.0,
        server_default=text("1"),
    )
    substitution_allowed = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    status = Column(
        String,
        nullable=False,
        default="pending",
        server_default=text("'pending'"),
    )

    shopping_list = relationship("ShoppingList", back_populates="items")
    listing = relationship("StoreProductListing")
