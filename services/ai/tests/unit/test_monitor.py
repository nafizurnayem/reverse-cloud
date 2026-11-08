from services.ai.app.jobs.monitor import alert_band


def test_alert_band_only_crosses_eighty_and_one_hundred_percent():
    assert alert_band(799, 1000) == 0
    assert alert_band(800, 1000) == 80
    assert alert_band(1000, 1000) == 100
