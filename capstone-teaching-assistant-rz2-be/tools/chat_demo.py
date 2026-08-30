import json
import mimetypes
from typing import Any

import httpx
import streamlit as st

SUPPORTED_UPLOAD_EXTENSIONS = ["txt", "md", "pdf", "docx", "jpg", "jpeg", "png", "webp"]
UPLOAD_TIMEOUT_SECONDS = 300.0


def api_base_url() -> str:
    return st.sidebar.text_input("Backend API", "http://localhost:8000/api/v1").rstrip("/")


def auth_headers(token: str | None) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"} if token else {}


def request_json(method: str, url: str, token: str | None = None, **kwargs: Any) -> dict[str, Any]:
    headers = {**auth_headers(token), **kwargs.pop("headers", {})}
    timeout = kwargs.pop("timeout", 60.0)
    with httpx.Client(timeout=timeout, follow_redirects=False) as client:
        response = client.request(method, url, headers=headers, **kwargs)
    if response.status_code >= 400:
        st.error(response.text)
        response.raise_for_status()
    if not response.content:
        return {}
    return response.json()


def upload_file_payload(uploaded: Any) -> dict[str, tuple[str, bytes, str]]:
    mime_type = (
        getattr(uploaded, "type", None)
        or mimetypes.guess_type(uploaded.name)[0]
        or "application/octet-stream"
    )
    return {"file": (uploaded.name, uploaded.getvalue(), mime_type)}


def merge_attachment_ids(
    draft_files: list[dict[str, str]],
    selected_labels: list[str],
    selectable_files: dict[str, str],
) -> list[str]:
    draft_ids = [file["id"] for file in draft_files]
    library_ids = [selectable_files[label] for label in selected_labels]
    return list(dict.fromkeys([*draft_ids, *library_ids]))


def login(base_url: str, username: str, password: str) -> None:
    response = request_json(
        "POST",
        f"{base_url}/auth/login",
        json={"username": username, "password": password},
    )
    st.session_state["access_token"] = response["access_token"]
    st.session_state["role"] = response["role"]
    st.session_state.pop("conversation_id", None)


def load_conversations(base_url: str, token: str) -> list[dict[str, Any]]:
    return request_json("GET", f"{base_url}/conversations", token=token)["items"]


def load_messages(base_url: str, token: str, conversation_id: str) -> list[dict[str, Any]]:
    return request_json(
        "GET",
        f"{base_url}/conversations/{conversation_id}/messages",
        token=token,
    )["items"]


def load_files(base_url: str, token: str) -> list[dict[str, Any]]:
    return request_json("GET", f"{base_url}/files", token=token, params={"page_size": 100})["items"]


def stream_answer(base_url: str, token: str, stream_url: str, output_placeholder: Any) -> str:
    collected = ""
    with httpx.stream(
        "GET",
        f"{base_url.removesuffix('/api/v1')}{stream_url}",
        headers=auth_headers(token),
        timeout=None,
    ) as response:
        response.raise_for_status()
        event = None
        for raw_line in response.iter_lines():
            if not raw_line:
                event = None
                continue
            if raw_line.startswith("event: "):
                event = raw_line.removeprefix("event: ")
                continue
            if raw_line.startswith("data: ") and event == "token":
                data = json.loads(raw_line.removeprefix("data: "))
                collected += data["delta"]
                output_placeholder.markdown(collected)
            if raw_line.startswith("data: ") and event == "error":
                data = json.loads(raw_line.removeprefix("data: "))
                st.error(data["message"])
    return collected


def main() -> None:
    st.set_page_config(page_title="Capstone TA Chat", layout="wide")
    base_url = api_base_url()
    st.title("Capstone TA Chat")

    with st.sidebar:
        token = st.session_state.get("access_token")
        if token:
            st.caption(f"Signed in as {st.session_state.get('role', 'UNKNOWN')}")
            if st.button("Sign out", use_container_width=True):
                request_json("POST", f"{base_url}/auth/logout", token=token)
                st.session_state.clear()
                st.rerun()
        else:
            username = st.text_input("Username")
            password = st.text_input("Password", type="password")
            if st.button("Sign in", use_container_width=True):
                login(base_url, username, password)
                st.rerun()
            st.stop()

    token = st.session_state["access_token"]
    if st.session_state.get("role") != "SUPERVISOR":
        st.error("Sign in with a Supervisor account to use chat.")
        st.stop()

    conversations = load_conversations(base_url, token)
    if st.sidebar.button("New conversation", use_container_width=True):
        created = request_json(
            "POST",
            f"{base_url}/conversations",
            token=token,
            json={"project_id": None},
        )
        st.session_state["conversation_id"] = created["id"]
        st.rerun()

    if conversations:
        options = {f"{item['title']} ({item['id'][:8]})": item["id"] for item in conversations}
        selected_label = st.sidebar.selectbox("Conversation", list(options))
        selected_id = options[selected_label]
        st.session_state.setdefault("conversation_id", selected_id)
        if st.session_state["conversation_id"] != selected_id:
            st.session_state["conversation_id"] = selected_id
            st.rerun()
    else:
        st.info("Create a conversation to start chatting.")
        return

    conversation_id = st.session_state["conversation_id"]
    drafts = st.session_state.setdefault("draft_files_by_conversation", {})
    draft_files = drafts.setdefault(conversation_id, [])
    upload_generations = st.session_state.setdefault("upload_widget_generations", {})
    upload_generation = upload_generations.setdefault(conversation_id, 0)
    library_generations = st.session_state.setdefault("library_widget_generations", {})
    library_generation = library_generations.setdefault(conversation_id, 0)

    with st.sidebar:
        st.divider()
        uploaded_files = st.file_uploader(
            "Add files to this message",
            type=SUPPORTED_UPLOAD_EXTENSIONS,
            accept_multiple_files=True,
            key=f"draft_upload_{conversation_id}_{upload_generation}",
        )
        if uploaded_files and st.button("Upload and index attachments", use_container_width=True):
            uploaded_any = False
            with st.spinner("Uploading and indexing attachments..."):
                for uploaded in uploaded_files:
                    try:
                        created_file = request_json(
                            "POST",
                            f"{base_url}/files",
                            token=token,
                            files=upload_file_payload(uploaded),
                            timeout=UPLOAD_TIMEOUT_SECONDS,
                        )
                    except httpx.HTTPError:
                        continue
                    if created_file.get("processing_status") != "READY":
                        st.error(f"{uploaded.name} was uploaded but is not ready to attach.")
                        continue
                    draft_files.append(
                        {
                            "id": created_file["id"],
                            "name": created_file["original_filename"],
                        }
                    )
                    uploaded_any = True
            if uploaded_any:
                upload_generations[conversation_id] += 1
                st.rerun()

        if draft_files:
            st.caption("Ready draft attachments")
            for draft_file in list(draft_files):
                name_column, remove_column = st.columns([4, 1])
                name_column.write(draft_file["name"])
                if remove_column.button(
                    "Remove",
                    key=f"remove_draft_{conversation_id}_{draft_file['id']}",
                ):
                    draft_files.remove(draft_file)
                    st.rerun()

        library_files = load_files(base_url, token)
        selectable_files = {
            f"{item['original_filename']} ({item['processing_status']})": item["id"]
            for item in library_files
            if item["processing_status"] == "READY"
        }
        selected_files = st.multiselect(
            "Attach library files",
            list(selectable_files),
            key=f"library_files_{conversation_id}_{library_generation}",
        )

    for message in load_messages(base_url, token, conversation_id):
        role = "assistant" if message["role"] == "ASSISTANT" else "user"
        with st.chat_message(role):
            st.markdown(message["content"] or f"*{message['status']}*")

    prompt = st.chat_input("Ask the teaching assistant")
    if prompt:
        file_ids = merge_attachment_ids(draft_files, selected_files, selectable_files)
        response = request_json(
            "POST",
            f"{base_url}/conversations/{conversation_id}/messages",
            token=token,
            json={"content": prompt, "file_ids": file_ids},
        )
        drafts[conversation_id] = []
        library_generations[conversation_id] += 1
        with st.chat_message("user"):
            st.markdown(prompt)
        with st.chat_message("assistant"):
            placeholder = st.empty()
            stream_answer(base_url, token, response["stream_url"], placeholder)
        st.rerun()


if __name__ == "__main__":
    main()
