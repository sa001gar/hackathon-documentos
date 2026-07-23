"""Line-based diff helpers for version comparison."""
import difflib


def line_diff(old: str, new: str) -> list[dict]:
    """Return a list of {type: equal|add|remove, text} entries."""
    old_lines = old.splitlines()
    new_lines = new.splitlines()
    result: list[dict] = []
    for line in difflib.ndiff(old_lines, new_lines):
        if line.startswith("+ "):
            result.append({"type": "add", "text": line[2:]})
        elif line.startswith("- "):
            result.append({"type": "remove", "text": line[2:]})
        elif line.startswith("  "):
            result.append({"type": "equal", "text": line[2:]})
        # "? " hint lines are skipped
    return result
