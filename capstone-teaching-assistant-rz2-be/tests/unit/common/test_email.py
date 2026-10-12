import smtplib
from unittest.mock import MagicMock, patch

import pytest

from app.common.config import Settings
from app.common.email import (
    ConsoleEmailSender,
    EmailDeliveryError,
    SmtpEmailSender,
    build_account_created_email,
    build_password_reset_email,
    get_email_sender,
)
from app.common.security import generate_password


def smtp_settings() -> Settings:
    return Settings(
        _env_file=None,
        email_backend="smtp",
        smtp_username="sender@gmail.com",
        smtp_password="abcdefghijklmnop",
    )


def sample_message():
    return build_account_created_email(
        to="user@example.edu.au",
        first_name="Ada <b>",
        username="ada",
        password="Secret#123abc",
        login_url="http://localhost:3000",
    )


def test_generate_password_meets_policy() -> None:
    passwords = {generate_password() for _ in range(50)}

    assert len(passwords) == 50
    for password in passwords:
        assert len(password) == 14
        assert any(c.islower() for c in password)
        assert any(c.isupper() for c in password)
        assert any(c.isdigit() for c in password)
        assert any(not c.isalnum() for c in password)
        assert not set(password) & set("0O1lI")


def test_generate_password_rejects_too_short_length() -> None:
    with pytest.raises(ValueError):
        generate_password(3)


def test_email_templates_include_credentials_and_escape_html() -> None:
    created = sample_message()
    reset = build_password_reset_email(
        to="user@example.edu.au",
        first_name="Ada",
        username="ada",
        password="Secret#123abc",
        login_url="http://localhost:3000",
    )

    for message in (created, reset):
        assert "Username: ada" in message.text
        assert "Password: Secret#123abc" in message.text
        assert "http://localhost:3000" in message.text
    assert "Ada &lt;b&gt;" in created.html
    assert "reset" in reset.subject.lower()


def test_smtp_settings_require_credentials() -> None:
    with pytest.raises(ValueError):
        Settings(email_backend="smtp", smtp_username="", smtp_password="")


def test_get_email_sender_uses_configured_backend() -> None:
    with patch("app.common.email.get_settings", return_value=smtp_settings()):
        assert isinstance(get_email_sender(), SmtpEmailSender)
    with patch("app.common.email.get_settings", return_value=Settings(email_backend="console")):
        assert isinstance(get_email_sender(), ConsoleEmailSender)


@pytest.mark.asyncio
async def test_smtp_sender_uses_starttls_and_login() -> None:
    smtp = MagicMock()
    with patch("app.common.email.smtplib.SMTP") as smtp_class:
        smtp_class.return_value.__enter__.return_value = smtp
        await SmtpEmailSender(smtp_settings()).send(sample_message())

    smtp_class.assert_called_once_with("smtp.gmail.com", 587, timeout=15)
    smtp.starttls.assert_called_once()
    smtp.login.assert_called_once_with("sender@gmail.com", "abcdefghijklmnop")
    sent = smtp.send_message.call_args.args[0]
    assert sent["To"] == "user@example.edu.au"
    assert "sender@gmail.com" in sent["From"]


@pytest.mark.asyncio
async def test_smtp_sender_wraps_delivery_errors() -> None:
    smtp = MagicMock()
    smtp.login.side_effect = smtplib.SMTPAuthenticationError(535, b"bad credentials")
    with patch("app.common.email.smtplib.SMTP") as smtp_class:
        smtp_class.return_value.__enter__.return_value = smtp
        with pytest.raises(EmailDeliveryError):
            await SmtpEmailSender(smtp_settings()).send(sample_message())
