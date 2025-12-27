"""
Storage module for JSON file operations and backup management.
Handles loading, saving, and backup/restore functionality.
"""
import json
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import AppState, BackupInfo, BackupReason


class StorageManager:
    """Manages JSON file storage and backups."""

    def __init__(
        self,
        data_dir: Path = Path("data"),
        state_filename: str = "state.json",
        backups_dirname: str = "backups"
    ):
        self.data_dir = data_dir
        self.state_file = data_dir / state_filename
        self.backups_dir = data_dir / backups_dirname

        # Ensure directories exist
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.backups_dir.mkdir(parents=True, exist_ok=True)

    def load_state(self) -> AppState:
        """
        Load state from JSON file.
        Returns default state if file doesn't exist.
        """
        if not self.state_file.exists():
            return self._create_default_state()

        try:
            with open(self.state_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return AppState.model_validate(data)
        except (json.JSONDecodeError, Exception) as e:
            # If file is corrupted, return default state
            print(f"Warning: Could not load state file: {e}")
            return self._create_default_state()

    def save_state(
        self,
        state: AppState,
        create_backup: bool = True,
        backup_reason: BackupReason = BackupReason.MANUAL_SAVE
    ) -> Optional[BackupInfo]:
        """
        Save state to JSON file.
        Optionally creates a backup before saving.
        Returns backup info if backup was created.
        """
        backup_info = None

        if create_backup and self.state_file.exists():
            backup_info = self._create_backup(backup_reason)
            if backup_info:
                # Add backup to state's backup list
                state.backups.append(backup_info)

        # Save the state
        with open(self.state_file, "w", encoding="utf-8") as f:
            json.dump(
                state.model_dump(mode="json"),
                f,
                ensure_ascii=False,
                indent=2
            )

        return backup_info

    def _create_backup(self, reason: BackupReason = BackupReason.MANUAL_SAVE) -> Optional[BackupInfo]:
        """
        Create a backup snapshot of the current state file.
        Returns BackupInfo or None if no state file exists.
        """
        if not self.state_file.exists():
            return None

        # Generate timestamp-based backup ID and filename
        now = datetime.now()
        timestamp = now.strftime("%Y%m%d_%H%M%S")
        backup_id = f"bkp_{timestamp}"
        backup_filename = f"state_{timestamp}.json"
        backup_path = self.backups_dir / backup_filename

        # Copy current state file to backup
        shutil.copy2(self.state_file, backup_path)

        # Create backup info
        backup_info = BackupInfo(
            id=backup_id,
            created_at_iso=now.isoformat(),
            reason=reason,
            file_path=str(backup_path.relative_to(self.data_dir.parent))
        )

        return backup_info

    def list_backups(self) -> list[BackupInfo]:
        """
        List all available backups from the current state.
        """
        state = self.load_state()
        return state.backups

    def restore_backup(self, backup_id: str) -> tuple[bool, str]:
        """
        Restore state from a backup.
        Creates a pre-restore backup of current state first.
        Returns (success, message).
        """
        # Find the backup in current state
        state = self.load_state()
        backup_info = None
        for backup in state.backups:
            if backup.id == backup_id:
                backup_info = backup
                break

        if not backup_info:
            return False, f"Backup '{backup_id}' not found"

        # Construct backup file path
        backup_path = self.data_dir.parent / backup_info.file_path

        if not backup_path.exists():
            return False, f"Backup file not found: {backup_info.file_path}"

        # Create a pre-restore backup of current state
        if self.state_file.exists():
            self._create_backup(BackupReason.PRE_RESTORE)

        # Load the backup and validate it
        try:
            with open(backup_path, "r", encoding="utf-8") as f:
                backup_data = json.load(f)
            restored_state = AppState.model_validate(backup_data)
        except Exception as e:
            return False, f"Failed to parse backup: {e}"

        # Preserve the current backup list (add any new backups)
        current_backup_ids = {b.id for b in state.backups}
        for backup in restored_state.backups:
            if backup.id not in current_backup_ids:
                state.backups.append(backup)
        restored_state.backups = state.backups

        # Save the restored state without creating another backup
        self.save_state(restored_state, create_backup=False)

        return True, f"Restored from backup {backup_id}"

    def get_backup_by_id(self, backup_id: str) -> Optional[BackupInfo]:
        """Get a specific backup by ID."""
        state = self.load_state()
        for backup in state.backups:
            if backup.id == backup_id:
                return backup
        return None

    def _create_default_state(self) -> AppState:
        """Create a default empty state."""
        return AppState()


# Global storage instance (can be overridden for testing)
_storage: Optional[StorageManager] = None


def get_storage() -> StorageManager:
    """Get the global storage manager instance."""
    global _storage
    if _storage is None:
        # Default path relative to backend directory
        _storage = StorageManager(data_dir=Path(__file__).parent.parent.parent / "data")
    return _storage


def set_storage(storage: StorageManager) -> None:
    """Set a custom storage manager (for testing)."""
    global _storage
    _storage = storage
