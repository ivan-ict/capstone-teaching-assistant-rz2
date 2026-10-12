import json
from typing import Any

import httpx
import streamlit as st


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

    account = request_json("GET", f"{base_url}/account", token=token)
    semester = account["profile"]["semester"]
    st.sidebar.caption(f"Semester: {semester['name']}")
    archived = semester["deleted_at"] is not None
    if archived:
        st.info("This semester is archived. Conversation history is read-only.")
    elif not semester["ready_file_count"]:
        st.info(
            "Semester documents are unavailable. "
            "Chat can use personal history and general knowledge."
        )
    if st.session_state.get("semester_id") != semester["id"]:
        st.session_state.pop("conversation_id", None)
        st.session_state["semester_id"] = semester["id"]
    conversations = load_conversations(base_url, token)
    if st.sidebar.button("New conversation", use_container_width=True, disabled=archived):
        created = request_json(
            "POST",
            f"{base_url}/conversations",
            token=token,
            json={},
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
    for message in load_messages(base_url, token, conversation_id):
        role = "assistant" if message["role"] == "ASSISTANT" else "user"
        with st.chat_message(role):
            st.markdown(message["content"] or f"*{message['status']}*")

    prompt = st.chat_input("Ask the teaching assistant", disabled=archived)
    if prompt:
        response = request_json(
            "POST",
            f"{base_url}/conversations/{conversation_id}/messages",
            token=token,
            json={"content": prompt},
        )
        with st.chat_message("user"):
            st.markdown(prompt)
        with st.chat_message("assistant"):
            placeholder = st.empty()
            stream_answer(base_url, token, response["stream_url"], placeholder)
        st.rerun()


if __name__ == "__main__":
    main()
