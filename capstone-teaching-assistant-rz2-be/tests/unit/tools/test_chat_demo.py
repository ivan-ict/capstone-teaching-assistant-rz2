from dataclasses import dataclass

from tools.chat_demo import merge_attachment_ids, upload_file_payload


@dataclass
class FakeUpload:
    name: str
    content: bytes
    type: str | None

    def getvalue(self) -> bytes:
        return self.content


def test_upload_payload_preserves_mime_type_for_backend_format_validation() -> None:
    uploaded = FakeUpload("diagram.png", b"png bytes", "image/png")

    assert upload_file_payload(uploaded) == {
        "file": ("diagram.png", b"png bytes", "image/png")
    }


def test_upload_payload_infers_mime_type_when_browser_does_not_supply_one() -> None:
    uploaded = FakeUpload("rubric.pdf", b"pdf bytes", None)

    assert upload_file_payload(uploaded) == {
        "file": ("rubric.pdf", b"pdf bytes", "application/pdf")
    }


def test_message_uses_ready_draft_and_library_ids_without_uploading_again() -> None:
    draft_files = [{"id": "draft-file", "name": "diagram.png"}]
    selectable_files = {"Handbook.pdf (READY)": "library-file"}

    assert merge_attachment_ids(
        draft_files,
        ["Handbook.pdf (READY)"],
        selectable_files,
    ) == ["draft-file", "library-file"]
