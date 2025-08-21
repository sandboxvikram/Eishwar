from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List
from enum import Enum

class StitchingUnit(SQLModel, table=True):
    """Stitching units/contractors"""
    __tablename__ = "stitching_units"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=200, unique=True, index=True)
    contact_person: str = Field(max_length=100)
    phone: str = Field(max_length=20)
    email: Optional[str] = Field(default=None, max_length=100)
    address: str = Field(max_length=500)
    capacity_per_day: int = Field(gt=0)
    rate_per_piece: float = Field(gt=0)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    delivery_challans: List["DeliveryChallan"] = Relationship(back_populates="stitching_unit")

class DCStatus(str, Enum):
    OPEN = "open"
    PARTIAL = "partial"
    HOLD = "hold"
    CLEARED = "cleared"

class DeliveryChallan(SQLModel, table=True):
    """Delivery challans for sending bundles to stitching units"""
    __tablename__ = "delivery_challans"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    dc_number: str = Field(max_length=100, unique=True, index=True)
    stitching_unit_id: int = Field(foreign_key="stitching_units.id")
    cutting_lot_id: int = Field(foreign_key="cutting_lots.id")
    dc_date: datetime = Field(default_factory=datetime.utcnow)
    total_pieces_sent: int = Field(gt=0)
    total_pieces_returned: int = Field(default=0)
    status: DCStatus = Field(default=DCStatus.OPEN, index=True)
    qr_code_data: str = Field(max_length=500)  # QR code data for scanning
    qr_code_path: Optional[str] = Field(default=None, max_length=500)
    dispatch_date: Optional[datetime] = Field(default=None)
    expected_return_date: Optional[datetime] = Field(default=None)
    actual_return_date: Optional[datetime] = Field(default=None)
    hold_reason: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    stitching_unit: StitchingUnit = Relationship(back_populates="delivery_challans")
    dc_items: List["DCItem"] = Relationship(back_populates="delivery_challan")

class DCItem(SQLModel, table=True):
    """Individual items/bundles in a delivery challan"""
    __tablename__ = "dc_items"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    dc_id: int = Field(foreign_key="delivery_challans.id")
    bundle_id: int = Field(foreign_key="bundles.id")
    quantity_sent: int = Field(gt=0)
    quantity_returned: int = Field(default=0)
    quantity_ok: int = Field(default=0)
    quantity_rejected: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    delivery_challan: DeliveryChallan = Relationship(back_populates="dc_items")