from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List
from enum import Enum

class PaymentStatus(str, Enum):
    PENDING = "pending"
    CLEARED = "cleared"

class Payment(SQLModel, table=True):
    """Payments to stitching units"""
    __tablename__ = "payments"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    payment_number: str = Field(max_length=100, unique=True, index=True)
    stitching_unit_id: int = Field(foreign_key="stitching_units.id")
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    total_pieces: int = Field(gt=0)
    rate_per_piece: float = Field(gt=0)
    gross_amount: float = Field(gt=0)
    deduction_amount: float = Field(default=0)
    net_amount: float = Field(gt=0)
    status: PaymentStatus = Field(default=PaymentStatus.PENDING, index=True)
    payment_method: str = Field(max_length=50)  # Cash, Bank Transfer, etc.
    reference_number: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = Field(default=None, max_length=1000)
    created_by: str = Field(max_length=100)
    cleared_date: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)

class ReturnType(str, Enum):
    OK = "ok"
    REJECT = "reject"

class StitchReturn(SQLModel, table=True):
    """Records of returned stitched items"""
    __tablename__ = "stitch_returns"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    dc_id: int = Field(foreign_key="delivery_challans.id")
    bundle_id: int = Field(foreign_key="bundles.id")
    return_date: datetime = Field(default_factory=datetime.utcnow)
    quantity_returned: int = Field(gt=0)
    return_type: ReturnType = Field(index=True)
    defect_description: Optional[str] = Field(default=None, max_length=500)
    inspector_name: str = Field(max_length=100)
    notes: Optional[str] = Field(default=None, max_length=1000)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class QCRecord(SQLModel, table=True):
    """Quality control scan records"""
    __tablename__ = "qc_records"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    dc_id: int = Field(foreign_key="delivery_challans.id")
    scan_type: str = Field(max_length=20, index=True)  # "outbound" or "inbound"
    scan_datetime: datetime = Field(default_factory=datetime.utcnow)
    scanned_quantity: int = Field(gt=0)
    expected_quantity: int = Field(gt=0)
    is_match: bool = Field(index=True)
    variance: int = Field(default=0)  # difference between scanned and expected
    scanner_name: str = Field(max_length=100)
    notes: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)