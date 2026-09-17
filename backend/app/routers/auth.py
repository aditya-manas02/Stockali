from typing import Optional, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.models.users import User, CustomerProfile
from app.schemas import (
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    UserResponse,
    UserMeResponse,
    CustomerProfileResponse,
    CustomerProfileUpdate,
)
from app.auth_utils import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.geo_utils import lat_lng_to_point, point_to_lat_lng

router = APIRouter(prefix="/auth", tags=["authentication"])


def _build_user_me_response(user: User) -> UserMeResponse:
    profile_data = None
    if user.customer_profile:
        lat, lng = point_to_lat_lng(user.customer_profile.default_location)
        profile_data = CustomerProfileResponse(
            search_radius_m=user.customer_profile.search_radius_m,
            latitude=lat,
            longitude=lng,
            preferences=user.customer_profile.preferences or {},
        )

    return UserMeResponse(
        id=user.id,
        email=user.email,
        phone=user.phone,
        full_name=user.full_name,
        role=user.role,
        is_verified=user.is_verified,
        created_at=user.created_at,
        customer_profile=profile_data,
    )


# =========================================================
# 1. User Registration (Customer or Retailer Owner)
# =========================================================

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user (customer, retailer_owner, retailer_staff, admin)",
)
def register(req: UserRegisterRequest, db: Session = Depends(get_db)):
    # Check duplicate email
    if req.email:
        existing_email = db.query(User).filter(User.email == req.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists",
            )

    # Check duplicate phone
    if req.phone:
        existing_phone = db.query(User).filter(User.phone == req.phone).first()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this phone number already exists",
            )

    # Hash password with bcrypt
    hashed_pwd = get_password_hash(req.password)

    user = User(
        email=req.email,
        phone=req.phone,
        password_hash=hashed_pwd,
        full_name=req.full_name,
        role=req.role,
        is_verified=False,
    )
    db.add(user)
    db.flush()

    # If role is customer, set up customer_profile
    if req.role == "customer":
        loc = None
        if req.default_latitude is not None and req.default_longitude is not None:
            loc = lat_lng_to_point(req.default_latitude, req.default_longitude)

        profile = CustomerProfile(
            user_id=user.id,
            default_location=loc,
            search_radius_m=req.search_radius_m if req.search_radius_m is not None else 3000,
            preferences={},
        )
        db.add(profile)

    db.commit()
    db.refresh(user)

    # Generate JWT token
    token = create_access_token({"sub": str(user.id), "role": user.role})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


# =========================================================
# 2. User Login (Email or Phone + Password)
# =========================================================

@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login with email or phone + password to receive JWT token",
)
def login(req: UserLoginRequest, db: Session = Depends(get_db)):
    identifier = req.email_or_phone.strip()
    user = (
        db.query(User)
        .filter(or_(User.email == identifier, User.phone == identifier))
        .first()
    )

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email/phone or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token({"sub": str(user.id), "role": user.role})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


# =========================================================
# 3. Authenticated User Profile (GET /auth/me)
# =========================================================

@router.get(
    "/me",
    response_model=UserMeResponse,
    summary="Get profile of currently logged-in user",
)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    return _build_user_me_response(current_user)


# =========================================================
# 4. Customer Profile Update (PATCH /auth/profile)
# =========================================================

@router.patch(
    "/profile",
    response_model=UserMeResponse,
    summary="Update customer profile (search radius, default location, preferences)",
)
def update_customer_profile(
    req: CustomerProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = current_user.customer_profile
    if not profile:
        # Create profile if not yet existing
        profile = CustomerProfile(
            user_id=current_user.id,
            search_radius_m=req.search_radius_m or 3000,
            preferences={},
        )
        db.add(profile)
        db.flush()

    if req.search_radius_m is not None:
        profile.search_radius_m = req.search_radius_m

    if req.preferences is not None:
        updated_prefs = dict(profile.preferences or {})
        updated_prefs.update(req.preferences)
        profile.preferences = updated_prefs

    if req.default_latitude is not None and req.default_longitude is not None:
        profile.default_location = lat_lng_to_point(req.default_latitude, req.default_longitude)

    db.commit()
    db.refresh(current_user)

    return _build_user_me_response(current_user)
