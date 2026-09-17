from datetime import datetime
from typing import List, Optional, Literal, Any, Dict
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


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
# User & Auth Schemas
# =========================================================

class UserCreate(BaseModel):
    email: Optional[str] = Field(None, description="Unique user email")
    phone: Optional[str] = Field(None, description="Unique phone number")
    password: str = Field(..., min_length=6, description="Plain text password (hashed before storing)")
    full_name: str = Field(..., min_length=1, description="Full name of user")
    role: Literal["customer", "retailer_owner", "retailer_staff", "admin"] = Field(
        "retailer_owner", description="User role"
    )


class UserRegisterRequest(BaseModel):
    email: Optional[str] = Field(None, description="Unique user email")
    phone: Optional[str] = Field(None, description="Unique phone number")
    password: str = Field(..., min_length=6, description="Plain text password (min 6 characters)")
    full_name: str = Field(..., min_length=1, description="Full name of user")
    role: Literal["customer", "retailer_owner", "retailer_staff", "admin"] = Field(
        "customer", description="User role"
    )
    default_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Default latitude for customer")
    default_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Default longitude for customer")
    search_radius_m: Optional[int] = Field(3000, gt=0, le=50000, description="Default search radius in meters")

    @model_validator(mode="after")
    def check_email_or_phone(self):
        if not self.email and not self.phone:
            raise ValueError("Either email or phone must be provided")
        return self


class UserLoginRequest(BaseModel):
    email_or_phone: str = Field(..., min_length=1, description="User email or phone number")
    password: str = Field(..., min_length=1, description="Password")


class CustomerProfileResponse(BaseModel):
    search_radius_m: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    preferences: Dict[str, Any] = Field(default_factory=dict)


class CustomerProfileUpdate(BaseModel):
    default_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0)
    default_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0)
    search_radius_m: Optional[int] = Field(None, gt=0, le=50000)
    preferences: Optional[Dict[str, Any]] = None


class UserResponse(BaseModel):
    id: UUID
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: str
    role: str
    is_verified: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserMeResponse(BaseModel):
    id: UUID
    email: Optional[str] = None
    phone: Optional[str] = None
    full_name: str
    role: str
    is_verified: bool
    created_at: datetime
    customer_profile: Optional[CustomerProfileResponse] = None

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


# =========================================================
# Store Product Listing & Inventory Schemas
# =========================================================

class StoreListingCreate(BaseModel):
    product_variant_id: UUID = Field(..., description="UUID of product variant from shared catalogue")
    current_price: float = Field(..., gt=0, description="Selling price at this store")
    quantity_on_hand: float = Field(0.0, ge=0, description="Initial stock quantity on hand")
    reorder_threshold: Optional[float] = Field(None, ge=0, description="Minimum stock level before alert")
    is_available: bool = Field(True, description="Whether listing is active and buyable")


class StoreListingUpdate(BaseModel):
    current_price: Optional[float] = Field(None, gt=0, description="Updated price")
    is_available: Optional[bool] = Field(None, description="Updated availability status")
    quantity_on_hand: Optional[float] = Field(None, ge=0, description="Direct stock level update")
    reorder_threshold: Optional[float] = Field(None, ge=0, description="Updated reorder threshold")
    stock_change_reason: Optional[Literal["restock", "sale", "adjustment", "expiry_writeoff"]] = Field(
        "adjustment", description="Reason for quantity change if quantity_on_hand is modified"
    )


class StoreListingResponse(BaseModel):
    id: UUID
    store_id: UUID
    product_variant_id: UUID
    product_id: Optional[UUID] = None
    product_name: Optional[str] = None
    brand: Optional[str] = None
    variant_label: Optional[str] = None
    barcode: Optional[str] = None
    current_price: float
    is_available: bool
    quantity_on_hand: float
    reorder_threshold: Optional[float] = None
    last_confirmed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaginatedStoreListingsResponse(BaseModel):
    items: List[StoreListingResponse]
    total: int = Field(..., description="Total matching listings count")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")


class StockAdjustmentCreate(BaseModel):
    change_qty: float = Field(..., description="Quantity delta (+ for restock, - for sale/adjustment)")
    reason: Literal["restock", "sale", "adjustment", "expiry_writeoff"] = Field(
        "restock", description="Reason for stock movement"
    )


class StockMovementResponse(BaseModel):
    id: UUID
    store_product_listing_id: UUID
    change_qty: float
    reason: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PriceHistoryResponse(BaseModel):
    id: UUID
    store_product_listing_id: UUID
    price: float
    effective_from: datetime

    model_config = ConfigDict(from_attributes=True)


class StoreListingDetailResponse(StoreListingResponse):
    recent_price_history: List[PriceHistoryResponse] = []
    recent_stock_movements: List[StockMovementResponse] = []


# =========================================================
# Geospatial Search Schemas
# =========================================================

class NearbyStoreResponse(BaseModel):
    id: UUID
    retailer_id: UUID
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    phone: Optional[str] = None
    opening_hours: Optional[Any] = None
    is_active: bool
    distance_meters: float = Field(..., description="Calculated distance in meters from customer coordinates")

    model_config = ConfigDict(from_attributes=True)


class PaginatedNearbyStoresResponse(BaseModel):
    items: List[NearbyStoreResponse]
    total: int = Field(..., description="Total matching stores within radius")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")


class NearbyProductSearchResult(BaseModel):
    listing_id: UUID
    store_id: UUID
    store_name: str
    store_address: Optional[str] = None
    store_distance_meters: float
    product_id: UUID
    product_name: str
    brand: Optional[str] = None
    image_url: Optional[str] = None
    product_variant_id: UUID
    variant_label: str
    barcode: Optional[str] = None
    current_price: float
    is_available: bool
    quantity_on_hand: float

    model_config = ConfigDict(from_attributes=True)


class PaginatedNearbyProductsResponse(BaseModel):
    items: List[NearbyProductSearchResult]
    total: int = Field(..., description="Total in-stock products matching in nearby stores")
    limit: int = Field(..., description="Limit applied")
    offset: int = Field(..., description="Offset applied")


# =========================================================
# Shopping Lists & Pickup Schemas
# =========================================================

class ShoppingListItemCreate(BaseModel):
    store_product_listing_id: UUID
    quantity: float = Field(1.0, gt=0, description="Quantity requested")
    substitution_allowed: bool = Field(False, description="Whether customer allows product substitution")


class ShoppingListItemUpdate(BaseModel):
    quantity: Optional[float] = Field(None, gt=0)
    substitution_allowed: Optional[bool] = None


class ShoppingListItemStatusUpdate(BaseModel):
    status: Literal["pending", "confirmed", "substituted", "unavailable"]


class ShoppingListItemResponse(BaseModel):
    id: UUID
    shopping_list_id: UUID
    store_product_listing_id: UUID
    quantity: float
    substitution_allowed: bool
    status: str
    product_name: Optional[str] = None
    brand: Optional[str] = None
    variant_label: Optional[str] = None
    current_price: Optional[float] = None
    subtotal: Optional[float] = None
    quantity_on_hand: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class ShoppingListCreate(BaseModel):
    store_id: UUID = Field(..., description="Target store UUID")
    notes: Optional[str] = Field(None, description="Optional customer notes for in-store pickup")
    items: Optional[List[ShoppingListItemCreate]] = Field(default_factory=list, description="Initial list items")


class ShoppingListStatusUpdate(BaseModel):
    status: Literal["accepted", "declined", "ready", "collected", "cancelled"] = Field(
        ..., description="New fulfillment status"
    )


class ShoppingListResponse(BaseModel):
    id: UUID
    customer_id: UUID
    store_id: UUID
    store_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    total_items: int = 0
    estimated_total: float = 0.0
    items: List[ShoppingListItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class PaginatedShoppingListsResponse(BaseModel):
    items: List[ShoppingListResponse]
    total: int
    limit: int
    offset: int





