from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import List, Optional
from datetime import datetime, date
from backend.app.database import get_session
from backend.app.models.payment import Payment, PaymentStatus
from backend.app.schemas.payment import (
    PaymentCalculationRequest, PaymentCalculationResponse,
    PaymentCreate, PaymentResponse, PaymentUpdate
)
from backend.app.services.payment_service import PaymentService

router = APIRouter(prefix="/payments", tags=["Payment Management"])

@router.post("/calculate/", response_model=PaymentCalculationResponse)
def calculate_payment(
    request: PaymentCalculationRequest,
    session: Session = Depends(get_session)
):
    """Calculate payment amount for a stitching unit"""
    
    payment_service = PaymentService(session)
    
    try:
        calculation = payment_service.calculate_payment_for_unit(request)
        return PaymentCalculationResponse(**calculation)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating payment: {str(e)}")

@router.post("/", response_model=PaymentResponse)
def create_payment(
    payment_data: PaymentCreate,
    session: Session = Depends(get_session)
):
    """Create a new payment record"""
    
    payment_service = PaymentService(session)
    
    try:
        # First calculate the payment to get accurate data
        calc_request = PaymentCalculationRequest(
            stitching_unit_id=payment_data.stitching_unit_id,
            from_date=payment_data.payment_date.replace(day=1),  # First day of month
            to_date=payment_data.payment_date,
            dc_ids=payment_data.dc_ids
        )
        
        calculation = payment_service.calculate_payment_for_unit(calc_request)
        
        # Create payment with calculated data
        payment_dict = payment_data.dict()
        payment_dict.update({
            "total_pieces": calculation["total_pieces"],
            "rate_per_piece": calculation["rate_per_piece"],
            "gross_amount": calculation["gross_amount"]
        })
        
        payment = payment_service.create_payment(calculation, payment_dict)
        return payment
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating payment: {str(e)}")

@router.get("/", response_model=List[PaymentResponse])
def get_payments(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    unit_id: Optional[int] = None,
    status: Optional[PaymentStatus] = None,
    session: Session = Depends(get_session)
):
    """Get payments with optional filters"""
    
    payment_service = PaymentService(session)
    
    if not from_date:
        from_date = date.today().replace(day=1)  # First day of current month
    if not to_date:
        to_date = date.today()
    
    payments = payment_service.get_payments_by_date_range(
        from_date, to_date, unit_id, status
    )
    
    return payments

@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, session: Session = Depends(get_session)):
    """Get specific payment"""
    
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment

@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    payment_update: PaymentUpdate,
    session: Session = Depends(get_session)
):
    """Update payment (mainly for status changes)"""
    
    payment = session.get(Payment, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    update_data = payment_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(payment, field, value)
    
    payment.updated_at = datetime.utcnow()
    session.add(payment)
    session.commit()
    session.refresh(payment)
    
    return payment

@router.put("/{payment_id}/clear/")
def clear_payment(
    payment_id: int,
    cleared_date: Optional[datetime] = None,
    session: Session = Depends(get_session)
):
    """Mark payment as cleared"""
    
    payment_service = PaymentService(session)
    
    if not cleared_date:
        cleared_date = datetime.utcnow()
    
    success = payment_service.update_payment_status(
        payment_id, PaymentStatus.CLEARED, cleared_date
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    return {"message": "Payment cleared successfully", "cleared_date": cleared_date}

@router.get("/summary/pending/")
def get_pending_payments_summary(session: Session = Depends(get_session)):
    """Get summary of pending payments by unit"""
    
    payment_service = PaymentService(session)
    summary = payment_service.get_pending_payments_summary()
    
    return summary

@router.get("/units/{unit_id}/cleared-dcs/")
def get_unit_cleared_dcs(
    unit_id: int,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    session: Session = Depends(get_session)
):
    """Get cleared DCs for a unit that can be included in payments"""
    
    if not from_date:
        from_date = date.today().replace(day=1)
    if not to_date:
        to_date = date.today()
    
    from backend.app.models.stitching import DeliveryChallan, DCStatus
    from sqlmodel import select, and_
    
    # Get cleared DCs for the unit in the date range
    statement = select(DeliveryChallan).where(
        and_(
            DeliveryChallan.stitching_unit_id == unit_id,
            DeliveryChallan.status == DCStatus.CLEARED,
            DeliveryChallan.actual_return_date >= datetime.combine(from_date, datetime.min.time()),
            DeliveryChallan.actual_return_date <= datetime.combine(to_date, datetime.max.time())
        )
    ).order_by(DeliveryChallan.actual_return_date.desc())
    
    cleared_dcs = session.exec(statement).all()
    
    result = []
    for dc in cleared_dcs:
        # Check if this DC is already included in a payment
        existing_payment = session.exec(
            select(Payment).where(Payment.notes.contains(dc.dc_number))
        ).first()
        
        result.append({
            "id": dc.id,
            "dc_number": dc.dc_number,
            "dc_date": dc.dc_date,
            "actual_return_date": dc.actual_return_date,
            "total_pieces_returned": dc.total_pieces_returned,
            "already_paid": existing_payment is not None,
            "payment_id": existing_payment.id if existing_payment else None
        })
    
    return result

@router.get("/stats/dashboard/")
def get_payment_dashboard(session: Session = Depends(get_session)):
    """Get payment dashboard statistics"""
    
    payment_service = PaymentService(session)
    
    # This month's payments
    today = date.today()
    first_day = today.replace(day=1)
    
    this_month_payments = payment_service.get_payments_by_date_range(first_day, today)
    
    total_amount = sum(p.net_amount for p in this_month_payments)
    pending_amount = sum(p.net_amount for p in this_month_payments if p.status == PaymentStatus.PENDING)
    cleared_amount = sum(p.net_amount for p in this_month_payments if p.status == PaymentStatus.CLEARED)
    
    # Pending payments summary
    pending_summary = payment_service.get_pending_payments_summary()
    
    return {
        "this_month": {
            "total_payments": len(this_month_payments),
            "total_amount": total_amount,
            "pending_amount": pending_amount,
            "cleared_amount": cleared_amount
        },
        "pending_by_unit": pending_summary
    }