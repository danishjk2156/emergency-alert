from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Category
from ..schemas import CategoryResponse

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get("", response_model=list[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """List all emergency categories with icons and base weights."""
    return db.query(Category).order_by(Category.id.asc()).all()
