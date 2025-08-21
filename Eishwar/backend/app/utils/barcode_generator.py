import os
from barcode import Code128
from barcode.writer import ImageWriter
from io import BytesIO
from PIL import Image
import qrcode

async def generate_barcode(data: str, filename: str) -> str:
    """Generate barcode image and return file path"""
    
    # Create barcode directory if it doesn't exist
    barcode_dir = os.getenv("BARCODE_DIR", "./barcodes")
    os.makedirs(barcode_dir, exist_ok=True)
    
    # Generate barcode
    code = Code128(data, writer=ImageWriter())
    
    # Save to file
    filepath = os.path.join(barcode_dir, f"{filename}.png")
    code.save(filepath)
    
    return filepath

async def generate_qr_code(data: str, filename: str) -> str:
    """Generate QR code image and return file path"""
    
    # Create QR code directory if it doesn't exist
    qr_dir = os.getenv("QR_CODE_DIR", "./qr_codes")
    os.makedirs(qr_dir, exist_ok=True)
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save to file
    filepath = os.path.join(qr_dir, f"{filename}.png")
    img.save(filepath)
    
    return filepath

def create_bunch_sticker_image(sticker_data: dict) -> str:
    """Create a complete bunch sticker image with all information"""
    
    # This would create a formatted sticker image with:
    # - Bundle information
    # - QR code
    # - Barcode
    # - Style, color, size details
    
    # For now, return the QR code path
    # In production, you'd create a composite image with all elements
    
    return sticker_data.get("qr_code_path", "")