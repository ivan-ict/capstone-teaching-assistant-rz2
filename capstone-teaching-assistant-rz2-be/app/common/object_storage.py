from collections.abc import Mapping

import boto3
from botocore.client import BaseClient

from app.common.config import Settings


class ObjectStorageClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._client: BaseClient = boto3.client(
            "s3",
            endpoint_url=settings.rustfs_endpoint_url,
            aws_access_key_id=settings.rustfs_access_key,
            aws_secret_access_key=settings.rustfs_secret_key,
        )

    def upload_bytes(
        self,
        storage_path: str,
        content: bytes,
        content_type: str,
        metadata: Mapping[str, str] | None = None,
    ) -> None:
        self._client.put_object(
            Bucket=self.settings.rustfs_bucket_name,
            Key=storage_path,
            Body=content,
            ContentType=content_type,
            Metadata=dict(metadata or {}),
        )

    def delete_object(self, storage_path: str) -> None:
        self._client.delete_object(Bucket=self.settings.rustfs_bucket_name, Key=storage_path)

    def presigned_download_url(self, storage_path: str, expires_in_seconds: int = 3600) -> str:
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.settings.rustfs_bucket_name, "Key": storage_path},
            ExpiresIn=expires_in_seconds,
        )
