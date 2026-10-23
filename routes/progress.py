from datetime import date

from flask import Blueprint, render_template, request, redirect, url_for, session

from database import get_db_connection

progress = Blueprint("progress", __name__)


def get_bmi_category(bmi):
    if bmi < 18.5:
        return "Underweight", "info"
    if bmi < 25:
        return "Normal", "success"
    if bmi < 30:
        return "Overweight", "warning"
    return "Obese", "danger"


@progress.route("/progress", methods=["GET", "POST"])
def progress_page():

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    user_id = session["user_id"]
    error = None

    if request.method == "POST":

        try:
            weight = float(request.form["weight"])
            height = float(request.form["height"])
            log_date = date.fromisoformat(request.form["log_date"])
        except (ValueError, KeyError):
            error = "Please enter a valid weight, height and date."
        else:
            if not 20 <= weight <= 500:
                error = "Weight must be between 20 and 500 kg."
            elif not 100 <= height <= 250:
                error = "Height must be between 100 and 250 cm."
            elif log_date > date.today():
                error = "Date cannot be in the future."

        if not error:
            bmi = round(weight / ((height / 100) ** 2), 1)

            connection = get_db_connection()
            cursor = connection.cursor()

            query = """
                INSERT INTO bmi_logs
                (user_id, weight_kg, height_cm, bmi, log_date)
                VALUES (%s, %s, %s, %s, %s)
            """

            cursor.execute(
                query,
                (user_id, weight, height, bmi, log_date)
            )

            connection.commit()
            cursor.close()
            connection.close()

            return redirect(url_for("progress.progress_page"))

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT id, weight_kg, height_cm, bmi, log_date
        FROM bmi_logs
        WHERE user_id = %s
        ORDER BY log_date ASC, id ASC
    """

    cursor.execute(query, (user_id,))
    logs = cursor.fetchall()

    cursor.close()
    connection.close()

    for log in logs:
        log["weight_kg"] = float(log["weight_kg"])
        log["height_cm"] = float(log["height_cm"])
        log["bmi"] = float(log["bmi"])
        log["category"], log["badge"] = get_bmi_category(log["bmi"])
        log["label"] = log["log_date"].strftime("%b %d, %Y")

    first = logs[0] if logs else None
    latest = logs[-1] if logs else None

    summary = None
    if len(logs) > 1:
        summary = {
            "weight_change": round(latest["weight_kg"] - first["weight_kg"], 1),
            "bmi_change": round(latest["bmi"] - first["bmi"], 1),
            "days": (latest["log_date"] - first["log_date"]).days
        }

    return render_template(
        "progress.html",
        error=error,
        logs=logs,
        history=list(reversed(logs)),
        first=first,
        latest=latest,
        summary=summary,
        today=date.today().isoformat(),
        default_height=latest["height_cm"] if latest else ""
    )


@progress.route("/progress/delete/<int:log_id>", methods=["POST"])
def delete_log(log_id):

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    connection = get_db_connection()
    cursor = connection.cursor()

    query = """
        DELETE FROM bmi_logs
        WHERE id = %s AND user_id = %s
    """

    cursor.execute(query, (log_id, session["user_id"]))

    connection.commit()
    cursor.close()
    connection.close()

    return redirect(url_for("progress.progress_page"))