"""
=============================================================================
TEMPORARY STUB: User Creation Endpoint
=============================================================================
WARNING: This router exists ONLY to unblock Phase 0 retailer and store
creation by providing a user account for `retailers.owner_user_id`.

No login, session management, JWT tokens, email verification, or auth guards
are implemented here.

WHEN REAL AUTH IS BUILT:
- This endpoint should either be REMOVED entirely in favor of a proper
  `/auth/signup` workflow, OR
- Be locked down strictly to ADMIN-only access (e.g. via JWT role-check
  dependency) for system administrative provisioning.
=============================================================================
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models.users import User
from app.schemas import UserCreate, UserResponse
from app.auth_utils import get_password_hash

router = APIRouter(prefix="/users", tags=["users (temporary)"])


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="[TEMPORARY] Create a user to unblock retailer owner creation",
)
def create_user_temporary(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    [TEMPORARY ENDPOINT]
    Creates a new user record with a bcrypt password hash.

    NOTE: This is a Phase 0 stub to provide valid `owner_user_id` foreign keys
    for retailers. It will be superseded by the full authentication layer.
    """
    # Check if email or phone already exists
    if user_in.email:
        existing_email = db.query(User).filter(User.email == user_in.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with email '{user_in.email}' already exists",
            )
    if user_in.phone:
        existing_phone = db.query(User).filter(User.phone == user_in.phone).first()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"User with phone '{user_in.phone}' already exists",
            )

    hashed_pw = get_password_hash(user_in.password)

    user = User(
        email=user_in.email,
        phone=user_in.phone,
        password_hash=hashed_pw,
        full_name=user_in.full_name,
        role=user_in.role,
        is_verified=False,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email or phone already exists",
        )
    return user
