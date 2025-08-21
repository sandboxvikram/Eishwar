from typing import Optional, Dict, List
from sqlmodel import Session, select
from backend.app.models.stitching import DeliveryChallan, DCStatus
from backend.app.models.payment import QCRecord
from backend.app.schemas.stitching import QRScanRequest
from datetime import datetime
import json

class QRService:
    def __init__(self, session: Session):
        self.session = session
    
    def decode_qr_data(self, qr_data: str) -> Optional[Dict]:
        """Decode QR code data to extract DC information"""
        try:
            # QR data format: "DC|{dc_number}|{dc_id}|{expected_pieces}"
            parts = qr_data.split("|")
            if len(parts) >= 4 and parts[0] == "DC":
                return {
                    "dc_number": parts[1],
                    "dc_id": int(parts[2]),
                    "expected_pieces": int(parts[3])
                }
        except (ValueError, IndexError):
            pass
        return None
    
    def process_qr_scan(self, scan_request: QRScanRequest) -> Dict:
        """Process QR code scan and update DC status"""
        
        # Decode QR data
        qr_info = self.decode_qr_data(scan_request.qr_code_data)
        if not qr_info:
            return {
                "success": False,
                "message": "Invalid QR code format",
                "expected_quantity": 0,
                "scanned_quantity": scan_request.scanned_quantity,
                "is_match": False,
                "variance": 0
            }
        
        # Get DC from database
        dc = self.session.get(DeliveryChallan, qr_info["dc_id"])
        if not dc:
            return {
                "success": False,
                "message": "Delivery Challan not found",
                "expected_quantity": 0,
                "scanned_quantity": scan_request.scanned_quantity,
                "is_match": False,
                "variance": 0
            }
        
        expected_quantity = qr_info["expected_pieces"]
        scanned_quantity = scan_request.scanned_quantity
        is_match = expected_quantity == scanned_quantity
        variance = scanned_quantity - expected_quantity
        
        # Create QC record
        qc_record = QCRecord(
            dc_id=dc.id,
            scan_type=scan_request.scan_type,
            scan_datetime=datetime.utcnow(),
            scanned_quantity=scanned_quantity,
            expected_quantity=expected_quantity,
            is_match=is_match,
            variance=variance,
            scanner_name=scan_request.scanner_name,
            notes=scan_request.notes
        )
        
        self.session.add(qc_record)
        
        # Update DC status based on scan results
        new_status = self._calculate_dc_status(dc, scan_request.scan_type, is_match, scanned_quantity)
        
        if new_status != dc.status:
            dc.status = new_status
            if scan_request.scan_type == "inbound":
                dc.total_pieces_returned = scanned_quantity
                dc.actual_return_date = datetime.utcnow()
            
            self.session.add(dc)
        
        self.session.commit()
        
        return {
            "success": True,
            "message": "QR scan processed successfully",
            "dc_id": dc.id,
            "expected_quantity": expected_quantity,
            "scanned_quantity": scanned_quantity,
            "is_match": is_match,
            "variance": variance,
            "new_status": new_status
        }
    
    def _calculate_dc_status(
        self, 
        dc: DeliveryChallan, 
        scan_type: str, 
        is_match: bool, 
        scanned_quantity: int
    ) -> DCStatus:
        """Calculate new DC status based on scan results"""
        
        if scan_type == "outbound":
            # Outbound scan - DC is being dispatched
            if is_match:
                return DCStatus.OPEN
            else:
                return DCStatus.HOLD
        
        elif scan_type == "inbound":
            # Inbound scan - DC is returning
            if is_match:
                return DCStatus.CLEARED
            elif scanned_quantity > 0:
                return DCStatus.PARTIAL
            else:
                return DCStatus.HOLD
        
        return dc.status  # No change
    
    def get_dc_scan_history(self, dc_id: int) -> List[Dict]:
        """Get scan history for a specific DC"""
        statement = select(QCRecord).where(QCRecord.dc_id == dc_id).order_by(QCRecord.scan_datetime.desc())
        records = self.session.exec(statement).all()
        
        return [
            {
                "id": record.id,
                "scan_type": record.scan_type,
                "scan_datetime": record.scan_datetime,
                "scanned_quantity": record.scanned_quantity,
                "expected_quantity": record.expected_quantity,
                "is_match": record.is_match,
                "variance": record.variance,
                "scanner_name": record.scanner_name,
                "notes": record.notes
            }
            for record in records
        ]
    
    def manual_dc_status_update(self, dc_id: int, new_status: DCStatus, reason: str, updated_by: str) -> bool:
        """Manually update DC status with reason"""
        dc = self.session.get(DeliveryChallan, dc_id)
        if not dc:
            return False
        
        dc.status = new_status
        if new_status == DCStatus.HOLD:
            dc.hold_reason = reason
        
        # Create a manual QC record for audit trail
        qc_record = QCRecord(
            dc_id=dc.id,
            scan_type="manual",
            scan_datetime=datetime.utcnow(),
            scanned_quantity=dc.total_pieces_sent,  # Use original quantity
            expected_quantity=dc.total_pieces_sent,
            is_match=True,
            variance=0,
            scanner_name=updated_by,
            notes=f"Manual status update: {reason}"
        )
        
        self.session.add(qc_record)
        self.session.add(dc)
        self.session.commit()
        
        return True