from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.users import User
from app.models.retailers import Retailer, Store
from app.schemas import (
    RetailerCreate,
    RetailerResponse,
    RetailerDetailResponse,
    StoreCreate,
    StoreUpdate,
    StoreResponse,
)
from app.geo_utils import lat_lng_to_point, point_to_lat_lng
from app.auth_utils import get_optional_current_user

router = APIRouter()


# =========================================================
# Retailers Endpoints
# =========================================================

@router.post(
    "/retailers",
    response_model=RetailerResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["retailers"],
    summary="Register a new retailer business",
)
def create_retailer(retailer_in: RetailerCreate, db: Session = Depends(get_db)):
    # Verify owner user exists
    owner = db.query(User).filter(User.id == retailer_in.owner_user_id).first()
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Owner user with id '{retailer_in.owner_user_id}' does not exist",
        )

    retailer = Retailer(
        business_name=retailer_in.business_name,
        owner_user_id=retailer_in.owner_user_id,
        verification_status="pending",
    )
    db.add(retailer)
    try:
        db.commit()
        db.refresh(retailer)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integrity error creating retailer",
        )
    return retailer


@router.get(
    "/retailers",
    response_model=List[RetailerResponse],
    tags=["retailers"],
    summary="List retailers with optional verification status filter",
)
def list_retailers(
    verification_status: Optional[str] = Query(
        None,
        description="Filter by status: 'pending', 'verified', 'rejected', 'suspended'",
    ),
    db: Session = Depends(get_db),
):
    query = db.query(Retailer)
    if verification_status:
        query = query.filter(Retailer.verification_status == verification_status)
    return query.order_by(Retailer.created_at.desc()).all()


@router.get(
    "/retailers/{id}",
    response_model=RetailerDetailResponse,
    tags=["retailers"],
    summary="Get retailer details with nested stores",
)
def get_retailer(id: UUID, db: Session = Depends(get_db)):
    retailer = db.query(Retailer).filter(Retailer.id == id).first()
    if not retailer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Retailer with id '{id}' not found",
        )

    store_responses = [StoreResponse.from_orm_model(s) for s in retailer.stores]
    return RetailerDetailResponse(
        id=retailer.id,
        owner_user_id=retailer.owner_user_id,
        business_name=retailer.business_name,
        verification_status=retailer.verification_status,
        created_at=retailer.created_at,
        stores=store_responses,
    )


# =========================================================
# Stores Endpoints
# =========================================================

@router.post(
    "/retailers/{id}/stores",
    response_model=StoreResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["stores"],
    summary="Create a store branch under a retailer",
)
def create_store(
    id: UUID,
    store_in: StoreCreate,
    db: Session = Depends(get_db),
):
    # Verify retailer exists
    retailer = db.query(Retailer).filter(Retailer.id == id).first()
    if not retailer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Retailer with id '{id}' not found",
        )

    # Convert lat/lng to PostGIS geography Point
    location_point = lat_lng_to_point(store_in.latitude, store_in.longitude)

    store = Store(
        retailer_id=id,
        name=store_in.name,
        address=store_in.address,
        location=location_point,
        phone=store_in.phone,
        opening_hours=store_in.opening_hours,
        is_active=store_in.is_active,
    )
    db.add(store)
    try:
        db.commit()
        db.refresh(store)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integrity error creating store",
        )

    return StoreResponse.from_orm_model(store)


@router.get(
    "/retailers/{id}/stores",
    response_model=List[StoreResponse],
    tags=["stores"],
    summary="List all stores belonging to a retailer",
)
def list_retailer_stores(id: UUID, db: Session = Depends(get_db)):
    # Verify retailer exists
    retailer = db.query(Retailer).filter(Retailer.id == id).first()
    if not retailer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Retailer with id '{id}' not found",
        )

    stores = (
        db.query(Store)
        .filter(Store.retailer_id == id)
        .order_by(Store.created_at.desc())
        .all()
    )
    return [StoreResponse.from_orm_model(s) for s in stores]


@router.get(
    "/stores",
    response_model=List[StoreResponse],
    tags=["stores"],
    summary="List all stores with optional filtering by retailer_id, active status, or current authenticated retailer",
)
def list_stores(
    retailer_id: Optional[UUID] = Query(None, description="Filter by retailer ID"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    query = db.query(Store)

    if retailer_id:
        query = query.filter(Store.retailer_id == retailer_id)
    elif current_user and current_user.role in ["retailer_owner", "retailer_staff"]:
        user_retailers = db.query(Retailer.id).filter(Retailer.owner_user_id == current_user.id).all()
        retailer_ids = [r[0] for r in user_retailers]
        if retailer_ids:
            query = query.filter(Store.retailer_id.in_(retailer_ids))
        else:
            return []

    if is_active is not None:
        query = query.filter(Store.is_active == is_active)

    stores = query.order_by(Store.created_at.desc()).all()
    return [StoreResponse.from_orm_model(s) for s in stores]


@router.get(
    "/stores/{id}",
    response_model=StoreResponse,
    tags=["stores"],
    summary="Get single store details with decoded latitude/longitude",
)
def get_store(id: UUID, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == id).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store with id '{id}' not found",
        )
    return StoreResponse.from_orm_model(store)


@router.patch(
    "/stores/{id}",
    response_model=StoreResponse,
    tags=["stores"],
    summary="Update store details",
)
def update_store(
    id: UUID,
    store_in: StoreUpdate,
    db: Session = Depends(get_db),
):
    store = db.query(Store).filter(Store.id == id).first()
    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store with id '{id}' not found",
        )

    update_data = store_in.model_dump(exclude_unset=True)

    # Handle coordinates update
    if "latitude" in update_data or "longitude" in update_data:
        curr_lat, curr_lng = point_to_lat_lng(store.location)
        new_lat = update_data.pop("latitude", curr_lat)
        new_lng = update_data.pop("longitude", curr_lng)
        if new_lat is not None and new_lng is not None:
            store.location = lat_lng_to_point(new_lat, new_lng)

    for field, value in update_data.items():
        setattr(store, field, value)

    try:
        db.commit()
        db.refresh(store)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Integrity error updating store",
        )

    return StoreResponse.from_orm_model(store)
