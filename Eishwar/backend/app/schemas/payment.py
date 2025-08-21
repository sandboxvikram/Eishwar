from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from backend.app.models.payment import PaymentStatus, ReturnType

# Payment Schemas
class PaymentBase(BaseModel):
    stitching_unit_id: int
    payment_date: datetime
    total_pieces: int = Field(gt=0)
    rate_per_piece: float = Field(gt=0)
    gross_amount: float = Field(gt=0)
    deduction_amount: float = 0
    net_amount: float = Field(gt=0)
    payment_method: str = Field(max_length=50)
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    created_by: str = Field(max_length=100)

class PaymentCreate(PaymentBase):
    dc_ids: List[int]  # DCs included in this payment

class PaymentUpdate(BaseModel):
    status: Optional[PaymentStatus] = None
    cleared_date: Optional[datetime] = None
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)

class PaymentResponse(PaymentBase):
    id: int
    payment_number: str
    status: PaymentStatus
    cleared_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Payment Calculation Schemas
class DCForPayment(BaseModel):
    dc_id: int
    dc_number: str
    stitching_unit_id: int
    total_pieces_returned: int
    total_ok_pieces: int
    rate_per_piece: float
    amount: float

class PaymentCalculationRequest(BaseModel):
    stitching_unit_id: int
    from_date: datetime
    to_date: datetime
    dc_ids: Optional[List[int]] = None  # If None, calculate for all cleared DCs in date range

class PaymentCalculationResponse(BaseModel):
    stitching_unit_id: int
    unit_name: str
    total_pieces: int
    rate_per_piece: float
    gross_amount: float
    suggested_deduction: float
    net_amount: float
    dc_list: List[DCForPayment]

# Stitch Return Schemas
class StitchReturnBase(BaseModel):
    dc_id: int
    bundle_id: int
    return_date: datetime
    quantity_returned: int = Field(gt=0)
    return_type: ReturnType
    defect_description: Optional[str] = Field(None, max_length=500)
    inspector_name: str = Field(max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)

class StitchReturnCreate(StitchReturnBase):
    pass

class StitchReturnResponse(StitchReturnBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# QC Record Schemas
class QCRecordResponse(BaseModel):
    id: int
    dc_id: int
    scan_type: str
    scan_datetime: datetime
    scanned_quantity: int
    expected_quantity: int
    is_match: bool
    variance: int
    scanner_name: str
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True