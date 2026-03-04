"""
AI classification service using Anthropic Claude (claude-sonnet-4-6).
Analyzes garment images and returns a rich description + structured attributes.
"""
import base64
import json
import re
import os
from pathlib import Path
from anthropic import AsyncAnthropic
from dotenv import load_dotenv

load_dotenv()

client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

CLASSIFICATION_PROMPT = """You are an expert fashion analyst working for a global design team.
Analyze this garment photo and return a JSON object with two keys:

1. "description": A rich, detailed paragraph (3-5 sentences) describing everything observable about the
   garment — silhouette, construction details, fabric texture, color nuances, styling, and any cultural
   or aesthetic references you can infer.

2. "attributes": An object with these exact keys:
   - garment_type: Primary category (e.g. "Outerwear", "Dress", "Trousers", "Top", "Skirt", "Suit", "Knitwear", "Accessories")
   - style: Aesthetic direction (e.g. "Minimalist", "Avant-garde", "Streetwear", "Classic", "Bohemian", "Romantic", "Workwear")
   - material: Fabric/material description (e.g. "Heavyweight wool", "Silk charmeuse", "Technical nylon")
   - color_palette: Primary color(s) as comma-separated list (e.g. "Camel, Ivory", "Midnight Navy")
   - pattern: Pattern type (e.g. "Solid", "Stripe", "Floral", "Geometric", "Check", "Abstract")
   - season: Most likely target season (e.g. "AW25", "SS26", "Resort", "Year-round")
   - location_context: Inferred market or style origin context (e.g. "European luxury", "Japanese street", "American sportswear")
   - consumer_profile: Target consumer in 2-4 words (e.g. "Young urban professional", "Luxury minimalist")
   - occasion: Primary occasion (e.g. "Daywear", "Evening", "Workwear", "Resort", "Casual", "Sport")
   - trend_notes: A short trend observation or creative note (1-2 sentences)

Return ONLY valid JSON, no markdown, no extra text."""


async def classify_garment(image_path: str) -> dict:
    """
    Read image from disk, send to Claude for classification.
    Returns { description: str, attributes: dict }
    """
    image_data = Path(image_path).read_bytes()
    b64_image = base64.standard_b64encode(image_data).decode("utf-8")

    # Detect media type
    suffix = Path(image_path).suffix.lower()
    media_type_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".gif": "image/gif",
        ".webp": "image/webp", ".heic": "image/jpeg",
    }
    media_type = media_type_map.get(suffix, "image/jpeg")

    message = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64_image,
                        },
                    },
                    {"type": "text", "text": CLASSIFICATION_PROMPT},
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if Claude wraps in them
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    result = json.loads(raw)
    return result
