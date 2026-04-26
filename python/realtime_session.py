"""Canonical, bug-fixed Realtime API session manager.

The original dataset distributed several copies of this code with the following
defects, all corrected here:

  * Undefined ``API_KEY`` referenced inside ``SessionManager.create_session``.
  * ``RealtimeSession.__init__`` accepted ``api_key`` but never used it.
  * ``datetime.utcnow()`` (deprecated in Python 3.12+) replaced with
    ``datetime.now(timezone.utc)``.
  * Inconsistent return type from ``renew_session`` (returned the coroutine
    result in one copy and a session id in another).
  * Mismatched ``_migrate_session_data`` signature across copies.
  * Use of the legacy ``openai.RealtimeSession.create`` global. The current
    SDK uses an instance: ``client.beta.realtime.sessions.create(...)``.
    Calls are wrapped behind a thin protocol so the module is testable
    without the SDK installed.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol


logger = logging.getLogger(__name__)


class RealtimeClient(Protocol):
    """Subset of the OpenAI Realtime client used by this module.

    Provided as a Protocol so tests can pass a fake without the SDK installed.
    The real implementation is ``openai.OpenAI(api_key=...).beta.realtime``.
    """

    async def create_session(
        self,
        *,
        model: str,
        session_duration: int,
        metadata: dict[str, Any],
        configuration: dict[str, Any],
    ) -> "SessionResponse": ...


class SessionResponse(Protocol):
    session_id: str


@dataclass
class SessionMetrics:
    created_at: datetime
    last_activity: datetime
    message_count: int = 0


@dataclass
class RealtimeSession:
    """A single Realtime API session bound to one user.

    The ``client`` is injected so callers control SDK construction, model
    selection, and retry behavior. ``api_key`` is intentionally not stored
    here; it belongs on the client.
    """

    client: RealtimeClient
    model: str = "gpt-4o-realtime-preview"
    session_duration: int = 3600
    response: SessionResponse | None = None

    async def initialize(self) -> str:
        try:
            self.response = await self.client.create_session(
                model=self.model,
                session_duration=self.session_duration,
                metadata=self._metadata(),
                configuration=self._configuration(),
            )
        except Exception:
            logger.exception("Realtime session initialization failed")
            raise
        return self.response.session_id

    @staticmethod
    def _metadata() -> dict[str, Any]:
        return {
            "client_version": "1.0.0",
            "initialization_time": datetime.now(timezone.utc).isoformat(),
            "session_type": "interactive",
        }

    @staticmethod
    def _configuration() -> dict[str, Any]:
        return {
            "response_format": "streaming",
            "temperature": 0.7,
            "max_tokens": 2048,
        }


@dataclass
class SessionManager:
    """Tracks active sessions and per-session metrics."""

    client: RealtimeClient
    model: str = "gpt-4o-realtime-preview"
    active_sessions: dict[str, RealtimeSession] = field(default_factory=dict)
    session_metrics: dict[str, SessionMetrics] = field(default_factory=dict)

    async def create_session(self, user_id: str) -> str:
        session = RealtimeSession(client=self.client, model=self.model)
        session_id = await session.initialize()
        self.active_sessions[user_id] = session
        now = datetime.now(timezone.utc)
        self.session_metrics[session_id] = SessionMetrics(created_at=now, last_activity=now)
        return session_id

    async def renew_session(self, user_id: str) -> str:
        if user_id not in self.active_sessions:
            raise ValueError(f"No active session for user {user_id!r}")
        old_session = self.active_sessions[user_id]
        new_session_id = await self.create_session(user_id)
        await self._migrate_session_data(old_session, new_session_id)
        return new_session_id

    async def _migrate_session_data(
        self,
        old_session: RealtimeSession,
        new_session_id: str,
    ) -> None:
        """Carry conversation context from an expiring session to a new one.

        Hook for downstream context migration; left as a no-op so subclasses
        can implement domain-specific transfer (vector store handoff,
        transcript replay, etc.) without changing the public API.
        """
        del old_session, new_session_id

    def touch(self, session_id: str) -> None:
        metrics = self.session_metrics.get(session_id)
        if metrics is None:
            return
        metrics.last_activity = datetime.now(timezone.utc)
        metrics.message_count += 1
