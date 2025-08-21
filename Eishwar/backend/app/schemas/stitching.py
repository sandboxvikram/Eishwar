from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from backend.app.models.stitching import DCStatus

# Stitching Unit Schemas
class StitchingUnitBase(BaseModel):
    name: str = Field(max_length=200)
    contact_person: str = Field(max_length=100)
    phone: str = Field(max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    address: str = Field(max_length=500)
    capacity_per_day: int = Field(gt=0)
    rate_per_piece: float = Field(gt=0)
    is_active: bool = True

class StitchingUnitCreate(StitchingUnitBase):
    pass

class StitchingUnitUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    contact_person: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    address: Optional[str] = Field(None, max_length=500)
    capacity_per_day: Optional[int] = Field(None, gt=0)
    rate_per_piece: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None

class StitchingUnitResponse(StitchingUnitBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# DC Item Schemas
class DCItemCreate(BaseModel):
    bundle_id: int
    quantity_sent: int = Field(gt=0)

class DCItemResponse(BaseModel):
    id: int
    bundle_id: int
    quantity_sent: int
    quantity_returned: int
    quantity_ok: int
    quantity_rejected: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Delivery Challan Schemas
class DeliveryChallanBase(BaseModel):
    stitching_unit_id: int
    cutting_lot_id: int
    expected_return_date: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=1000)

class DeliveryChallanCreate(DeliveryChallanBase):
    dc_items: List[DCItemCreate]

class DeliveryChallanUpdate(BaseModel):
    expected_return_date: Optional[datetime] = None
    actual_return_date: Optional[datetime] = None
    hold_reason: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[DCStatus] = None

class DeliveryChallanResponse(DeliveryChallanBase):
    id: int
    dc_number: str
    dc_date: datetime
    total_pieces_sent: int
    total_pieces_returned: int
    status: DCStatus
    qr_code_data: str
    qr_code_path: Optional[str] = None
    dispatch_date: Optional[datetime] = None
    actual_return_date: Optional[datetime] = None
    hold_reason: Optional[str] = None
    dc_items: List[DCItemResponse] = []
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# QR Scan Schemas
class QRScanRequest(BaseModel):
    qr_code_data: str
    scanner_name: str = Field(max_length=100)
    scan_type: str = Field(pattern="^(outbound|inbound)$")  # outbound or inbound
    scanned_quantity: int = Field(gt=0)
    notes: Optional[str] = Field(None, max_length=500)

class QRScanResponse(BaseModel):
    success: bool
    message: str
    dc_id: Optional[int] = None
    expected_quantity: int
    scanned_quantity: int
    is_match: bool
    variance: int
    new_status: Optional[DCStatus] = None