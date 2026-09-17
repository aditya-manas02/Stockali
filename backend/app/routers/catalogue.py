from typing import List, Optional, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.catalogue import Category, Product, ProductVariant
from app.schemas import (
    CategoryCreate,
    CategoryResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductDetailResponse,
    ProductVariantCreate,
    ProductVariantResponse,
    PaginatedProductsResponse,
    PaginatedVariantsResponse,
)

router = APIRouter()


# =========================================================
# Categories
# =========================================================

@router.post(
    "/categories",
    response_model=CategoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new category",
)
def create_category(category_in: CategoryCreate, db: Session = Depends(get_db)):
    # Check if category name already exists
    existing = db.query(Category).filter(Category.name == category_in.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Category '{category_in.name}' already exists",
        )

    # If parent_id specified, check that parent exists
    if category_in.parent_id:
        parent = db.query(Category).filter(Category.id == category_in.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent category with id '{category_in.parent_id}' not found",
            )

    category = Category(
        name=category_in.name,
        parent_id=category_in.parent_id,
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get(
    "/categories",
    response_model=List[CategoryResponse],
    summary="List all categories",
)
def list_categories(
    parent_id: Optional[UUID] = Query(None, description="Filter by parent category ID"),
    db: Session = Depends(get_db),
):
    query = db.query(Category)
    if parent_id is not None:
        query = query.filter(Category.parent_id == parent_id)
    return query.order_by(Category.name.asc()).all()


# =========================================================
# Products
# =========================================================

@router.post(
    "/products",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new product",
)
def create_product(product_in: ProductCreate, db: Session = Depends(get_db)):
    # Check category if provided
    if product_in.category_id:
        category = db.query(Category).filter(Category.id == product_in.category_id).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category with id '{product_in.category_id}' not found",
            )

    # Check barcode uniqueness if provided
    if product_in.barcode:
        existing = db.query(Product).filter(Product.barcode == product_in.barcode).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Product with barcode '{product_in.barcode}' already exists",
            )

    product = Product(
        name=product_in.name,
        brand=product_in.brand,
        category_id=product_in.category_id,
        barcode=product_in.barcode,
        image_url=product_in.image_url,
        is_perishable=product_in.is_perishable,
    )
    db.add(product)
    try:
        db.commit()
        db.refresh(product)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integrity error creating product (possible duplicate barcode)",
        )
    return product


@router.get(
    "/products",
    response_model=PaginatedProductsResponse,
    summary="List products with pagination, multi-field search, filters, and sorting",
)
def list_products(
    limit: int = Query(20, ge=1, le=100, description="Page limit (default 20, max 100)"),
    offset: int = Query(0, ge=0, description="Page offset (default 0)"),
    category_id: Optional[UUID] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Search products by name or brand (case-insensitive partial match)"),
    brand: Optional[str] = Query(None, description="Exact-match brand filter"),
    is_perishable: Optional[bool] = Query(None, description="Filter by perishable status"),
    sort_by: Literal["name", "created_at"] = Query("created_at", description="Field to sort by: 'name' or 'created_at'"),
    sort_order: Literal["asc", "desc"] = Query("desc", description="Sort order: 'asc' or 'desc'"),
    db: Session = Depends(get_db),
):
    query = db.query(Product)

    if category_id is not None:
        query = query.filter(Product.category_id == category_id)

    if search:
        pattern = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(pattern),
                Product.brand.ilike(pattern),
            )
        )

    if brand is not None:
        query = query.filter(Product.brand == brand)

    if is_perishable is not None:
        query = query.filter(Product.is_perishable == is_perishable)

    total = query.count()

    sort_col = Product.name if sort_by == "name" else Product.created_at
    if sort_order.lower() == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    items = query.offset(offset).limit(limit).all()

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get(
    "/products/{id}",
    response_model=ProductDetailResponse,
    summary="Get one product with its variants",
)
def get_product(id: UUID, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id '{id}' not found",
        )
    return product


@router.patch(
    "/products/{id}",
    response_model=ProductResponse,
    summary="Update a product",
)
def update_product(id: UUID, product_in: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id '{id}' not found",
        )

    update_data = product_in.model_dump(exclude_unset=True)

    # Validate category if changed
    if "category_id" in update_data and update_data["category_id"] is not None:
        category = db.query(Category).filter(Category.id == update_data["category_id"]).first()
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Category with id '{update_data['category_id']}' not found",
            )

    # Validate barcode if changed
    if "barcode" in update_data and update_data["barcode"] is not None:
        existing = (
            db.query(Product)
            .filter(Product.barcode == update_data["barcode"], Product.id != id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Barcode '{update_data['barcode']}' already taken by another product",
            )

    for field, value in update_data.items():
        setattr(product, field, value)

    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integrity error updating product",
        )
    return product


@router.delete(
    "/products/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a product",
)
def delete_product(id: UUID, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id '{id}' not found",
        )
    db.delete(product)
    db.commit()
    return None


# =========================================================
# Product Variants
# =========================================================

@router.post(
    "/products/{id}/variants",
    response_model=ProductVariantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a variant to a product",
)
def create_product_variant(
    id: UUID,
    variant_in: ProductVariantCreate,
    db: Session = Depends(get_db),
):
    # Verify product exists
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id '{id}' not found",
        )

    # Verify barcode uniqueness if provided
    if variant_in.barcode:
        existing = (
            db.query(ProductVariant)
            .filter(ProductVariant.barcode == variant_in.barcode)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Variant with barcode '{variant_in.barcode}' already exists",
            )

    variant = ProductVariant(
        product_id=id,
        variant_label=variant_in.variant_label,
        barcode=variant_in.barcode,
    )
    db.add(variant)
    try:
        db.commit()
        db.refresh(variant)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integrity error creating variant",
        )
    return variant


@router.get(
    "/products/{id}/variants",
    response_model=PaginatedVariantsResponse,
    summary="List variants for a product with pagination",
)
def list_product_variants(
    id: UUID,
    limit: int = Query(20, ge=1, le=100, description="Page limit (default 20, max 100)"),
    offset: int = Query(0, ge=0, description="Page offset (default 0)"),
    db: Session = Depends(get_db),
):
    # Verify product exists
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id '{id}' not found",
        )

    query = db.query(ProductVariant).filter(ProductVariant.product_id == id)
    total = query.count()
    items = (
        query.order_by(ProductVariant.variant_label.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }
