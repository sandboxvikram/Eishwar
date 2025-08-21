from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
from backend.app.models.cutting import PanelType, BundleStatus, CuttingPlanStatus

# Cutting Lot Schemas
class CuttingLotBase(BaseModel):
    lot_number: str = Field(max_length=100)
    style_id: int
    color_id: int
    fabric_lot: str = Field(max_length=100)
    lay_number: int = Field(gt=0)
    total_pieces: int = Field(gt=0)
    cutting_date: datetime
    created_by: str = Field(max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)

class CuttingLotCreate(CuttingLotBase):
    pass

class CuttingLotResponse(CuttingLotBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Bundle Schemas
class BundleBase(BaseModel):
    bundle_number: str = Field(max_length=100)
    cutting_lot_id: int
    size_id: int
    panel_type: PanelType
    quantity: int = Field(gt=0)
    barcode_data: str = Field(max_length=500)

class BundleCreate(BundleBase):
    pass

class BundleResponse(BundleBase):
    id: int
    qr_code_path: Optional[str] = None
    barcode_path: Optional[str] = None
    status: BundleStatus
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Cutting Program Schemas
class SizeRatio(BaseModel):
    size_id: int
    size_name: str
    ratio: int = Field(gt=0)

class CuttingProgramRequest(BaseModel):
    style_id: int
    color_id: int
    fabric_lot: str = Field(max_length=100)
    lay_number: int = Field(gt=0)
    size_ratios: List[SizeRatio]
    panel_types: List[PanelType]
    total_lays: int = Field(gt=0, le=1000)
    created_by: str = Field(max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)

class CuttingProgramResponse(BaseModel):
    cutting_lot: CuttingLotResponse
    bundles: List[BundleResponse]
    total_bundles: int
    total_pieces: int
    summary: Dict[str, int]  # Summary by size and panel type

class BunchStickerData(BaseModel):
    bundle_id: int
    bundle_number: str
    style_name: str
    color_name: str
    size_name: str
    panel_type: str
    quantity: int
    lot_number: str
    barcode_data: str
    qr_code_url: str
    barcode_url: str

class BunchStickerRequest(BaseModel):
    bundle_ids: List[int]

class BunchStickerResponse(BaseModel):
    stickers: List[BunchStickerData]
    total_stickers: int


# Cutting Plan (Yet-to-Cut) Schemas
class SizeRatioItem(BaseModel):
    size_id: int
    size_name: str
    ratio: float

class SizePcsItem(BaseModel):
    size_id: int
    size_name: str
    pcs: int

class CuttingPlanBase(BaseModel):
    category: str
    sub_category: str | None = None
    style_id: int
    style_code: str
    color_id: int
    color_name: str
    total_pcs: int
    size_ratios: List[SizeRatioItem]

class CuttingPlanCreate(CuttingPlanBase):
    pass

class CuttingPlanResponse(BaseModel):
    id: int
    ct_number: str
    category: str
    sub_category: str | None
    style_id: int
    style_code: str
    color_id: int
    color_name: str
    total_pcs: int
    size_ratios: List[SizeRatioItem]
    size_pcs: List[SizePcsItem]
    status: CuttingPlanStatus
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True