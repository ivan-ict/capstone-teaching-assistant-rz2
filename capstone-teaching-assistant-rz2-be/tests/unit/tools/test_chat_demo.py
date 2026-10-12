from tools.chat_demo import auth_headers, load_conversations, load_messages


def test_demo_reads_current_assignment_history_without_project_filters(monkeypatch):
    requests = []

    def request(method, url, **kwargs):
        requests.append((method, url, kwargs))
        return {"items": []}

    monkeypatch.setattr("tools.chat_demo.request_json", request)
    assert load_conversations("http://local/api/v1", "token") == []
    assert load_messages("http://local/api/v1", "token", "conversation") == []
    assert requests == [
        ("GET", "http://local/api/v1/conversations", {"token": "token"}),
        ("GET", "http://local/api/v1/conversations/conversation/messages", {"token": "token"}),
    ]
    assert auth_headers("token") == {"Authorization": "Bearer token"}
