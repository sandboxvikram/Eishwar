from typing import List, Dict, Tuple
from sqlmodel import Session, select
from backend.app.models.cutting import CuttingLot, Bundle, PanelType, BundleStatus
from backend.app.models.master import Style, Color, Size
from backend.app.schemas.cutting import CuttingProgramRequest, SizeRatio
from backend.app.utils.barcode_generator import generate_barcode
from backend.app.utils.qr_generator import generate_qr_code
from datetime import datetime
import os

class CuttingService:
    def __init__(self, session: Session):
        self.session = session
    
    def generate_lot_number(self) -> str:
        """Generate sequential lot number"""
        # Get the latest lot number
        statement = select(CuttingLot).order_by(CuttingLot.id.desc()).limit(1)
        latest_lot = self.session.exec(statement).first()
        
        if latest_lot:
            # Extract number from lot number (assuming format like LOT001, LOT002)
            try:
                last_num = int(latest_lot.lot_number[3:])  # Remove 'LOT' prefix
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1
        
        return f"LOT{new_num:03d}"
    
    def generate_bundle_number(self, lot_number: str, size_name: str, panel_type: str, sequence: int) -> str:
        """Generate bundle number based on lot, size, panel type, and sequence"""
        return f"{lot_number}-{size_name}-{panel_type.upper()}-{sequence:03d}"
    
    def calculate_bundles_from_ratios(
        self, 
        size_ratios: List[SizeRatio], 
        panel_types: List[PanelType], 
        total_lays: int
    ) -> List[Tuple[int, str, PanelType, int]]:  # (size_id, size_name, panel_type, quantity)
        """Calculate individual bundles based on size ratios and panel types"""
        bundles = []
        
        # Calculate total ratio
        total_ratio = sum(ratio.ratio for ratio in size_ratios)
        
        for size_ratio in size_ratios:
            # Calculate pieces for this size across all lays
            pieces_per_size = (size_ratio.ratio * total_lays)
            
            # Create bundles for each panel type
            for panel_type in panel_types:
                if pieces_per_size > 0:
                    bundles.append((
                        size_ratio.size_id,
                        size_ratio.size_name,
                        panel_type,
                        pieces_per_size
                    ))
        
        return bundles
    
    async def create_cutting_program(self, request: CuttingProgramRequest) -> Dict:
        """Create a complete cutting program with lot and bundles"""
        
        # Verify style and color exist
        style = self.session.get(Style, request.style_id)
        color = self.session.get(Color, request.color_id)
        
        if not style or not color:
            raise ValueError("Style or Color not found")
        
        # Generate lot number
        lot_number = self.generate_lot_number()
        
        # Calculate total pieces
        total_pieces = sum(ratio.ratio * request.total_lays for ratio in request.size_ratios) * len(request.panel_types)
        
        # Create cutting lot
        cutting_lot = CuttingLot(
            lot_number=lot_number,
            style_id=request.style_id,
            color_id=request.color_id,
            fabric_lot=request.fabric_lot,
            lay_number=request.lay_number,
            total_pieces=total_pieces,
            cutting_date=datetime.utcnow(),
            created_by=request.created_by,
            notes=request.notes
        )
        
        self.session.add(cutting_lot)
        self.session.commit()
        self.session.refresh(cutting_lot)
        
        # Calculate and create bundles
        bundle_data = self.calculate_bundles_from_ratios(
            request.size_ratios,
            request.panel_types,
            request.total_lays
        )
        
        created_bundles = []
        bundle_sequence = 1
        
        for size_id, size_name, panel_type, quantity in bundle_data:
            bundle_number = self.generate_bundle_number(
                lot_number, size_name, panel_type.value, bundle_sequence
            )
            
            # Generate barcode data
            barcode_data = f"{bundle_number}|{lot_number}|{size_name}|{panel_type.value}|{quantity}"
            
            bundle = Bundle(
                bundle_number=bundle_number,
                cutting_lot_id=cutting_lot.id,
                size_id=size_id,
                panel_type=panel_type,
                quantity=quantity,
                barcode_data=barcode_data,
                status=BundleStatus.CREATED
            )
            
            self.session.add(bundle)
            self.session.commit()
            self.session.refresh(bundle)
            
            # Generate QR code and barcode files
            try:
                qr_path = await generate_qr_code(barcode_data, bundle_number)
                barcode_path = await generate_barcode(barcode_data, bundle_number)
                
                bundle.qr_code_path = qr_path
                bundle.barcode_path = barcode_path
                self.session.add(bundle)
                
            except Exception as e:
                print(f"Error generating codes for bundle {bundle_number}: {e}")
            
            created_bundles.append(bundle)
            bundle_sequence += 1
        
        self.session.commit()
        
        # Create summary
        summary = {}
        for size_id, size_name, panel_type, quantity in bundle_data:
            key = f"{size_name}-{panel_type.value}"
            summary[key] = summary.get(key, 0) + quantity
        
        return {
            "cutting_lot": cutting_lot,
            "bundles": created_bundles,
            "total_bundles": len(created_bundles),
            "total_pieces": total_pieces,
            "summary": summary
        }
    
    def get_bundles_for_stickers(self, bundle_ids: List[int]) -> List[Dict]:
        """Get bundle data for generating bunch stickers"""
        statement = (
            select(Bundle, CuttingLot, Style, Color, Size)
            .join(CuttingLot, Bundle.cutting_lot_id == CuttingLot.id)
            .join(Style, CuttingLot.style_id == Style.id)
            .join(Color, CuttingLot.color_id == Color.id)
            .join(Size, Bundle.size_id == Size.id)
            .where(Bundle.id.in_(bundle_ids))
        )
        
        results = self.session.exec(statement).all()
        
        sticker_data = []
        for bundle, cutting_lot, style, color, size in results:
            sticker_data.append({
                "bundle_id": bundle.id,
                "bundle_number": bundle.bundle_number,
                "style_name": style.name,
                "color_name": color.name,
                "size_name": size.name,
                "panel_type": bundle.panel_type.value,
                "quantity": bundle.quantity,
                "lot_number": cutting_lot.lot_number,
                "barcode_data": bundle.barcode_data,
                "qr_code_url": f"/api/v1/files/qr/{bundle.id}" if bundle.qr_code_path else None,
                "barcode_url": f"/api/v1/files/barcode/{bundle.id}" if bundle.barcode_path else None
            })
        
        return sticker_data