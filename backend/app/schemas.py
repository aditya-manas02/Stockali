from datetime import datetime
from typing import List, Optional
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
