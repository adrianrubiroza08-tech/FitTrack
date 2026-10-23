from datetime import date, datetime

from flask import Blueprint, render_template, session, redirect, url_for

from database import get_db_connection
from models.workout import Workout
from routes.progress import get_bmi_category


dashboard = Blueprint("dashboard", __name__)


@dashboard.route("/dashboard")
def dashboard_page():
    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    user_id = session["user_id"]

    # Get the user's workouts
    workouts = Workout.get_by_user(user_id)
    total_workouts = len(workouts)
    recent_workouts = workouts[:5]

    # Get the user's latest BMI record
    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            id,
            weight_kg,
            height_cm,
            bmi,
            log_date
        FROM bmi_logs
        WHERE user_id = %s
        ORDER BY log_date DESC, id DESC
        LIMIT 1
        """,
        (user_id,)
    )

    latest = cursor.fetchone()

    cursor.close()
    connection.close()

    bmi_data = None

    if latest:
        bmi_value = float(latest["bmi"])
        height_cm = float(latest["height_cm"])
        weight_kg = float(latest["weight_kg"])
        height_m = height_cm / 100

        category, _ = get_bmi_category(bmi_value)

        # MySQL normally returns a date object, but this also
        # handles a string date safely.
        raw_log_date = latest["log_date"]

        if isinstance(raw_log_date, (date, datetime)):
            formatted_date = raw_log_date.strftime("%b %d, %Y")
        else:
            try:
                formatted_date = datetime.fromisoformat(
                    str(raw_log_date)
                ).strftime("%b %d, %Y")
            except ValueError:
                formatted_date = str(raw_log_date)

        bmi_data = {
            "value": bmi_value,
            "category": category,
            "weight": weight_kg,
            "height": height_cm,
            "date": formatted_date,
            "pin": max(
                0,
                min(100, (bmi_value - 15) / 25 * 100)
            ),
            "healthy_low": round(18.5 * height_m ** 2, 1),
            "healthy_high": round(24.9 * height_m ** 2, 1)
        }

    return render_template(
        "dashboard.html",
        user_name=session.get("user_name", ""),
        total_workouts=total_workouts,
        recent_workouts=recent_workouts,
        bmi=bmi_data,
        today=date.today().isoformat()
    )
