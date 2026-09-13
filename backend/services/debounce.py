from collections import defaultdict, deque
from typing import Dict, Deque, Optional, Tuple

class DebounceTracker:
    """
    Implements 2-of-3 temporal debounce validation.
    Suppresses single-frame noise and confirms real hazards before incident creation.
    """
    def __init__(self, window_size: int = 3, threshold: int = 2):
        self.window_size = window_size
        self.threshold = threshold
        # Key: (camera_id, incident_type) -> Deque of booleans (detected or not)
        self.history: Dict[Tuple[str, str], Deque[bool]] = defaultdict(lambda: deque(maxlen=window_size))
        # Tracks already triggered alerts to avoid spamming duplicate incidents within same clip
        self.triggered: set[Tuple[str, str]] = set()

    def update(self, camera_id: str, incident_type: str, detected: bool) -> bool:
        """
        Records detection state for current frame.
        Returns True if signal satisfies 2-of-3 rule AND has not yet been triggered for this stream.
        """
        key = (camera_id, incident_type)
        dq = self.history[key]
        dq.append(detected)

        # Count occurrences in the current sliding window
        true_count = sum(1 for v in dq if v)

        if true_count >= self.threshold:
            if key not in self.triggered:
                self.triggered.add(key)
                return True

        return False

    def reset(self):
        self.history.clear()
        self.triggered.clear()
