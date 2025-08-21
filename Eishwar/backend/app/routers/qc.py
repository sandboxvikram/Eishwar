from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from sqlalchemy import func
from typing import List, Optional
from backend.app.database import get_session
from backend.app.models.stitching import DeliveryChallan, DCStatus
from backend.app.models.payment import QCRecord, StitchReturn, ReturnType
from backend.app.schemas.stitching import QRScanRequest, QRScanResponse
from backend.app.schemas.payment import StitchReturnCreate, StitchReturnResponse, QCRecordResponse
from backend.app.services.qr_service import QRService
from datetime import datetime

router = APIRouter(prefix="/qc", tags=["Quality Control"])

@router.post("/scan/", response_model=QRScanResponse)
def process_qr_scan(
    scan_request: QRScanRequest,
    session: Session = Depends(get_session)
):
    """Process QR code scan for DC tracking"""
    
    qr_service = QRService(session)
    
    try:
        result = qr_service.process_qr_scan(scan_request)
        return QRScanResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing QR scan: {str(e)}")

@router.get("/delivery-challans/", response_model=List[dict])
def get_dcs_for_qc(
    status: Optional[DCStatus] = None,
    unit_id: Optional[int] = None,
    session: Session = Depends(get_session)
):
    """Get delivery challans for QC dashboard"""
    
    statement = (
        select(DeliveryChallan)
        .join(
            "stitching_units",  # Join table name
            DeliveryChallan.stitching_unit_id == "stitching_units.id"
        )
    )
    
    if status:
        statement = statement.where(DeliveryChallan.status == status)
    
    if unit_id:
        statement = statement.where(DeliveryChallan.stitching_unit_id == unit_id)
    
    statement = statement.order_by(DeliveryChallan.dc_date.desc())
    
    dcs = session.exec(statement).all()
    
    # Get stitching unit details for each DC
    result = []
    for dc in dcs:
        from backend.app.models.stitching import StitchingUnit
        unit = session.get(StitchingUnit, dc.stitching_unit_id)
        
        result.append({
            "id": dc.id,
            "dc_number": dc.dc_number,
            "dc_date": dc.dc_date,
            "status": dc.status,
            "total_pieces_sent": dc.total_pieces_sent,
            "total_pieces_returned": dc.total_pieces_returned,
            "stitching_unit": {
                "id": unit.id,
                "name": unit.name
            } if unit else None,
            "expected_return_date": dc.expected_return_date,
            "actual_return_date": dc.actual_return_date,
            "hold_reason": dc.hold_reason,
            "qr_code_data": dc.qr_code_data
        })
    
    return result

@router.get("/delivery-challans/{dc_id}/history/", response_model=List[QCRecordResponse])
def get_dc_scan_history(dc_id: int, session: Session = Depends(get_session)):
    """Get QC scan history for a specific DC"""
    
    # Verify DC exists
    dc = session.get(DeliveryChallan, dc_id)
    if not dc:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    qr_service = QRService(session)
    history = qr_service.get_dc_scan_history(dc_id)
    
    return [QCRecordResponse(**record) for record in history]

@router.put("/delivery-challans/{dc_id}/status/")
def manual_status_update(
    dc_id: int,
    new_status: DCStatus,
    reason: str,
    updated_by: str = "Manual",
    session: Session = Depends(get_session)
):
    """Manually update DC status (override)"""
    
    qr_service = QRService(session)
    
    success = qr_service.manual_dc_status_update(dc_id, new_status, reason, updated_by)
    
    if not success:
        raise HTTPException(status_code=404, detail="Delivery challan not found")
    
    return {"message": "DC status updated successfully", "new_status": new_status}

@router.post("/stitch-returns/", response_model=StitchReturnResponse)
def create_stitch_return(
    return_data: StitchReturnCreate,
    session: Session = Depends(get_session)
):
    """Record stitch return (OK or reject)"""
    
    # Verify DC and bundle exist
    dc = session.get(DeliveryChallan, return_data.dc_id)
    if not dc:
        raise HTTPException(status_code=400, detail="Delivery challan not found")
    
    from backend.app.models.cutting import Bundle
    bundle = session.get(Bundle, return_data.bundle_id)
    if not bundle:
        raise HTTPException(status_code=400, detail="Bundle not found")
    
    # Create stitch return record
    stitch_return = StitchReturn.from_orm(return_data)
    session.add(stitch_return)
    
    # Update DC item quantities
    from backend.app.models.stitching import DCItem
    dc_item = session.exec(
        select(DCItem).where(
            DCItem.dc_id == return_data.dc_id,
            DCItem.bundle_id == return_data.bundle_id
        )
    ).first()
    
    if dc_item:
        if return_data.return_type == ReturnType.OK:
            dc_item.quantity_ok += return_data.quantity_returned
        else:
            dc_item.quantity_rejected += return_data.quantity_returned
        
        dc_item.quantity_returned += return_data.quantity_returned
        session.add(dc_item)
    
    session.commit()
    session.refresh(stitch_return)
    
    return stitch_return

@router.get("/stitch-returns/", response_model=List[StitchReturnResponse])
def get_stitch_returns(
    dc_id: Optional[int] = None,
    return_type: Optional[ReturnType] = None,
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session)
):
    """Get stitch return records"""
    
    statement = select(StitchReturn)
    
    if dc_id:
        statement = statement.where(StitchReturn.dc_id == dc_id)
    
    if return_type:
        statement = statement.where(StitchReturn.return_type == return_type)
    
    statement = statement.offset(skip).limit(limit).order_by(StitchReturn.return_date.desc())
    
    returns = session.exec(statement).all()
    return returns

@router.get("/stats/summary/")
def get_qc_summary(session: Session = Depends(get_session)):
    """Get QC summary statistics"""
    
    # Total scans today
    from datetime import date
    today = date.today()
    today_scans = len(session.exec(
        select(QCRecord).where(QCRecord.scan_datetime >= datetime.combine(today, datetime.min.time()))
    ).all())
    
    # Match/mismatch stats
    total_matches = len(session.exec(
        select(QCRecord).where(QCRecord.is_match == True)
    ).all())
    
    total_mismatches = len(session.exec(
        select(QCRecord).where(QCRecord.is_match == False)
    ).all())
    
    # Return stats
    ok_returns = len(session.exec(
        select(StitchReturn).where(StitchReturn.return_type == ReturnType.OK)
    ).all())
    
    reject_returns = len(session.exec(
        select(StitchReturn).where(StitchReturn.return_type == ReturnType.REJECT)
    ).all())
    
    return {
        "today_scans": today_scans,
        "scan_accuracy": {
            "matches": total_matches,
            "mismatches": total_mismatches,
            "accuracy_rate": total_matches / (total_matches + total_mismatches) * 100 if (total_matches + total_mismatches) > 0 else 0
        },
        "returns": {
            "ok": ok_returns,
            "reject": reject_returns,
            "reject_rate": reject_returns / (ok_returns + reject_returns) * 100 if (ok_returns + reject_returns) > 0 else 0
        }
    }

@router.get("/delivery-challans/pending/")
def get_pending_dcs(session: Session = Depends(get_session)):
    """Get DCs that need attention (Hold or Partial status)"""
    
    statement = select(DeliveryChallan).where(
        DeliveryChallan.status.in_([DCStatus.HOLD, DCStatus.PARTIAL])
    ).order_by(DeliveryChallan.dc_date.desc())
    
    pending_dcs = session.exec(statement).all()
    
    result = []
    for dc in pending_dcs:
        from backend.app.models.stitching import StitchingUnit
        unit = session.get(StitchingUnit, dc.stitching_unit_id)
        
        result.append({
            "id": dc.id,
            "dc_number": dc.dc_number,
            "status": dc.status,
            "unit_name": unit.name if unit else "Unknown",
            "days_pending": (datetime.utcnow() - dc.dc_date).days,
            "hold_reason": dc.hold_reason,
            "total_pieces_sent": dc.total_pieces_sent,
            "total_pieces_returned": dc.total_pieces_returned
        })
    
    return result