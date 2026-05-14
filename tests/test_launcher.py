import json
import pytest
from launcher import _read_config, _needs_update


def test_read_config_returns_dict(tmp_path):
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({"github_pat": "abc", "spreadsheet_id": "xyz"}))
    result = _read_config(str(cfg))
    assert result["github_pat"] == "abc"
    assert result["spreadsheet_id"] == "xyz"


def test_read_config_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        _read_config("/nonexistent/config.json")


def test_needs_update_true_when_versions_differ():
    assert _needs_update("v1.0.0", "v1.1.0") is True


def test_needs_update_false_when_same():
    assert _needs_update("v1.1.0", "v1.1.0") is False


def test_needs_update_false_when_no_latest():
    assert _needs_update("v1.0.0", None) is False
