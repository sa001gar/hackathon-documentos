"""AI Specialists Registry: 20 specialized agents with prompts, capabilities, and tools.

Every specialist has:
- System prompt
- Capabilities
- Tools
- Memory access
- Context requirements
- Responsibilities
"""
from typing import Any

from app.ai.specialists.registry import (
    get_specialist,
    get_specialist_names,
    list_specialists,
    register_specialist,
    SpecialistDefinition,
)

__all__ = [
    "SpecialistDefinition",
    "register_specialist",
    "get_specialist",
    "get_specialist_names",
    "list_specialists",
]
