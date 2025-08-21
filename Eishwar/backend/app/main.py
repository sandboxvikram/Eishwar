from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from backend.app.database import create_db_and_tables
from backend.app.routers import master_data, cutting, stitching, qc, payments

# Ensure required directories exist before StaticFiles mount (validated at import time)
os.makedirs("uploads", exist_ok=True)
os.makedirs("qr_codes", exist_ok=True)
os.makedirs("barcodes", exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    create_db_and_tables()
    
    # Create directories for file storage
    os.makedirs("uploads", exist_ok=True)
    os.makedirs("qr_codes", exist_ok=True)
    os.makedirs("barcodes", exist_ok=True)
    
    yield
    # Shutdown (cleanup if needed)

app = FastAPI(
    title="Apparel Manufacturing Workflow Management System",
    description="Complete system for managing apparel manufacturing from cutting through payments",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Explicit ports
    allow_origin_regex=r"http://localhost:517\d",  # Any 517x dev port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for QR codes and barcodes
app.mount("/qr_codes", StaticFiles(directory="qr_codes"), name="qr_codes")
app.mount("/barcodes", StaticFiles(directory="barcodes"), name="barcodes")

# API Routes
api_prefix = "/api/v1"
app.include_router(master_data.router, prefix=api_prefix)
app.include_router(cutting.router, prefix=api_prefix)
app.include_router(stitching.router, prefix=api_prefix)
app.include_router(qc.router, prefix=api_prefix)
app.include_router(payments.router, prefix=api_prefix)

@app.get("/")
async def root():
    return {
        "message": "Apparel Manufacturing Workflow Management System",
        "version": "1.0.0",
        "docs": "/docs",
        "api": "/api/v1"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# File serving endpoints
@app.get("/api/v1/files/qr/{item_id}")
async def serve_qr_code(item_id: int):
    """Serve QR code files"""
    from fastapi.responses import FileResponse
    file_path = f"qr_codes/bundle_{item_id}.png"
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="image/png")
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="QR code not found")

@app.get("/api/v1/files/barcode/{item_id}")
async def serve_barcode(item_id: int):
    """Serve barcode files"""
    from fastapi.responses import FileResponse
    file_path = f"barcodes/bundle_{item_id}.png"
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="image/png")
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Barcode not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)