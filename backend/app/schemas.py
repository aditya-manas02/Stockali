from datetime import datetime
from typing import List, Optional, Literal, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


# =========================================================
# Category Schemas
# =========================================================

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Unique name of category")
    parent_id: Optional[UUID] = Field(None, description="Optional parent category UUID")


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# Product Variant Schemas
# =========================================================

class ProductVariantBase(BaseModel):
    variant_label: str = Field(..., min_length=1, max_length=255, description="e.g. 500g, 1L, Red / Medium")
    barcode: Optional[str] = Field(None, description="Optional unique barcode for this variant")


class ProductVariantCreate(ProductVariantBase):
    pass


class ProductVariantResponse(ProductVariantBase):
    id: UUID
    product_id: UUID

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# Product Schemas
# =========================================================

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Name of the product")
    brand: Optional[str] = Field(None, max_length=255, description="Brand name")
    category_id: Optional[UUID] = Field(None, description="Category UUID")
    barcode: Optional[str] = Field(None, description="Optional unique barcode for product")
    image_url: Optional[str] = Field(None, description="URL of product image")
    is_perishable: bool = Field(False, description="Whether product is perishable")


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    brand: Optional[str] = None
    category_id: Optional[UUID] = None
    barcode: Optional[str] = None
    image_url: Optional[str] = None
    is_perishable: Optional[bool] = None


class ProductResponse(ProductBase):
    id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductDetailResponse(ProductResponse):
    variants: List[ProductVariantResponse] = []

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# Pagination Wrapper Schemas
# =========================================================

class PaginatedProductsResponse(BaseModel):
    items: List[ProductResponse]
    total: int = Field(..., description="Total matching items count")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")


class PaginatedVariantsResponse(BaseModel):
    items: List[ProductVariantResponse]
    total: int = Field(..., description="Total matching variants count")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")


# =========================================================
# User Schemas (Temporary creation path)
# =========================================================

class UserCreate(BaseModel):
    email: Optional[str] = Field(None, description="Unique user email")
    phone: Optional[str] = Field(None, description="Unique phone number")
    password: str = Field(..., min_length=6, description="Plain text password (hashed before storing)")
    full_name: str = Field(..., min_length=1, description="Full name of user")
    role: Literal["customer", "retailer_owner", "retailer_staff", "admin"] = Field(
        "retailer_owner", description="User role"
    )


class UserResponse(BaseModel):
    id: UUID
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: str
    role: str
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# Store Schemas
# =========================================================

class StoreCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Store branch name")
    address: Optional[str] = Field(None, description="Physical address")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate (-90 to 90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate (-180 to 180)")
    phone: Optional[str] = Field(None, description="Store contact phone")
    opening_hours: Optional[Any] = Field(None, description="Opening hours JSON or schedule")
    is_active: bool = Field(True, description="Whether store is active")


class StoreUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    address: Optional[str] = None
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    phone: Optional[str] = None
    opening_hours: Optional[Any] = None
    is_active: Optional[bool] = None


class StoreResponse(BaseModel):
    id: UUID
    retailer_id: UUID
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    phone: Optional[str] = None
    opening_hours: Optional[Any] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_model(cls, store) -> "StoreResponse":
        from app.geo_utils import point_to_lat_lng
        lat, lng = point_to_lat_lng(store.location)
        return cls(
            id=store.id,
            retailer_id=store.retailer_id,
            name=store.name,
            address=store.address,
            latitude=lat if lat is not None else 0.0,
            longitude=lng if lng is not None else 0.0,
            phone=store.phone,
            opening_hours=store.opening_hours,
            is_active=store.is_active,
            created_at=store.created_at,
        )


# =========================================================
# Retailer Schemas
# =========================================================

class RetailerCreate(BaseModel):
    business_name: str = Field(..., min_length=1, description="Registered business name")
    owner_user_id: UUID = Field(..., description="UUID of the user who owns this retailer business")


class RetailerResponse(BaseModel):
    id: UUID
    owner_user_id: UUID
    business_name: str
    verification_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RetailerDetailResponse(RetailerResponse):
    stores: List[StoreResponse] = []


