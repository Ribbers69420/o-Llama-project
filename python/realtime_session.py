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


class SessionResponse(Protocol):
    session_id: str


class RealtimeSessionsAPI(Protocol):
    """The ``.sessions`` namespace on the realtime client.

    Matches ``openai.OpenAI(api_key=...).beta.realtime.sessions``.
    """

    async def create(
        self,
        *,
        model: str,
        session_duration: int,
        metadata: dict[str, Any],
        configuration: dict[str, Any],
    ) -> SessionResponse: ...


class RealtimeClient(Protocol):
    """Subset of the OpenAI Realtime client used by this module.

    Provided as a Protocol so tests can pass a fake without the SDK installed.
    Pass ``openai.OpenAI(api_key=...).beta.realtime`` directly — it exposes
    ``.sessions.create(...)`` matching ``RealtimeSessionsAPI`` above.
    """

    sessions: RealtimeSessionsAPI


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
            self.response = await self.client.sessions.create(
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
        session, session_id, metrics = await self._build_session()
        self.active_sessions[user_id] = session
        self.session_metrics[session_id] = metrics
        return session_id

    async def renew_session(self, user_id: str) -> str:
        """Renew a user's session atomically.

        The new session is staged off to the side and migration runs against
        it before any active binding is replaced. If migration fails, the
        existing session remains in place and the caller sees the original
        exception — there is no half-renewed state.
        """
        if user_id not in self.active_sessions:
            raise ValueError(f"No active session for user {user_id!r}")
        old_session = self.active_sessions[user_id]

        new_session, new_session_id, new_metrics = await self._build_session()
        try:
            await self._migrate_session_data(old_session, new_session_id)
        except Exception:
            # Migration failed — drop the staged session and let the caller
            # decide whether to retry. The active binding is untouched.
            await self._discard_session(new_session)
            raise

        self.active_sessions[user_id] = new_session
        self.session_metrics[new_session_id] = new_metrics
        return new_session_id

    async def _build_session(self) -> tuple[RealtimeSession, str, SessionMetrics]:
        """Initialize a session without binding it to a user."""
        session = RealtimeSession(client=self.client, model=self.model)
        session_id = await session.initialize()
        now = datetime.now(timezone.utc)
        return session, session_id, SessionMetrics(created_at=now, last_activity=now)

    async def _discard_session(self, session: RealtimeSession) -> None:
        """Release a staged session that won't be bound.

        Hook for SDK-specific cleanup (e.g. closing a websocket, calling
        ``sessions.delete(...)``). The default is a no-op since the base
        Protocol doesn't promise a delete method.
        """
        del session

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
