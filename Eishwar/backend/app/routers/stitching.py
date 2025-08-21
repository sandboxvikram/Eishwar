from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import func
from typing import List, Optional
from backend.app.database import get_session
from backend.app.models.stitching import StitchingUnit, DeliveryChallan, DCItem, DCStatus
from backend.app.models.master import ProductDetail
from backend.app.models.cutting import Bundle, BundleStatus
from backend.app.schemas.stitching import (
    StitchingUnitCreate, StitchingUnitResponse, StitchingUnitUpdate,
    DeliveryChallanCreate, DeliveryChallanResponse, DeliveryChallanUpdate
)
from backend.app.utils.qr_generator import generate_dc_qr_data, create_qr_with_info
from datetime import datetime

router = APIRouter(prefix="/stitching", tags=["Stitching Management"])

# Stitching Unit endpoints
@router.post("/units/", response_model=StitchingUnitResponse)
def create_stitching_unit(unit: StitchingUnitCreate, session: Session = Depends(get_session)):
    """Create a new stitching unit"""
    
    # Check if unit name already exists
    existing_unit = session.exec(
        select(StitchingUnit).where(StitchingUnit.name == unit.name)
    ).first()
    
    if existing_unit:
        raise HTTPException(status_code=400, detail="Stitching unit name already exists")
    
    db_unit = StitchingUnit.from_orm(unit)
    session.add(db_unit)
    session.commit()
    session.refresh(db_unit)
    return db_unit

@router.get("/units/", response_model=List[StitchingUnitResponse])
def get_stitching_units(
    is_active: Optional[bool] = None,
    session: Session = Depends(get_session)
):
    """Get list of stitching units"""
    
    statement = select(StitchingUnit)
    if is_active is not None:
        statement = statement.where(StitchingUnit.is_active == is_active)
    statement = statement.order_by(StitchingUnit.name)
    
    units = session.exec(statement).all()
    return units

@router.get("/units/{unit_id}", response_model=StitchingUnitResponse)
def get_stitching_unit(unit_id: int, session: Session = Depends(get_session)):
    """Get specific stitching unit"""
    
    unit = session.get(StitchingUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Stitching unit not found")
    return unit

@router.put("/units/{unit_id}", response_model=StitchingUnitResponse)
def update_stitching_unit(
    unit_id: int,
    unit_update: StitchingUnitUpdate,
    session: Session = Depends(get_session)
):
    """Update stitching unit"""
    
    unit = session.get(StitchingUnit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Stitching unit not found")
    
    unit_data = unit_update.dict(exclude_unset=True)
    for field, value in unit_data.items():
        setattr(unit, field, value)
    
    unit.updated_at = datetime.utcnow()
    session.add(unit)
    session.commit()
    session.refresh(unit)
    return unit

# Delivery Challan endpoints
@router.post("/delivery-challans/", response_model=DeliveryChallanResponse)
async def create_delivery_challan(
    dc_data: DeliveryChallanCreate,
    session: Session = Depends(get_session)
):
    """Create a new delivery challan"""
    
    # Verify stitching unit exists
    unit = session.get(StitchingUnit, dc_data.stitching_unit_id)
    if not unit:
        raise HTTPException(status_code=400, detail="Stitching unit not found")
    
    # Verify cutting lot exists
    from backend.app.models.cutting import CuttingLot
    lot = session.get(CuttingLot, dc_data.cutting_lot_id)
    if not lot:
        raise HTTPException(status_code=400, detail="Cutting lot not found")
    
    # Verify all bundles exist and are available
    bundle_ids = [item.bundle_id for item in dc_data.dc_items]
    bundles = session.exec(select(Bundle).where(Bundle.id.in_(bundle_ids))).all()
    
    if len(bundles) != len(bundle_ids):
        raise HTTPException(status_code=400, detail="One or more bundles not found")
    
    # Check if bundles are available (not already dispatched)
    unavailable_bundles = [b for b in bundles if b.status != BundleStatus.CREATED]
    if unavailable_bundles:
        bundle_numbers = [b.bundle_number for b in unavailable_bundles]
        raise HTTPException(
            status_code=400,
            detail=f"Bundles already dispatched: {', '.join(bundle_numbers)}"
        )
    
    # Generate DC number
    dc_number = await generate_dc_number(session)
    
    # Calculate total pieces
    total_pieces = sum(item.quantity_sent for item in dc_data.dc_items)
    
    # Generate QR code data
    qr_data = generate_dc_qr_data(dc_number, 0, total_pieces)  # Will update with actual ID
    
    # Create DC
    dc = DeliveryChallan(
        dc_number=dc_number,
        stitching_unit_id=dc_data.stitching_unit_id,
        cutting_lot_id=dc_data.cutting_lot_id,
        dc_date=datetime.utcnow(),
        total_pieces_sent=total_pieces,
        expected_return_date=dc_data.expected_return_date,
        notes=dc_data.notes,
        qr_code_data=qr_data,
        status=DCStatus.OPEN
    )
    
    session.add(dc)
    session.commit()
    session.refresh(dc)
    
    # Update QR code with actual DC ID
    qr_data = generate_dc_qr_data(dc_number, dc.id, total_pieces)
    dc.qr_code_data = qr_data
    
    # Generate QR code image
    try:
        qr_info = f"DC: {dc_number}\nUnit: {unit.name}\nPieces: {total_pieces}"
        qr_path = await create_qr_with_info(qr_data, qr_info, f"dc_{dc.id}")
        dc.qr_code_path = qr_path
    except Exception as e:
        print(f"Error generating QR code: {e}")
    
    # Create DC items
    for item_data in dc_data.dc_items:
        dc_item = DCItem(
            dc_id=dc.id,
            bundle_id=item_data.bundle_id,
            quantity_sent=item_data.quantity_sent
        )
        session.add(dc_item)
    
    # Update bundle status to dispatched
    for bundle in bundles:
        bundle.status = BundleStatus.DISPATCHED
        session.add(bundle)
    
    session.commit()
    session.refresh(dc)
    
    return dc

@router.get("/delivery-challans/", response_model=List[DeliveryChallanResponse])
def get_delivery_challans(
    status: Optional[DCStatus] = None,
    unit_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session)
):
    """Get list of delivery challans with filters"""
    
    statement = select(DeliveryChallan)
    
    if status:
        statement = statement.where(DeliveryChallan.status == status)
    
    if unit_id:
        statement = statement.where(DeliveryChallan.stitching_unit_id == unit_id)
    
    statement = statement.offset(skip).limit(limit).order_by(DeliveryChallan.dc_date.desc())
    
    dcs = session.exec(statement).all()
    return dcs

@router.get("/delivery-challans/{dc_id}", response_model=DeliveryChallanResponse)
def get_delivery_challan(dc_id: int, session: Session = Depends(get_session)):
    """Get specific delivery challan with items"""
    
    dc = session.get(DeliveryChallan, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    # Load DC items
    dc_items = session.exec(select(DCItem).where(DCItem.dc_id == dc_id)).all()
    dc.dc_items = dc_items
    
    return dc

@router.put("/delivery-challans/{dc_id}", response_model=DeliveryChallanResponse)
def update_delivery_challan(
    dc_id: int,
    dc_update: DeliveryChallanUpdate,
    session: Session = Depends(get_session)
):
    """Update delivery challan"""
    
    dc = session.get(DeliveryChallan, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    dc_data = dc_update.dict(exclude_unset=True)
    for field, value in dc_data.items():
        setattr(dc, field, value)
    
    dc.updated_at = datetime.utcnow()
    session.add(dc)
    session.commit()
    session.refresh(dc)
    
    return dc

@router.get("/delivery-challans/{dc_id}/items/")
def get_dc_items(dc_id: int, session: Session = Depends(get_session)):
    """Get items for a specific delivery challan"""
    
    # Verify DC exists
    dc = session.get(DeliveryChallan, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    # Get items with bundle details
    statement = (
        select(DCItem, Bundle)
        .join(Bundle, DCItem.bundle_id == Bundle.id)
        .where(DCItem.dc_id == dc_id)
    )
    
    results = session.exec(statement).all()
    
    items = []
    for dc_item, bundle in results:
        items.append({
            "id": dc_item.id,
            "bundle_id": bundle.id,
            "bundle_number": bundle.bundle_number,
            "quantity_sent": dc_item.quantity_sent,
            "quantity_returned": dc_item.quantity_returned,
            "quantity_ok": dc_item.quantity_ok,
            "quantity_rejected": dc_item.quantity_rejected,
            "panel_type": bundle.panel_type,
            "created_at": dc_item.created_at
        })
    
    return items

@router.get("/product-details/", response_model=List[dict])
def readonly_product_details(session: Session = Depends(get_session)):
    """Read-only access to product details for stitching; no writes here."""
    items = session.exec(select(ProductDetail)).all()
    return [
        {
            "id": it.id,
            "category": it.category,
            "sub_category": it.sub_category,
            "style_no": it.style_no,
            "all_colors": it.all_colors,
            "all_sizes": it.all_sizes,
            "cut_parts": it.cut_parts,
            "cut_cost": it.cut_cost,
            "print_cost": it.print_cost,
            "stitch_cost": it.stitch_cost,
            "iron_cost": it.iron_cost,
        }
        for it in items
    ]

@router.get("/stats/dashboard/")
def get_stitching_dashboard(session: Session = Depends(get_session)):
    """Get stitching dashboard statistics"""
    
    # DC counts by status
    open_dcs = len(session.exec(select(DeliveryChallan).where(DeliveryChallan.status == DCStatus.OPEN)).all())
    
    partial_dcs = len(session.exec(select(DeliveryChallan).where(DeliveryChallan.status == DCStatus.PARTIAL)).all())
    
    hold_dcs = len(session.exec(select(DeliveryChallan).where(DeliveryChallan.status == DCStatus.HOLD)).all())
    
    cleared_dcs = len(session.exec(select(DeliveryChallan).where(DeliveryChallan.status == DCStatus.CLEARED)).all())
    
    # Active stitching units
    active_units = len(session.exec(select(StitchingUnit).where(StitchingUnit.is_active == True)).all())
    
    return {
        "dc_status": {
            "open": open_dcs,
            "partial": partial_dcs,
            "hold": hold_dcs,
            "cleared": cleared_dcs
        },
        "active_units": active_units
    }

async def generate_dc_number(session: Session) -> str:
    """Generate sequential DC number"""
    
    # Get latest DC number
    statement = select(DeliveryChallan).order_by(DeliveryChallan.id.desc()).limit(1)
    latest_dc = session.exec(statement).first()
    
    if latest_dc:
        try:
            last_num = int(latest_dc.dc_number[2:])  # Remove 'DC' prefix
            new_num = last_num + 1
        except (ValueError, IndexError):
            new_num = 1
    else:
        new_num = 1
    
    return f"DC{new_num:04d}"