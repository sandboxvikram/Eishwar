from typing import List, Dict, Optional
from sqlmodel import Session, select, and_, or_
from backend.app.models.stitching import DeliveryChallan, DCStatus, StitchingUnit, DCItem
from backend.app.models.payment import Payment, PaymentStatus, StitchReturn, ReturnType
from backend.app.schemas.payment import PaymentCalculationRequest, DCForPayment
from datetime import datetime, date

class PaymentService:
    def __init__(self, session: Session):
        self.session = session
    
    def calculate_payment_for_unit(self, request: PaymentCalculationRequest) -> Dict:
        """Calculate payment amount for a stitching unit"""
        
        # Get stitching unit
        unit = self.session.get(StitchingUnit, request.stitching_unit_id)
        if not unit:
            raise ValueError("Stitching unit not found")
        
        # Build query for cleared DCs in date range
        query_conditions = [
            DeliveryChallan.stitching_unit_id == request.stitching_unit_id,
            DeliveryChallan.status == DCStatus.CLEARED,
            DeliveryChallan.actual_return_date >= request.from_date,
            DeliveryChallan.actual_return_date <= request.to_date
        ]
        
        # If specific DC IDs provided, filter by them
        if request.dc_ids:
            query_conditions.append(DeliveryChallan.id.in_(request.dc_ids))
        
        statement = select(DeliveryChallan).where(and_(*query_conditions))
        cleared_dcs = self.session.exec(statement).all()
        
        dc_list = []
        total_pieces = 0
        total_ok_pieces = 0
        gross_amount = 0
        
        for dc in cleared_dcs:
            # Get OK pieces for this DC (excluding rejected pieces)
            ok_pieces = self._calculate_ok_pieces(dc.id)
            dc_amount = ok_pieces * unit.rate_per_piece
            
            dc_data = DCForPayment(
                dc_id=dc.id,
                dc_number=dc.dc_number,
                stitching_unit_id=dc.stitching_unit_id,
                total_pieces_returned=dc.total_pieces_returned,
                total_ok_pieces=ok_pieces,
                rate_per_piece=unit.rate_per_piece,
                amount=dc_amount
            )
            
            dc_list.append(dc_data)
            total_pieces += dc.total_pieces_returned
            total_ok_pieces += ok_pieces
            gross_amount += dc_amount
        
        # Calculate suggested deductions (e.g., for rejected pieces)
        suggested_deduction = self._calculate_suggested_deductions(request.stitching_unit_id, cleared_dcs)
        net_amount = gross_amount - suggested_deduction
        
        return {
            "stitching_unit_id": unit.id,
            "unit_name": unit.name,
            "total_pieces": total_pieces,
            "rate_per_piece": unit.rate_per_piece,
            "gross_amount": gross_amount,
            "suggested_deduction": suggested_deduction,
            "net_amount": net_amount,
            "dc_list": dc_list
        }
    
    def _calculate_ok_pieces(self, dc_id: int) -> int:
        """Calculate OK pieces for a DC (excluding rejected pieces)"""
        
        # Get total returned pieces
        dc = self.session.get(DeliveryChallan, dc_id)
        if not dc:
            return 0
        
        total_returned = dc.total_pieces_returned
        
        # Get total rejected pieces for this DC
        statement = select(StitchReturn).where(
            and_(
                StitchReturn.dc_id == dc_id,
                StitchReturn.return_type == ReturnType.REJECT
            )
        )
        reject_returns = self.session.exec(statement).all()
        total_rejected = sum(ret.quantity_returned for ret in reject_returns)
        
        return max(0, total_returned - total_rejected)
    
    def _calculate_suggested_deductions(self, unit_id: int, dcs: List[DeliveryChallan]) -> float:
        """Calculate suggested deductions for rejected pieces, delays, etc."""
        
        deduction = 0.0
        unit = self.session.get(StitchingUnit, unit_id)
        
        if not unit:
            return deduction
        
        dc_ids = [dc.id for dc in dcs]
        
        # Deduction for rejected pieces
        statement = select(StitchReturn).where(
            and_(
                StitchReturn.dc_id.in_(dc_ids),
                StitchReturn.return_type == ReturnType.REJECT
            )
        )
        reject_returns = self.session.exec(statement).all()
        rejected_pieces = sum(ret.quantity_returned for ret in reject_returns)
        deduction += rejected_pieces * unit.rate_per_piece * 0.5  # 50% deduction for rejects
        
        # Additional deductions can be added here (e.g., for delays)
        # ...
        
        return deduction
    
    def generate_payment_number(self) -> str:
        """Generate sequential payment number"""
        statement = select(Payment).order_by(Payment.id.desc()).limit(1)
        latest_payment = self.session.exec(statement).first()
        
        if latest_payment:
            try:
                last_num = int(latest_payment.payment_number[3:])  # Remove 'PAY' prefix
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
        
        return f"PAY{new_num:04d}"
    
    def create_payment(self, calculation_data: Dict, payment_data: Dict) -> Payment:
        """Create a new payment record"""
        
        payment_number = self.generate_payment_number()
        
        payment = Payment(
            payment_number=payment_number,
            stitching_unit_id=calculation_data["stitching_unit_id"],
            payment_date=payment_data["payment_date"],
            total_pieces=calculation_data["total_pieces"],
            rate_per_piece=calculation_data["rate_per_piece"],
            gross_amount=calculation_data["gross_amount"],
            deduction_amount=payment_data.get("deduction_amount", calculation_data["suggested_deduction"]),
            net_amount=payment_data["net_amount"],
            payment_method=payment_data["payment_method"],
            reference_number=payment_data.get("reference_number"),
            notes=payment_data.get("notes"),
            created_by=payment_data["created_by"],
            status=PaymentStatus.PENDING
        )
        
        self.session.add(payment)
        self.session.commit()
        self.session.refresh(payment)
        
        return payment
    
    def get_payments_by_date_range(
        self, 
        from_date: date, 
        to_date: date, 
        unit_id: Optional[int] = None,
        status: Optional[PaymentStatus] = None
    ) -> List[Payment]:
        """Get payments within date range with optional filters"""
        
        conditions = [
            Payment.payment_date >= datetime.combine(from_date, datetime.min.time()),
            Payment.payment_date <= datetime.combine(to_date, datetime.max.time())
        ]
        
        if unit_id:
            conditions.append(Payment.stitching_unit_id == unit_id)
        
        if status:
            conditions.append(Payment.status == status)
        
        statement = select(Payment).where(and_(*conditions)).order_by(Payment.payment_date.desc())
        return self.session.exec(statement).all()
    
    def update_payment_status(self, payment_id: int, status: PaymentStatus, cleared_date: Optional[datetime] = None) -> bool:
        """Update payment status"""
        payment = self.session.get(Payment, payment_id)
        if not payment:
            return False
        
        payment.status = status
        if status == PaymentStatus.CLEARED and cleared_date:
            payment.cleared_date = cleared_date
        
        self.session.add(payment)
        self.session.commit()
        
        return True
    
    def get_pending_payments_summary(self) -> Dict:
        """Get summary of pending payments by unit"""
        statement = select(Payment).where(Payment.status == PaymentStatus.PENDING)
        pending_payments = self.session.exec(statement).all()
        
        summary = {}
        for payment in pending_payments:
            unit_id = payment.stitching_unit_id
            if unit_id not in summary:
                unit = self.session.get(StitchingUnit, unit_id)
                summary[unit_id] = {
                    "unit_name": unit.name if unit else "Unknown",
                    "total_amount": 0,
                    "payment_count": 0
                }
            
            summary[unit_id]["total_amount"] += payment.net_amount
            summary[unit_id]["payment_count"] += 1
        
        return summary