import qrcode
from PIL import Image, ImageDraw, ImageFont
import os

async def generate_qr_code(data: str, filename: str) -> str:
    """Generate QR code with data and filename"""
    
    qr_dir = os.getenv("QR_CODE_DIR", "./qr_codes")
    os.makedirs(qr_dir, exist_ok=True)
    
    # Create QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)
    
    # Create image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save file
    filepath = os.path.join(qr_dir, f"{filename}.png")
    img.save(filepath)
    
    return filepath

def generate_dc_qr_data(dc_number: str, dc_id: int, total_pieces: int) -> str:
    """Generate QR data for delivery challan"""
    return f"DC|{dc_number}|{dc_id}|{total_pieces}"

def create_qr_with_info(qr_data: str, info_text: str, filename: str) -> str:
    """Create QR code with additional text information"""
    
    qr_dir = os.getenv("QR_CODE_DIR", "./qr_codes")
    os.makedirs(qr_dir, exist_ok=True)
    
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    qr_img = qr.make_image(fill_color="black", back_color="white")
    
    # Create larger image with text
    img_width = max(qr_img.width, 400)
    img_height = qr_img.height + 100
    
    final_img = Image.new('RGB', (img_width, img_height), 'white')
    
    # Paste QR code
    qr_x = (img_width - qr_img.width) // 2
    final_img.paste(qr_img, (qr_x, 20))
    
    # Add text
    draw = ImageDraw.Draw(final_img)
    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except:
        font = ImageFont.load_default()
    
    # Get text size and center it
    text_width = draw.textlength(info_text, font=font)
    text_x = (img_width - text_width) // 2
    text_y = qr_img.height + 40
    
    draw.text((text_x, text_y), info_text, fill="black", font=font)
    
    # Save file
    filepath = os.path.join(qr_dir, f"{filename}.png")
    final_img.save(filepath)
    
    return filepath