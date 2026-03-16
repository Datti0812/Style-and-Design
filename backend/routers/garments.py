"""
Garment routes:
  POST /garments/upload      — upload image(s), trigger async classification
  GET  /garments             — list/search/filter garments
  GET  /garments/{id}        — get single garment
  PATCH /garments/{id}       — update custom annotation
  DELETE /garments/{id}      — delete garment
  GET  /garments/filters     — return distinct values for each filter dimension
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from models import Garment, get_db
from services import classify_garment
from services.azure_storage import upload_blob, download_blob, delete_blob

router = APIRouter(prefix="/garments", tags=["garments"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


# ─── Pydantic Schemas ────────────────────────────

class GarmentOut(BaseModel):
    id: int
    filename: str
    original_filename: str
    ai_description: Optional[str]
    garment_type: Optional[str]
    style: Optional[str]
    material: Optional[str]
    color_palette: Optional[str]
    pattern: Optional[str]
    season: Optional[str]
    location_context: Optional[str]
    consumer_profile: Optional[str]
    occasion: Optional[str]
    trend_notes: Optional[str]
    upload_season: Optional[str]
    upload_location: Optional[str]
    upload_note: Optional[str]
    custom_annotation: Optional[str]
    is_classified: bool
    image_url: str

    model_config = {"from_attributes": True}


class AnnotationUpdate(BaseModel):
    custom_annotation: str


class FilterOptions(BaseModel):
    garment_type: list[str]
    style: list[str]
    material: list[str]
    color_palette: list[str]
    pattern: list[str]
    season: list[str]
    location_context: list[str]
    occasion: list[str]


# ─── Helpers ────────────────────────────────────

def garment_to_out(g: Garment, base_url: str = "") -> GarmentOut:
    d = {c.name: getattr(g, c.name) for c in g.__table__.columns}
    d["image_url"] = f"{base_url}/api/garments/{g.id}/image"
    return GarmentOut(**d)


async def run_classification(garment_id: int, blob_name: str):
    """Background task: classify image with Claude and update DB."""
    print(f"[classifier] Starting classification for garment {garment_id}, blob={blob_name}")
    from models.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        garment = await session.get(Garment, garment_id)
        if not garment:
            print(f"[classifier] Garment {garment_id} not found in DB")
            return
        try:
            print(f"[classifier] Calling Claude API for garment {garment_id}...")
            result = await classify_garment(blob_name)
            print(f"[classifier] Claude response received for garment {garment_id}")
            attrs = result.get("attributes", {})
            garment.ai_description = result.get("description", "")
            garment.garment_type    = attrs.get("garment_type")
            garment.style           = attrs.get("style")
            garment.material        = attrs.get("material")
            garment.color_palette   = attrs.get("color_palette")
            garment.pattern         = attrs.get("pattern")
            garment.season          = attrs.get("season") or garment.upload_season
            garment.location_context = attrs.get("location_context") or garment.upload_location
            garment.consumer_profile = attrs.get("consumer_profile")
            garment.occasion        = attrs.get("occasion")
            garment.trend_notes     = attrs.get("trend_notes")
            garment.is_classified   = True
            await session.commit()
            print(f"[classifier] Garment {garment_id} classified and saved successfully")
        except Exception as e:
            import traceback
            print(f"[classifier] Error classifying garment {garment_id}: {e}")
            print(traceback.format_exc())


# ─── Routes ─────────────────────────────────────

@router.post("/upload", response_model=list[GarmentOut], status_code=201)
async def upload_garments(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    upload_season: Optional[str] = Form(None),
    upload_location: Optional[str] = Form(None),
    upload_note: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    if not files:
        raise HTTPException(400, "No files provided")

    created = []
    for file in files:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(400, f"Unsupported file type: {ext}")

        safe_name = f"{uuid.uuid4().hex}{ext}"

        # Read and upload to Azure Blob Storage
        file_bytes = await file.read()
        upload_blob(safe_name, file_bytes)

        garment = Garment(
            filename=safe_name,
            original_filename=file.filename,
            upload_season=upload_season,
            upload_location=upload_location,
            upload_note=upload_note,
            is_classified=False,
        )
        db.add(garment)
        await db.flush()  # get id before commit
        background_tasks.add_task(run_classification, garment.id, safe_name)
        created.append(garment)

    await db.commit()
    for g in created:
        await db.refresh(g)

    return [garment_to_out(g) for g in created]


@router.get("", response_model=list[GarmentOut])
async def list_garments(
    q: Optional[str] = Query(None, description="Full-text search against description"),
    garment_type: Optional[str] = Query(None),
    style: Optional[str] = Query(None),
    season: Optional[str] = Query(None),
    occasion: Optional[str] = Query(None),
    color_palette: Optional[str] = Query(None),
    location_context: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Garment)

    if q:
        term = f"%{q}%"
        stmt = stmt.where(
            or_(
                Garment.ai_description.ilike(term),
                Garment.trend_notes.ilike(term),
                Garment.upload_note.ilike(term),
                Garment.custom_annotation.ilike(term),
            )
        )
    if garment_type:
        stmt = stmt.where(Garment.garment_type.ilike(f"%{garment_type}%"))
    if style:
        stmt = stmt.where(Garment.style.ilike(f"%{style}%"))
    if season:
        stmt = stmt.where(
            or_(Garment.season.ilike(f"%{season}%"), Garment.upload_season.ilike(f"%{season}%"))
        )
    if occasion:
        stmt = stmt.where(Garment.occasion.ilike(f"%{occasion}%"))
    if color_palette:
        stmt = stmt.where(Garment.color_palette.ilike(f"%{color_palette}%"))
    if location_context:
        stmt = stmt.where(
            or_(
                Garment.location_context.ilike(f"%{location_context}%"),
                Garment.upload_location.ilike(f"%{location_context}%"),
            )
        )

    stmt = stmt.order_by(Garment.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    garments = result.scalars().all()
    return [garment_to_out(g) for g in garments]


@router.get("/filters", response_model=FilterOptions)
async def get_filter_options(db: AsyncSession = Depends(get_db)):
    """Return distinct non-null values for each filterable dimension."""

    async def distinct_values(col):
        result = await db.execute(select(col).where(col.isnot(None)).distinct())
        vals = [r[0] for r in result.fetchall() if r[0]]
        # Some values are comma-separated (e.g. color_palette); split + dedupe
        expanded = set()
        for v in vals:
            for part in v.split(","):
                part = part.strip()
                if part:
                    expanded.add(part)
        return sorted(expanded)

    return FilterOptions(
        garment_type=await distinct_values(Garment.garment_type),
        style=await distinct_values(Garment.style),
        material=await distinct_values(Garment.material),
        color_palette=await distinct_values(Garment.color_palette),
        pattern=await distinct_values(Garment.pattern),
        season=await distinct_values(Garment.season),
        location_context=await distinct_values(Garment.location_context),
        occasion=await distinct_values(Garment.occasion),
    )


@router.get("/{garment_id}", response_model=GarmentOut)
async def get_garment(garment_id: int, db: AsyncSession = Depends(get_db)):
    garment = await db.get(Garment, garment_id)
    if not garment:
        raise HTTPException(404, "Garment not found")
    return garment_to_out(garment)


@router.get("/{garment_id}/image")
async def get_garment_image(garment_id: int, db: AsyncSession = Depends(get_db)):
    garment = await db.get(Garment, garment_id)
    if not garment:
        raise HTTPException(404, "Garment not found")
    try:
        image_bytes = download_blob(garment.filename)
    except Exception:
        raise HTTPException(404, "Image not found in storage")
    ext = garment.filename.rsplit(".", 1)[-1].lower()
    media_type = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
                  "gif": "image/gif", "webp": "image/webp"}.get(ext, "image/jpeg")
    return Response(content=image_bytes, media_type=media_type)


@router.patch("/{garment_id}/annotation", response_model=GarmentOut)
async def update_annotation(
    garment_id: int,
    body: AnnotationUpdate,
    db: AsyncSession = Depends(get_db),
):
    garment = await db.get(Garment, garment_id)
    if not garment:
        raise HTTPException(404, "Garment not found")
    garment.custom_annotation = body.custom_annotation
    await db.commit()
    await db.refresh(garment)
    return garment_to_out(garment)


@router.delete("/{garment_id}", status_code=204)
async def delete_garment(garment_id: int, db: AsyncSession = Depends(get_db)):
    garment = await db.get(Garment, garment_id)
    if not garment:
        raise HTTPException(404, "Garment not found")
    delete_blob(garment.filename)
    await db.delete(garment)
    await db.commit()
