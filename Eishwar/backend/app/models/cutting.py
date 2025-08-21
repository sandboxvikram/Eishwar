from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import Column
from sqlalchemy.dialects.sqlite import JSON as SQLITE_JSON

class CuttingLot(SQLModel, table=True):
    """Cutting lots with fabric and style information"""
    __tablename__ = "cutting_lots"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    lot_number: str = Field(max_length=100, unique=True, index=True)
    style_id: int = Field(foreign_key="styles.id")
    color_id: int = Field(foreign_key="colors.id")
    fabric_lot: str = Field(max_length=100)
    lay_number: int = Field(gt=0)
    total_pieces: int = Field(gt=0)
    cutting_date: datetime = Field(default_factory=datetime.utcnow)
    created_by: str = Field(max_length=100)
    notes: Optional[str] = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    bundles: List["Bundle"] = Relationship(back_populates="cutting_lot")

class PanelType(str, Enum):
    FRONT = "front"
    BACK = "back"
    SLEEVE = "sleeve"
    COLLAR = "collar"
    CUFF = "cuff"
    POCKET = "pocket"

class BundleStatus(str, Enum):
    CREATED = "created"
    DISPATCHED = "dispatched"
    RETURNED = "returned"

class Bundle(SQLModel, table=True):
    """Individual bundles within cutting lots"""
    __tablename__ = "bundles"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    bundle_number: str = Field(max_length=100, unique=True, index=True)
    cutting_lot_id: int = Field(foreign_key="cutting_lots.id")
    size_id: int = Field(foreign_key="sizes.id")
    panel_type: PanelType = Field(index=True)
    quantity: int = Field(gt=0)
    barcode_data: str = Field(max_length=500)  # Generated barcode data
    qr_code_path: Optional[str] = Field(default=None, max_length=500)  # QR code file path
    barcode_path: Optional[str] = Field(default=None, max_length=500)  # Barcode file path
    status: BundleStatus = Field(default=BundleStatus.CREATED, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    cutting_lot: CuttingLot = Relationship(back_populates="bundles")


class CuttingPlanStatus(str, Enum):
    PENDING = "pending"
    STARTED = "started"
    COMPLETED = "completed"


class CuttingPlan(SQLModel, table=True):
    """Pre-cut uploaded plans with per-size requirements, to be turned into cutting programs"""
    __tablename__ = "cutting_plans"

    id: Optional[int] = Field(default=None, primary_key=True)
    ct_number: str = Field(index=True, unique=True, max_length=20)
    category: str = Field(max_length=100)
    sub_category: Optional[str] = Field(default=None, max_length=50)
    style_id: int = Field(foreign_key="styles.id")
    style_code: str = Field(max_length=100)
    color_id: int = Field(foreign_key="colors.id")
    color_name: str = Field(max_length=100)
    total_pcs: int = Field(gt=0)
    size_ratios: Dict[str, Any] = Field(sa_column=Column(SQLITE_JSON))  # {size_id, size_name, ratio}
    size_pcs: Dict[str, Any] = Field(sa_column=Column(SQLITE_JSON))     # {size_id, size_name, pcs}
    status: CuttingPlanStatus = Field(default=CuttingPlanStatus.PENDING, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)