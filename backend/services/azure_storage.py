"""
Azure Blob Storage service.
Handles upload, download, delete, and URL generation for garment images.
"""
import os
from dotenv import load_dotenv
from azure.storage.blob import BlobServiceClient, ContentSettings

load_dotenv()

_connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
_container_name = os.getenv("AZURE_CONTAINER_NAME", "garments")

_client = BlobServiceClient.from_connection_string(_connection_string)
_container = _client.get_container_client(_container_name)


def _mime_for(blob_name: str) -> str:
    ext = blob_name.rsplit(".", 1)[-1].lower()
    return {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "gif": "image/gif",
        "webp": "image/webp", "heic": "image/jpeg",
    }.get(ext, "image/jpeg")


def upload_blob(blob_name: str, data: bytes) -> str:
    """Upload bytes to Azure and return the blob URL."""
    blob = _container.get_blob_client(blob_name)
    blob.upload_blob(
        data,
        overwrite=True,
        content_settings=ContentSettings(content_type=_mime_for(blob_name)),
    )
    return blob.url


def download_blob(blob_name: str) -> bytes:
    """Download blob content as bytes."""
    blob = _container.get_blob_client(blob_name)
    return blob.download_blob().readall()


def delete_blob(blob_name: str) -> None:
    """Delete a blob. Silently ignores if it doesn't exist."""
    try:
        _container.get_blob_client(blob_name).delete_blob()
    except Exception:
        pass


def blob_url(blob_name: str) -> str:
    """Return the public URL for a blob."""
    return _container.get_blob_client(blob_name).url