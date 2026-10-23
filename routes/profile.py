from flask import Blueprint, render_template, session, redirect, url_for, request
from database import get_db_connection
from werkzeug.security import check_password_hash, generate_password_hash

profile = Blueprint("profile", __name__)

@profile.route("/profile", methods=["GET", "POST"])
def profile_page():

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    if request.method == "POST":

        first_name = request.form["first_name"]
        last_name = request.form["last_name"]
        email = request.form["email"]

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            UPDATE users
            SET first_name = %s,
                last_name = %s,
                email = %s
            WHERE id = %s
        """
        cursor.execute(
            query,
            (
                first_name,
                last_name,
                email,
                session["user_id"]
            )
        )

        connection.commit()

        cursor.close()
        connection.close()

        session["user_name"] = first_name

        return redirect(url_for("profile.profile_page"))

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT id, first_name, last_name, email
        FROM users
        WHERE id = %s
    """

    cursor.execute(
        query,
        (session["user_id"],)
    )

    user = cursor.fetchone()

    cursor.close()
    connection.close()

    if not user:
        return "User not found", 404

    return render_template(
        "profile.html",
        user=user
    )

@profile.route("/profile/change-password", methods=["GET", "POST"])
def change_password():

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    if request.method == "POST":

        current_password = request.form["current_password"]
        new_password = request.form["new_password"]
        confirm_password = request.form["confirm_password"]

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT password
            FROM users
            WHERE id = %s
        """

        cursor.execute(query, (session["user_id"],))
        user = cursor.fetchone()

        cursor.close()
        connection.close()

        if not user:
            return "User not found.", 404

        if not check_password_hash(
            user["password"],
            current_password
        ):
            return render_template(
                "change_password.html",
                error="Current password is incorrect."
            )

        if new_password != confirm_password:
            return render_template(
                "change_password.html",
                error="New passwords do not match."
            )

        hashed_password = generate_password_hash(new_password)

        connection = get_db_connection()
        cursor = connection.cursor()

        update_query = """
            UPDATE users
            SET password = %s
            WHERE id = %s
      """

        cursor.execute(
            update_query,
            (
                hashed_password,
                session["user_id"]
            )
        )

        connection.commit()

        cursor.close()
        connection.close()

        return redirect(url_for("profile.profile_page"))

    return render_template("change_password.html")