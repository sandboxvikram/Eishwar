from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlmodel import Session, select
from sqlalchemy import func
from typing import List, Optional
from backend.app.database import get_session
from backend.app.models.cutting import CuttingLot, Bundle, CuttingPlan, CuttingPlanStatus
from backend.app.schemas.cutting import (
    CuttingLotCreate, CuttingLotResponse,
    BundleResponse, CuttingProgramRequest, CuttingProgramResponse, BunchStickerData,
    BunchStickerRequest, BunchStickerResponse,
    CuttingPlanCreate, CuttingPlanResponse, SizeRatioItem, SizePcsItem
)
from backend.app.services.cutting_service import CuttingService
import csv
import io
from datetime import datetime
from collections import defaultdict

router = APIRouter(prefix="/cutting", tags=["Cutting Program"])

@router.post("/program/", response_model=CuttingProgramResponse)
async def create_cutting_program(
    request: CuttingProgramRequest,
    session: Session = Depends(get_session)
):
    """Create a complete cutting program with lot and bundles"""
    
    cutting_service = CuttingService(session)
    
    try:
        result = await cutting_service.create_cutting_program(request)
        
        return CuttingProgramResponse(
            cutting_lot=result["cutting_lot"],
            bundles=result["bundles"],
            total_bundles=result["total_bundles"],
            total_pieces=result["total_pieces"],
            summary=result["summary"]
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating cutting program: {str(e)}")

@router.get("/lots/", response_model=List[CuttingLotResponse])
def get_cutting_lots(
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_session)
):
    """Get list of cutting lots"""
    
    statement = select(CuttingLot).offset(skip).limit(limit)
    lots = session.exec(statement).all()
    return lots

@router.get("/lots/{lot_id}", response_model=CuttingLotResponse)
def get_cutting_lot(lot_id: int, session: Session = Depends(get_session)):
    """Get specific cutting lot"""
    
    lot = session.get(CuttingLot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Cutting lot not found")
    return lot

@router.get("/lots/{lot_id}/bundles/", response_model=List[BundleResponse])
def get_lot_bundles(lot_id: int, session: Session = Depends(get_session)):
    """Get all bundles for a specific cutting lot"""
    
    # Verify lot exists
    lot = session.get(CuttingLot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Cutting lot not found")
    
    statement = select(Bundle).where(Bundle.cutting_lot_id == lot_id).order_by(Bundle.bundle_number)
    bundles = session.exec(statement).all()
    return bundles

@router.get("/bundles/{bundle_id}", response_model=BundleResponse)
def get_bundle(bundle_id: int, session: Session = Depends(get_session)):
    """Get specific bundle"""
    
    bundle = session.get(Bundle, bundle_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Bundle not found")
    return bundle

@router.post("/bunch-stickers/", response_model=BunchStickerResponse)
def generate_bunch_stickers(
    request: BunchStickerRequest,
    session: Session = Depends(get_session)
):
    """Generate bunch sticker data for selected bundles"""
    
    cutting_service = CuttingService(session)
    
    try:
        sticker_data = cutting_service.get_bundles_for_stickers(request.bundle_ids)
        
        # Map to typed response objects for stricter type checking
        typed_stickers = []
        for s in sticker_data:
            typed_stickers.append(
                BunchStickerData(
                    bundle_id=int(s.get("bundle_id", 0) or 0),
                    bundle_number=str(s.get("bundle_number", "") or ""),
                    style_name=str(s.get("style_name", "") or ""),
                    color_name=str(s.get("color_name", "") or ""),
                    size_name=str(s.get("size_name", "") or ""),
                    panel_type=str(s.get("panel_type", "") or ""),
                    quantity=int(s.get("quantity", 0) or 0),
                    lot_number=str(s.get("lot_number", "") or ""),
                    barcode_data=str(s.get("barcode_data", "") or ""),
                    qr_code_url=str(s.get("qr_code_url", "") or ""),
                    barcode_url=str(s.get("barcode_url", "") or ""),
                )
            )

        return BunchStickerResponse(
            stickers=typed_stickers,
            total_stickers=len(typed_stickers)
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating stickers: {str(e)}")

@router.get("/bundles/search/")
def search_bundles(
    lot_number: Optional[str] = None,
    bundle_number: Optional[str] = None,
    status: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """Search bundles by various criteria"""
    
    statement = select(Bundle)
    
    if bundle_number:
        statement = statement.where(Bundle.bundle_number == bundle_number)
    
    if status:
        statement = statement.where(Bundle.status == status)
    
    if lot_number:
        # Join with CuttingLot to search by lot number
        statement = statement.join(CuttingLot).where(CuttingLot.lot_number == lot_number)
    
    bundles = session.exec(statement.limit(50)).all()
    return bundles

@router.get("/stats/summary/")
def get_cutting_summary(session: Session = Depends(get_session)):
    """Get cutting program summary statistics"""
    
    # Total lots
    total_lots = len(session.exec(select(CuttingLot)).all())
    
    # Total bundles by status
    from backend.app.models.cutting import BundleStatus
    created_bundles = len(session.exec(select(Bundle).where(Bundle.status == BundleStatus.CREATED)).all())
    
    dispatched_bundles = len(session.exec(select(Bundle).where(Bundle.status == BundleStatus.DISPATCHED)).all())
    
    returned_bundles = len(session.exec(select(Bundle).where(Bundle.status == BundleStatus.RETURNED)).all())
    
    return {
        "total_lots": total_lots,
        "bundle_status": {
            "created": created_bundles,
            "dispatched": dispatched_bundles,
            "returned": returned_bundles
        }
    }


# Cutting Plans (Yet-to-Cut)
@router.get("/plans/template", response_class=Response)
def download_cutting_plan_template(category: str, session: Session = Depends(get_session)):
    """Generate CSV template for a category with rows based on Product Details.
    For each ProductDetail record of the selected category, emit a block for each color
    and list sizes on subsequent rows. Only 'total pcs' and 'Required ratio' are meant
    to be filled by the user.
    """
    from backend.app.models.master import ProductDetail

    # Fetch Product Details for the given category
    pds = session.exec(
        select(ProductDetail).where(ProductDetail.category == category)
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Category", "sub_category", "style_no", "color", "total pcs", "sizes", "Required ratio"])

    # Helper to split comma-separated fields safely
    def split_csv(val: str | None) -> list[str]:
        if not val:
            return []
        return [v.strip() for v in val.split(",") if v.strip()]

    wrote_any = False
    for pd in pds:
        colors = split_csv(pd.all_colors)
        sizes = split_csv(pd.all_sizes)

        # Default sub-category for night set categories
        default_subcat = "top" if (pd.category or "").lower() in ("night set", "m. night set") else ""

        for color_name in colors or [""]:
            writer.writerow([
                pd.category or category,
                (pd.sub_category or default_subcat),
                pd.style_no or "",
                color_name,
                "",
                "",
                "",
            ])

            for size_name in sizes:
                writer.writerow(["", "", "", "", "", size_name, ""])  # one row per size

            writer.writerow([])  # blank line between blocks
            wrote_any = True

    # If no product details found, still return the header-only CSV
    csv_bytes = output.getvalue().encode("utf-8")
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="cutting_plan_template_{category}.csv"'
        },
    )


@router.post("/plans/upload", response_model=List[CuttingPlanResponse])
def upload_cutting_plan(category: str, file: UploadFile = File(...), session: Session = Depends(get_session)):
    """Upload a CSV filled from the template. Creates CuttingPlan rows with computed per-size pcs.
    The CSV format is blocks: first row has style_no, color, total pcs; following rows list sizes with required ratio.
    """
    from backend.app.models.master import Category as MCategory, Style, Color, Size, ProductDetail
    content = file.file.read().decode('utf-8')
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    # Skip header
    i = 1
    created: List[CuttingPlan] = []

    def next_ct_number() -> str:
        count = len(session.exec(select(CuttingPlan)).all()) + 1
        return f"CT{count:04d}"

    while i < len(rows):
        row = rows[i]
        i += 1
        if not any(row):
            continue
        # Header block row
        cat = row[0] or category
        sub_cat = row[1] if len(row) > 1 else None
        style_no = row[2]
        color_name = row[3]
        total_pcs_str = row[4]
        if not style_no or not color_name:
            continue
        # Parse total pieces early and skip this block entirely if non-positive
        try:
            header_total = int(total_pcs_str)
        except Exception:
            header_total = 0
        if header_total <= 0:
            # Fast-forward through size lines until a blank row to skip this block
            while i < len(rows) and rows[i] and (rows[i][5] or (len(rows[i]) > 6 and rows[i][6] != "")):
                i += 1
            # Skip any trailing blank lines separating blocks
            while i < len(rows) and not any(rows[i]):
                i += 1
            continue
        # Try to resolve using existing master tables; otherwise create from Product Details
        style = session.exec(select(Style).where(Style.code == style_no)).first()
        if not style:
            # Get/create category in legacy tables
            db_cat = session.exec(select(MCategory).where(MCategory.name == cat)).first()
            if not db_cat:
                db_cat = MCategory(name=cat)
                session.add(db_cat)
                session.commit()
                session.refresh(db_cat)
            style = Style(name=style_no, code=style_no, category_id=int(db_cat.id or 0))
            session.add(style)
            session.commit()
            session.refresh(style)

        color = session.exec(select(Color).where(Color.style_id == style.id, Color.name == color_name)).first()
        if not color:
            color = Color(name=color_name, code=color_name, style_id=int(style.id or 0))
            session.add(color)
            session.commit()
            session.refresh(color)

        # Ensure sizes exist for this color, using Product Details sizes if available
        pd = session.exec(
            select(ProductDetail).where(ProductDetail.style_no == style_no)
        ).first()
        pd_sizes = []
        if pd and pd.all_sizes:
            pd_sizes = [s.strip() for s in pd.all_sizes.split(',') if s.strip()]

        # Existing sizes
        existing_sizes = session.exec(select(Size).where(Size.color_id == color.id)).all()
        existing_by_name = {s.name: s for s in existing_sizes}
        # Create missing ones in the order from Product Details, else keep any found in CSV
        order = 0
        for sname in pd_sizes:
            if sname not in existing_by_name:
                sz = Size(name=sname, code=sname, color_id=int(color.id or 0), sort_order=order)
                session.add(sz)
                session.commit()
                session.refresh(sz)
                existing_by_name[sname] = sz
            order += 1
        sizes = list(existing_by_name.values())

        # Collect size ratios until blank row
        size_ratios = []
        while i < len(rows) and rows[i] and (rows[i][5] or (len(rows[i]) > 6 and rows[i][6] != "")):
            sname = rows[i][5]
            ratio_str = rows[i][6] if len(rows[i]) > 6 else ''
            try:
                ratio = float(ratio_str) if ratio_str else 0
            except ValueError:
                ratio = 0
            size = next((s for s in sizes if s.name == sname), None)
            if size is None:
                # If not found, create it to preserve the CSV-provided size
                new_sz = Size(name=sname, code=sname, color_id=int(color.id or 0), sort_order=len(sizes))
                session.add(new_sz)
                session.commit()
                session.refresh(new_sz)
                sizes.append(new_sz)
                size = new_sz
            # Include even if ratio is 0 so it shows as 0 pcs
            size_ratios.append({"size_id": int(size.id or 0), "size_name": size.name, "ratio": float(ratio)})
            i += 1
        # compute pieces per size using formula: round(total / sum(ratios) * per_size_ratio)
        try:
            total_pcs = int(total_pcs_str)
        except Exception:
            total_pcs = 0
        ratio_sum = sum(sr["ratio"] for sr in size_ratios) or 1
        size_pcs = []
        assigned = 0
        for idx, sr in enumerate(size_ratios):
            pcs = int(round(total_pcs * (sr["ratio"] / ratio_sum)))
            assigned += pcs
            if idx == len(size_ratios) - 1 and assigned != total_pcs:
                pcs += (total_pcs - assigned)
            size_pcs.append({"size_id": sr["size_id"], "size_name": sr["size_name"], "pcs": max(pcs, 0)})

        plan = CuttingPlan(
            ct_number=next_ct_number(),
            category=cat,
            sub_category=sub_cat,
            style_id=int(style.id or 0),
            style_code=style.code,
            color_id=int(color.id or 0),
            color_name=color.name,
            total_pcs=total_pcs,
            size_ratios={"items": size_ratios},
            size_pcs={"items": size_pcs},
            status=CuttingPlanStatus.PENDING,
            created_at=datetime.utcnow()
        )
        session.add(plan)
        created.append(plan)
        # skip potential blank
        while i < len(rows) and not any(rows[i]):
            i += 1

    session.commit()
    # Ensure IDs and computed fields are loaded
    for p in created:
        session.refresh(p)

    # Return as responses
    result: List[CuttingPlanResponse] = []
    for p in created:
        result.append(CuttingPlanResponse(
            id=int(p.id or 0),
            ct_number=p.ct_number,
            category=p.category,
            sub_category=p.sub_category,
            style_id=p.style_id,
            style_code=p.style_code,
            color_id=p.color_id,
            color_name=p.color_name,
            total_pcs=p.total_pcs,
            size_ratios=[SizeRatioItem(size_id=it["size_id"], size_name=it["size_name"], ratio=it["ratio"]) for it in p.size_ratios.get("items", [])],
            size_pcs=[SizePcsItem(size_id=it["size_id"], size_name=it["size_name"], pcs=it["pcs"]) for it in p.size_pcs.get("items", [])],
            status=p.status,
            created_at=p.created_at,
            updated_at=p.updated_at,
        ))
    return result


@router.get("/plans/pending", response_model=List[CuttingPlanResponse])
def list_pending_plans(session: Session = Depends(get_session)):
    plans = session.exec(
        select(CuttingPlan).where(
            CuttingPlan.status == CuttingPlanStatus.PENDING,
            CuttingPlan.total_pcs > 0
        )
    ).all()
    res: List[CuttingPlanResponse] = []
    for p in plans:
        res.append(CuttingPlanResponse(
            id=int(p.id or 0),
            ct_number=p.ct_number,
            category=p.category,
            sub_category=p.sub_category,
            style_id=p.style_id,
            style_code=p.style_code,
            color_id=p.color_id,
            color_name=p.color_name,
            total_pcs=p.total_pcs,
            size_ratios=[SizeRatioItem(size_id=it["size_id"], size_name=it["size_name"], ratio=it["ratio"]) for it in p.size_ratios.get("items", [])],
            size_pcs=[SizePcsItem(size_id=it["size_id"], size_name=it["size_name"], pcs=it["pcs"]) for it in p.size_pcs.get("items", [])],
            status=p.status,
            created_at=p.created_at,
            updated_at=p.updated_at,
        ))
    return res


@router.post("/plans/{plan_id}/start", response_model=CuttingPlanResponse)
def start_plan(plan_id: int, session: Session = Depends(get_session)):
    plan = session.get(CuttingPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.status = CuttingPlanStatus.STARTED
    plan.updated_at = datetime.utcnow()
    session.add(plan)
    session.commit()
    session.refresh(plan)
    return CuttingPlanResponse(
        id=int(plan.id or 0),
        ct_number=plan.ct_number,
        category=plan.category,
        sub_category=plan.sub_category,
        style_id=plan.style_id,
        style_code=plan.style_code,
        color_id=plan.color_id,
        color_name=plan.color_name,
        total_pcs=plan.total_pcs,
        size_ratios=[SizeRatioItem(size_id=it["size_id"], size_name=it["size_name"], ratio=it["ratio"]) for it in plan.size_ratios.get("items", [])],
        size_pcs=[SizePcsItem(size_id=it["size_id"], size_name=it["size_name"], pcs=it["pcs"]) for it in plan.size_pcs.get("items", [])],
        status=plan.status,
        created_at=plan.created_at,
        updated_at=plan.updated_at,
    )