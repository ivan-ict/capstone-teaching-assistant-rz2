import asyncio
import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from typing import Protocol

from app.common.config import Settings, get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailMessageData:
    to: str
    subject: str
    text: str
    html: str


class EmailDeliveryError(Exception):
    """Raised when an email could not be handed to the mail server."""


class EmailSender(Protocol):
    async def send(self, message: EmailMessageData) -> None: ...


class SmtpEmailSender:
    """Sends mail through an SMTP server using STARTTLS (e.g. Gmail with an app password)."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def send(self, message: EmailMessageData) -> None:
        await asyncio.to_thread(self._send_sync, message)

    def _build(self, message: EmailMessageData) -> EmailMessage:
        from_email = self.settings.smtp_from_email or self.settings.smtp_username
        email = EmailMessage()
        email["Subject"] = message.subject
        email["From"] = formataddr((self.settings.smtp_from_name, from_email))
        email["To"] = message.to
        email.set_content(message.text)
        email.add_alternative(message.html, subtype="html")
        return email

    def _send_sync(self, message: EmailMessageData) -> None:
        email = self._build(message)
        try:
            with smtplib.SMTP(
                self.settings.smtp_host,
                self.settings.smtp_port,
                timeout=self.settings.smtp_timeout_seconds,
            ) as smtp:
                smtp.starttls(context=ssl.create_default_context())
                smtp.login(self.settings.smtp_username, self.settings.smtp_password)
                smtp.send_message(email)
        except (smtplib.SMTPException, OSError) as exc:
            logger.exception("Failed to send email to %s", message.to)
            raise EmailDeliveryError(str(exc)) from exc


class ConsoleEmailSender:
    """Development sender that writes emails to the application log instead of sending them."""

    async def send(self, message: EmailMessageData) -> None:
        logger.warning(
            "EMAIL_BACKEND=console - email not sent.\nTo: %s\nSubject: %s\n\n%s",
            message.to,
            message.subject,
            message.text,
        )


def get_email_sender() -> EmailSender:
    settings = get_settings()
    if settings.email_backend == "smtp":
        return SmtpEmailSender(settings)
    return ConsoleEmailSender()


def _credentials_email(
    *,
    to: str,
    subject: str,
    intro: str,
    first_name: str,
    username: str,
    password: str,
    login_url: str,
) -> EmailMessageData:
    advice = (
        "For your security, please sign in and change this password from "
        "Profile > Password as soon as possible."
    )
    text = (
        f"Hi {first_name},\n\n"
        f"{intro}\n\n"
        f"Username: {username}\n"
        f"Password: {password}\n\n"
        f"Sign in at: {login_url}\n\n"
        f"{advice}\n\n"
        "If you did not expect this email, please contact your administrator."
    )
    html = (
        f"<p>Hi {escape(first_name)},</p>"
        f"<p>{escape(intro)}</p>"
        "<table style='border-collapse:collapse'>"
        f"<tr><td style='padding:4px 12px 4px 0'><strong>Username</strong></td>"
        f"<td style='font-family:monospace'>{escape(username)}</td></tr>"
        f"<tr><td style='padding:4px 12px 4px 0'><strong>Password</strong></td>"
        f"<td style='font-family:monospace'>{escape(password)}</td></tr>"
        "</table>"
        f"<p><a href='{escape(login_url, quote=True)}'>Sign in</a></p>"
        f"<p>{escape(advice)}</p>"
        "<p style='color:#64748b'>If you did not expect this email, "
        "please contact your administrator.</p>"
    )
    return EmailMessageData(to=to, subject=subject, text=text, html=html)


def build_account_created_email(
    *, to: str, first_name: str, username: str, password: str, login_url: str
) -> EmailMessageData:
    return _credentials_email(
        to=to,
        subject="Your Capstone Teaching Assistant account",
        intro="An account has been created for you on Capstone Teaching Assistant.",
        first_name=first_name,
        username=username,
        password=password,
        login_url=login_url,
    )


def build_password_reset_email(
    *, to: str, first_name: str, username: str, password: str, login_url: str
) -> EmailMessageData:
    return _credentials_email(
        to=to,
        subject="Your Capstone Teaching Assistant password has been reset",
        intro="Your password has been reset. Your previous password no longer works.",
        first_name=first_name,
        username=username,
        password=password,
        login_url=login_url,
    )
