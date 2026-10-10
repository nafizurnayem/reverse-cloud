from services.ai.app.estimator.engine import EstimateInput, estimate_project


def test_standard_web_estimate_golden_case():
    result = estimate_project(
        EstimateInput(project_type="web", pages=5, integrations=1, features=("auth", "payments"))
    )

    assert result.as_dict() == {
        "currency": "USD",
        "min_usd": 4680,
        "max_usd": 5490,
        "min_hours": 104,
        "max_hours": 122,
        "timeline_weeks": 5,
        "assumptions": [
            "Estimate excludes third-party subscription fees and taxes.",
            "Final scope is confirmed after a discovery call.",
        ],
    }


def test_simple_automation_without_optional_work():
    result = estimate_project(EstimateInput(project_type="automation", complexity="simple"))

    assert (result.min_hours, result.max_hours, result.min_usd, result.max_usd) == (22, 26, 990, 1170)


def test_unknown_features_use_conservative_discovery_allowance():
    result = estimate_project(EstimateInput(project_type="custom", features=("unknown",)))

    assert result.min_hours == 62
    assert result.max_hours == 73
