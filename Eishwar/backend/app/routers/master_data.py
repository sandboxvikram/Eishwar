from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlmodel import Session, select
from typing import List, Optional
from backend.app.database import get_session
from backend.app.models.master import Category, Style, Color, Size, FabricBill, AccessoryBill, ProductDetail
from backend.app.schemas.master import (
    CategoryCreate, CategoryResponse, CategoryUpdate,
    StyleCreate, StyleResponse, StyleUpdate,
    ColorCreate, ColorResponse, ColorUpdate,
    SizeCreate, SizeResponse, SizeUpdate,
    BulkUploadRequest, BulkUploadResponse,
    FabricBillCreate, FabricBillResponse,
    AccessoryBillCreate, AccessoryBillResponse,
    ProductDetailCreate, ProductDetailResponse, ProductDetailUpdate
)
import pandas as pd
from datetime import datetime
import io

router = APIRouter(prefix="/master", tags=["Master Data"])

# Category endpoints
@router.post("/categories/", response_model=CategoryResponse)
def create_category(category: CategoryCreate, session: Session = Depends(get_session)):
    db_category = Category.from_orm(category)
    session.add(db_category)
    session.commit()
    session.refresh(db_category)
    return db_category

@router.get("/categories/", response_model=List[CategoryResponse])
def get_categories(session: Session = Depends(get_session)):
    categories = session.exec(select(Category)).all()
    return categories

@router.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(category_id: int, session: Session = Depends(get_session)):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category

@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(category_id: int, category_update: CategoryUpdate, session: Session = Depends(get_session)):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category_data = category_update.dict(exclude_unset=True)
    for field, value in category_data.items():
        setattr(category, field, value)
    
    category.updated_at = datetime.utcnow()
    session.add(category)
    session.commit()
    session.refresh(category)
    return category

@router.delete("/categories/{category_id}")
def delete_category(category_id: int, session: Session = Depends(get_session)):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    session.delete(category)
    session.commit()
    return {"message": "Category deleted successfully"}

# Style endpoints
@router.post("/styles/", response_model=StyleResponse)
def create_style(style: StyleCreate, session: Session = Depends(get_session)):
    # Check if category exists
    category = session.get(Category, style.category_id)
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")
    
    # Check if style code already exists
    existing_style = session.exec(select(Style).where(Style.code == style.code)).first()
    if existing_style:
        raise HTTPException(status_code=400, detail="Style code already exists")
    
    db_style = Style.from_orm(style)
    session.add(db_style)
    session.commit()
    session.refresh(db_style)
    return db_style

@router.get("/styles/", response_model=List[StyleResponse])
def get_styles(category_id: Optional[int] = None, session: Session = Depends(get_session)):
    statement = select(Style)
    if category_id:
        statement = statement.where(Style.category_id == category_id)
    styles = session.exec(statement).all()
    return styles

@router.get("/styles/{style_id}", response_model=StyleResponse)
def get_style(style_id: int, session: Session = Depends(get_session)):
    style = session.get(Style, style_id)
    if not style:
        raise HTTPException(status_code=404, detail="Style not found")
    return style

# Color endpoints
@router.post("/colors/", response_model=ColorResponse)
def create_color(color: ColorCreate, session: Session = Depends(get_session)):
    # Check if style exists
    style = session.get(Style, color.style_id)
    if not style:
        raise HTTPException(status_code=400, detail="Style not found")
    
    db_color = Color.from_orm(color)
    session.add(db_color)
    session.commit()
    session.refresh(db_color)
    return db_color

@router.get("/colors/", response_model=List[ColorResponse])
def get_colors(style_id: Optional[int] = None, session: Session = Depends(get_session)):
    statement = select(Color)
    if style_id:
        statement = statement.where(Color.style_id == style_id)
    colors = session.exec(statement).all()
    return colors

# Size endpoints
@router.post("/sizes/", response_model=SizeResponse)
def create_size(size: SizeCreate, session: Session = Depends(get_session)):
    # Check if color exists
    color = session.get(Color, size.color_id)
    if not color:
        raise HTTPException(status_code=400, detail="Color not found")
    
    db_size = Size.from_orm(size)
    session.add(db_size)
    session.commit()
    session.refresh(db_size)
    return db_size

@router.get("/sizes/", response_model=List[SizeResponse])
def get_sizes(color_id: Optional[int] = None, session: Session = Depends(get_session)):
    statement = select(Size)
    if color_id:
        statement = statement.where(Size.color_id == color_id)
    statement = statement.order_by(Size.sort_order, Size.name)
    sizes = session.exec(statement).all()
    return sizes

# Bulk upload endpoint
@router.post("/bulk-upload/", response_model=BulkUploadResponse)
async def bulk_upload_excel(
    file: UploadFile = File(...),
    session: Session = Depends(get_session)
):
    """Bulk upload master data from Excel file"""
    
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only Excel files are supported")
    
    try:
        # Read Excel file
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Validate required columns
        required_columns = ['category', 'style_name', 'style_code', 'color_name', 'color_code', 'size_name', 'size_code']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        processed_count = 0
        errors = []
        
        # Process each row
        for index, row in df.iterrows():
            try:
                # Get or create category
                category_name = str(row['category']).strip()
                category = session.exec(select(Category).where(Category.name == category_name)).first()
                
                if not category:
                    category = Category(name=category_name)
                    session.add(category)
                    session.commit()
                    session.refresh(category)
                
                # Get or create style
                style_code = str(row['style_code']).strip()
                style = session.exec(select(Style).where(Style.code == style_code)).first()
                
                if not style:
                    style = Style(
                        name=str(row['style_name']).strip(),
                        code=style_code,
                        category_id=category.id
                    )
                    session.add(style)
                    session.commit()
                    session.refresh(style)
                
                # Get or create color
                color_code = str(row['color_code']).strip()
                color = session.exec(
                    select(Color).where(
                        Color.code == color_code,
                        Color.style_id == style.id
                    )
                ).first()
                
                if not color:
                    color = Color(
                        name=str(row['color_name']).strip(),
                        code=color_code,
                        style_id=style.id,
                        hex_value=str(row.get('color_hex', '')).strip() or None
                    )
                    session.add(color)
                    session.commit()
                    session.refresh(color)
                
                # Get or create size
                size_code = str(row['size_code']).strip()
                size = session.exec(
                    select(Size).where(
                        Size.code == size_code,
                        Size.color_id == color.id
                    )
                ).first()
                
                if not size:
                    size = Size(
                        name=str(row['size_name']).strip(),
                        code=size_code,
                        color_id=color.id,
                        sort_order=int(row.get('size_order', 0))
                    )
                    session.add(size)
                    session.commit()
                    session.refresh(size)
                
                processed_count += 1
                
            except Exception as e:
                errors.append(f"Row {index + 2}: {str(e)}")
        
        return BulkUploadResponse(
            success=processed_count > 0,
            message=f"Processed {processed_count} items successfully",
            processed_count=processed_count,
            errors=errors
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

# Fabric Bill endpoints
@router.post("/fabric-bills/", response_model=FabricBillResponse)
def create_fabric_bill(bill: FabricBillCreate, session: Session = Depends(get_session)):
    # Check if bill number already exists
    existing_bill = session.exec(select(FabricBill).where(FabricBill.bill_number == bill.bill_number)).first()
    if existing_bill:
        raise HTTPException(status_code=400, detail="Bill number already exists")
    
    db_bill = FabricBill.from_orm(bill)
    session.add(db_bill)
    session.commit()
    session.refresh(db_bill)
    return db_bill

@router.get("/fabric-bills/", response_model=List[FabricBillResponse])
def get_fabric_bills(
    month: Optional[int] = None,
    year: Optional[int] = None,
    session: Session = Depends(get_session)
):
    statement = select(FabricBill)
    if month:
        statement = statement.where(FabricBill.bill_month == month)
    if year:
        statement = statement.where(FabricBill.bill_year == year)
    statement = statement.order_by(FabricBill.bill_date.desc())
    bills = session.exec(statement).all()
    return bills

# Accessory Bill endpoints
@router.post("/accessory-bills/", response_model=AccessoryBillResponse)
def create_accessory_bill(bill: AccessoryBillCreate, session: Session = Depends(get_session)):
    # Check if bill number already exists
    existing_bill = session.exec(select(AccessoryBill).where(AccessoryBill.bill_number == bill.bill_number)).first()
    if existing_bill:
        raise HTTPException(status_code=400, detail="Bill number already exists")
    
    db_bill = AccessoryBill.from_orm(bill)
    session.add(db_bill)
    session.commit()
    session.refresh(db_bill)
    return db_bill

@router.get("/accessory-bills/", response_model=List[AccessoryBillResponse])
def get_accessory_bills(
    month: Optional[int] = None,
    year: Optional[int] = None,
    session: Session = Depends(get_session)
):
    statement = select(AccessoryBill)
    if month:
        statement = statement.where(AccessoryBill.bill_month == month)
    if year:
        statement = statement.where(AccessoryBill.bill_year == year)
    statement = statement.order_by(AccessoryBill.bill_date.desc())
    bills = session.exec(statement).all()
    return bills

# Product Details endpoints (authoritative writes here only)
@router.post("/product-details/", response_model=ProductDetailResponse)
def create_product_detail(item: ProductDetailCreate, session: Session = Depends(get_session)):
    db_item = ProductDetail.from_orm(item)
    session.add(db_item)
    session.commit()
    session.refresh(db_item)
    return db_item

@router.get("/product-details/", response_model=List[ProductDetailResponse])
def list_product_details(session: Session = Depends(get_session)):
    items = session.exec(select(ProductDetail).order_by(ProductDetail.created_at.desc())).all()
    return items

@router.get("/product-details/{item_id}", response_model=ProductDetailResponse)
def get_product_detail(item_id: int, session: Session = Depends(get_session)):
    item = session.get(ProductDetail, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Product detail not found")
    return item

@router.put("/product-details/{item_id}", response_model=ProductDetailResponse)
def update_product_detail(item_id: int, payload: ProductDetailUpdate, session: Session = Depends(get_session)):
    item = session.get(ProductDetail, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Product detail not found")
    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(item, k, v)
    item.updated_at = datetime.utcnow()
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@router.delete("/product-details/{item_id}")
def delete_product_detail(item_id: int, session: Session = Depends(get_session)):
    item = session.get(ProductDetail, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Product detail not found")
    session.delete(item)
    session.commit()
    return {"message": "Product detail deleted"}