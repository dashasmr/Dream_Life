from app.services.goals.progress import derive_goal_status


def test_status_completed_when_target_met():
    assert (
        derive_goal_status(
            current=25, target=20, unit="tasks", category="productivity", elapsed_ratio_val=0.5
        )
        == "completed"
    )


def test_status_at_risk_when_behind_pace():
    assert (
        derive_goal_status(
            current=2, target=20, unit="tasks", category="productivity", elapsed_ratio_val=0.5
        )
        == "at_risk"
    )


def test_home_percent_at_risk_when_far_below():
    assert (
        derive_goal_status(
            current=62, target=80, unit="percent", category="home", elapsed_ratio_val=0.5
        )
        == "at_risk"
    )
