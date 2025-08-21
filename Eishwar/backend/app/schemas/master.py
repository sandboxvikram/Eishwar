from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Category Schemas
class CategoryBase(BaseModel):
    name: str = Field(max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class CategoryResponse(CategoryBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Style Schemas
class StyleBase(BaseModel):
    name: str = Field(max_length=100)
    code: str = Field(max_length=50)
    category_id: int
    description: Optional[str] = Field(None, max_length=500)

class StyleCreate(StyleBase):
    pass

class StyleUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    category_id: Optional[int] = None
    description: Optional[str] = Field(None, max_length=500)

class StyleResponse(StyleBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    category: Optional[CategoryResponse] = None

    class Config:
        from_attributes = True

# Color Schemas
class ColorBase(BaseModel):
    name: str = Field(max_length=100)
    code: str = Field(max_length=50)
    style_id: int
    hex_value: Optional[str] = Field(None, max_length=7)

class ColorCreate(ColorBase):
    pass

class ColorUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    code: Optional[str] = Field(None, max_length=50)
    style_id: Optional[int] = None
    hex_value: Optional[str] = Field(None, max_length=7)

class ColorResponse(ColorBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    style: Optional[StyleResponse] = None

    class Config:
        from_attributes = True

# Size Schemas
class SizeBase(BaseModel):
    name: str = Field(max_length=50)
    code: str = Field(max_length=20)
    color_id: int
    sort_order: int = 0

class SizeCreate(SizeBase):
    pass

class SizeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    code: Optional[str] = Field(None, max_length=20)
    color_id: Optional[int] = None
    sort_order: Optional[int] = None

class SizeResponse(SizeBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    color: Optional[ColorResponse] = None

    class Config:
        from_attributes = True

# Bulk Upload Schemas
class BulkUploadItem(BaseModel):
    category: str
    style_name: str
    style_code: str
    color_name: str
    color_code: str
    color_hex: Optional[str] = None
    size_name: str
    size_code: str
    size_order: int = 0

class BulkUploadRequest(BaseModel):
    items: List[BulkUploadItem]

class BulkUploadResponse(BaseModel):
    success: bool
    message: str
    processed_count: int
    errors: List[str] = []

# Fabric Bill Schemas
class FabricBillBase(BaseModel):
    bill_number: str = Field(max_length=100)
    supplier_name: str = Field(max_length=200)
    bill_date: datetime
    bill_month: int = Field(ge=1, le=12)
    bill_year: int = Field(ge=2020, le=2050)
    fabric_type: str = Field(max_length=100)
    quantity_meters: float = Field(gt=0)
    rate_per_meter: float = Field(gt=0)
    total_amount: float = Field(gt=0)
    gst_amount: Optional[float] = 0
    final_amount: float = Field(gt=0)

class FabricBillCreate(FabricBillBase):
    pass

class FabricBillResponse(FabricBillBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Accessory Bill Schemas
class AccessoryBillBase(BaseModel):
    bill_number: str = Field(max_length=100)
    supplier_name: str = Field(max_length=200)
    bill_date: datetime
    bill_month: int = Field(ge=1, le=12)
    bill_year: int = Field(ge=2020, le=2050)
    accessory_type: str = Field(max_length=100)
    description: str = Field(max_length=500)
    quantity: int = Field(gt=0)
    rate_per_unit: float = Field(gt=0)
    total_amount: float = Field(gt=0)
    gst_amount: Optional[float] = 0
    final_amount: float = Field(gt=0)

class AccessoryBillCreate(AccessoryBillBase):
    pass

class AccessoryBillResponse(AccessoryBillBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Product Detail Schemas
class ProductDetailBase(BaseModel):
    category: str
    sub_category: Optional[str] = None
    style_no: Optional[str] = None
    all_colors: Optional[str] = None
    all_sizes: Optional[str] = None
    cut_parts: Optional[str] = None
    cut_cost: Optional[float] = None
    print_cost: Optional[float] = None
    stitch_cost: Optional[float] = None
    iron_cost: Optional[float] = None

class ProductDetailCreate(ProductDetailBase):
    pass

class ProductDetailUpdate(BaseModel):
    category: Optional[str] = None
    sub_category: Optional[str] = None
    style_no: Optional[str] = None
    all_colors: Optional[str] = None
    all_sizes: Optional[str] = None
    cut_parts: Optional[str] = None
    cut_cost: Optional[float] = None
    print_cost: Optional[float] = None
    stitch_cost: Optional[float] = None
    iron_cost: Optional[float] = None

class ProductDetailResponse(ProductDetailBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True