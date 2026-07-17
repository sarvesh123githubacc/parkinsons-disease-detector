from abc import ABC, abstractmethod
from typing import Any, Dict
import time


class AgentResult:
    """
    Encapsulates the output of an agent execution, including success status,
    result data, timing information, and any error messages.
    """

    def __init__(
        self,
        agent_name: str,
        success: bool,
        data: Dict[str, Any],
        message: str = "",
        duration_ms: float = 0,
    ):
        self.agent_name = agent_name
        self.success = success
        self.data = data
        self.message = message
        self.duration_ms = duration_ms

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to a JSON-compatible dictionary."""
        return {
            "agent": self.agent_name,
            "success": self.success,
            "data": self.data,
            "message": self.message,
            "duration_ms": round(self.duration_ms, 2),
        }


class BaseAgent(ABC):
    """
    Abstract base class for all pipeline agents.

    Subclasses implement `execute()` which receives a shared context dict
    and returns a data dict. The `run()` method wraps execution with
    timing, error handling, and result packaging.
    """

    def __init__(self, name: str):
        self.name = name

    def run(self, context: Dict[str, Any]) -> AgentResult:
        """
        Execute the agent with timing and error handling.

        Args:
            context: Shared pipeline context dictionary.

        Returns:
            AgentResult with success/failure status and data.
        """
        start = time.time()
        try:
            result_data = self.execute(context)
            duration = (time.time() - start) * 1000
            return AgentResult(self.name, True, result_data, "Success", duration)
        except Exception as e:
            duration = (time.time() - start) * 1000
            return AgentResult(self.name, False, {}, str(e), duration)

    @abstractmethod
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Core agent logic. Must be implemented by subclasses.

        Args:
            context: Shared pipeline context dictionary.

        Returns:
            A dict of result data to be merged into the pipeline context.

        Raises:
            Exception: Any exception will be caught by `run()` and
                       converted to a failed AgentResult.
        """
        pass
