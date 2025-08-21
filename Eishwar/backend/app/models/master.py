from sqlmodel import SQLModel, Field, Relationship
from datetime import datetime
from typing import Optional, List
from enum import Enum

class Category(SQLModel, table=True):
    """Product categories (e.g., Shirts, Pants, Dresses)"""
    __tablename__ = "categories"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, unique=True, index=True)
    description: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    styles: List["Style"] = Relationship(back_populates="category")

class Style(SQLModel, table=True):
    """Styles within categories (e.g., Formal Shirt, Casual Shirt)"""
    __tablename__ = "styles"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, index=True)
    code: str = Field(max_length=50, unique=True, index=True)
    category_id: int = Field(foreign_key="categories.id")
    description: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    category: Category = Relationship(back_populates="styles")
    colors: List["Color"] = Relationship(back_populates="style")

class Color(SQLModel, table=True):
    """Colors for each style"""
    __tablename__ = "colors"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, index=True)
    code: str = Field(max_length=50, index=True)  # Hex code or internal code
    style_id: int = Field(foreign_key="styles.id")
    hex_value: Optional[str] = Field(default=None, max_length=7)  # #FFFFFF
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    style: Style = Relationship(back_populates="colors")
    sizes: List["Size"] = Relationship(back_populates="color")

class Size(SQLModel, table=True):
    """Sizes for each color/style combination"""
    __tablename__ = "sizes"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(max_length=50, index=True)  # S, M, L, XL, etc.
    code: str = Field(max_length=20, index=True)
    color_id: int = Field(foreign_key="colors.id")
    sort_order: int = Field(default=0)  # For ordering sizes properly
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)
    
    # Relationships
    color: Color = Relationship(back_populates="sizes")

class BillType(str, Enum):
    FABRIC = "fabric"
    ACCESSORY = "accessory"

class FabricBill(SQLModel, table=True):
    """Monthly fabric purchase bills"""
    __tablename__ = "fabric_bills"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    bill_number: str = Field(max_length=100, unique=True, index=True)
    supplier_name: str = Field(max_length=200)
    bill_date: datetime
    bill_month: int = Field(ge=1, le=12)  # 1-12
    bill_year: int = Field(ge=2020, le=2050)
    fabric_type: str = Field(max_length=100)
    quantity_meters: float = Field(gt=0)
    rate_per_meter: float = Field(gt=0)
    total_amount: float = Field(gt=0)
    gst_amount: Optional[float] = Field(default=0)
    final_amount: float = Field(gt=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)

class AccessoryBill(SQLModel, table=True):
    """Monthly accessory purchase bills"""
    __tablename__ = "accessory_bills"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    bill_number: str = Field(max_length=100, unique=True, index=True)
    supplier_name: str = Field(max_length=200)
    bill_date: datetime
    bill_month: int = Field(ge=1, le=12)
    bill_year: int = Field(ge=2020, le=2050)
    accessory_type: str = Field(max_length=100)  # Buttons, Zippers, etc.
    description: str = Field(max_length=500)
    quantity: int = Field(gt=0)
    rate_per_unit: float = Field(gt=0)
    total_amount: float = Field(gt=0)
    gst_amount: Optional[float] = Field(default=0)
    final_amount: float = Field(gt=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)

class ProductDetail(SQLModel, table=True):
    """Product details consolidated for master data."""
    __tablename__ = "product_details"

    id: Optional[int] = Field(default=None, primary_key=True)
    category: str = Field(max_length=100, index=True)
    sub_category: Optional[str] = Field(default=None, max_length=50)
    style_no: Optional[str] = Field(default=None, max_length=100)
    all_colors: Optional[str] = Field(default=None, max_length=1000)  # comma-separated
    all_sizes: Optional[str] = Field(default=None, max_length=1000)   # comma-separated
    cut_parts: Optional[str] = Field(default=None, max_length=1000)
    cut_cost: Optional[float] = Field(default=None, ge=0)
    print_cost: Optional[float] = Field(default=None, ge=0)
    stitch_cost: Optional[float] = Field(default=None, ge=0)
    iron_cost: Optional[float] = Field(default=None, ge=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = Field(default=None)