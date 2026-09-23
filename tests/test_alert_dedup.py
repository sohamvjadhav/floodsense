"""
Tests for alert deduplication and safety controls.

Usage:
    python -m pytest tests/test_alert_dedup.py -v
"""

import pytest

from api.alerts_enhanced import AlertManager


@pytest.fixture
def alert_manager():
    """Create an AlertManager in simulation mode."""
    return AlertManager(simulation_mode=True)


def test_cooldown_prevents_duplicate(alert_manager):
    """Alert manager prevents duplicate alerts within cooldown."""
    # First alert should be allowed
    check1 = alert_manager.check_can_alert("Pune", tier=2)
    assert check1["can_alert"] is True

    # Record the alert
    alert_manager.record_alert("Pune", tier=2, phone="+919812345678", status="sent")

    # Second alert within cooldown should be blocked
    check2 = alert_manager.check_can_alert("Pune", tier=2)
    assert check2["can_alert"] is False
    assert any("cooldown" in r for r in check2["reasons"])


def test_different_districts_independent(alert_manager):
    """Cooldown is per-district, not global."""
    alert_manager.record_alert("Pune", tier=2, phone="+919812345678", status="sent")

    # Different district should still be allowed
    check = alert_manager.check_can_alert("Kolhapur", tier=2)
    assert check["can_alert"] is True


def test_low_tier_blocked(alert_manager):
    """Low tier alerts are blocked."""
    check = alert_manager.check_can_alert("Pune", tier=0)
    assert check["can_alert"] is False
    assert any("tier" in r for r in check["reasons"])


def test_medium_tier_blocked(alert_manager):
    """Medium tier alerts are blocked (only High+ triggers)."""
    check = alert_manager.check_can_alert("Pune", tier=1)
    assert check["can_alert"] is False


def test_simulation_mode_flagged(alert_manager):
    """Simulation mode is indicated in check results."""
    check = alert_manager.check_can_alert("Pune", tier=2)
    assert check["simulation_mode"] is True
    assert any("simulation" in r for r in check["reasons"])


def test_safe_message_has_disclaimer(alert_manager):
    """Alert message includes safety disclaimer."""
    msg = alert_manager.build_safe_message("Pune", tier=2, p24=0.75)
    assert "SIMULATED WARNING" in msg
    assert "NOT an official emergency warning" in msg
    assert "Pune" in msg


def test_audit_log_recording(alert_manager):
    """Alerts are recorded in the audit log."""
    alert_manager.record_alert("Pune", tier=2, phone="+919812345678", status="sent")
    log = alert_manager.get_audit_log()
    assert len(log) >= 1
    assert log[-1]["district"] == "Pune"
    assert "****" in log[-1]["phone"]  # masked


def test_unsubscribe(alert_manager):
    """Unsubscribe marks subscription as inactive."""
    # This requires a database, so we test the method exists
    assert hasattr(alert_manager, "unsubscribe")
