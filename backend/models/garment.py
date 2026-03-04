from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from .database import Base


class Garment(Base):
    __tablename__ = "garments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    original_filename: Mapped[str] = mapped_column(String(255))

    # AI-generated rich description (full paragraph)
    ai_description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Structured AI attributes
    garment_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    style: Mapped[str | None] = mapped_column(String(100), nullable=True)
    material: Mapped[str | None] = mapped_column(String(200), nullable=True)
    color_palette: Mapped[str | None] = mapped_column(String(200), nullable=True)
    pattern: Mapped[str | None] = mapped_column(String(100), nullable=True)
    season: Mapped[str | None] = mapped_column(String(50), nullable=True)
    location_context: Mapped[str | None] = mapped_column(String(200), nullable=True)
    consumer_profile: Mapped[str | None] = mapped_column(String(200), nullable=True)
    occasion: Mapped[str | None] = mapped_column(String(100), nullable=True)
    trend_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # User metadata provided at upload
    upload_season: Mapped[str | None] = mapped_column(String(50), nullable=True)
    upload_location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    upload_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Designer custom annotation (added post-upload)
    custom_annotation: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Processing state
    is_classified: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
