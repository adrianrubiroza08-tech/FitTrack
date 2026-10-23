from flask import (
    Blueprint,
    render_template,
    request,
    redirect,
    url_for,
    session,
    current_app
)
from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from database import get_db_connection
from flask import current_app
from flask_mail import Message
from datetime import datetime, timedelta
import secrets

auth = Blueprint("auth", __name__)

@auth.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":

        first_name = request.form["first_name"].strip()
        last_name = request.form["last_name"].strip()
        email = request.form["email"].strip()
        password = request.form["password"]

        if not first_name or not last_name or not email or not password:
            return render_template(
                "register.html",
                error="Please fill in all fields."
            )

        if len(password) < 8:
            return render_template(
                "register.html",
                error="Password must be at least 8 characters."
            )

        if "@" not in email or "." not in email:
            return render_template(
                "register.html",
                error="Please enter valid email address."
            )

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT id
            FROM users
            WHERE email = %s
        """

        cursor.execute(query,(email,))
        existing_user = cursor.fetchone()

        cursor.close()
        connection.close()

        if existing_user:
            return render_template(
                "register.html",
                error="Email is already registered."
            )

        otp = str(secrets.randbelow(900000) + 100000)

        hashed_password = generate_password_hash(password)

        expires_at = datetime.now() + timedelta(minutes=5)

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO pending_registrations
            (first_name, last_name, email, password, otp, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """

        cursor.execute(
            query,
            (
                first_name,
                last_name,
                email,
                hashed_password,
                otp,
                expires_at
            )
        )

        connection.commit()
        cursor.close()
        connection.close()

        mail = current_app.extensions["mail"]
        
        msg = Message(
            subject="Welcome to FitTrack!",
            sender=current_app.config["MAIL_DEFAULT_SENDER"],
            recipients=[email]
        )
        
        msg.body = f"""
        Hello {first_name},
        
        Welcome to FitTrack!
        
        Your email verification code is:

        {otp} 
        
        Thank you,
        FitTrack Team
        """
        
        mail.send(msg)

        session["pending_email"] = email

        return redirect(url_for("auth.verify_otp"))


    return render_template("register.html")


@auth.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "POST":

        email = request.form["email"].strip()
        password = request.form["password"]

        if not email or not password:
            return render_template(
                "login.html",
                error="Please enter your email and password."
            )

        if "@" not in email or "." not in email:
            return render_template(
                "login.html",
                error="Please enter a valid email address."
            )

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT id, first_name, last_name, email, password, role
            FROM users
            WHERE email = %s
        """

        cursor.execute(query,(email,))
        user_data = cursor.fetchone()

        cursor.close()
        connection.close()

        if user_data and check_password_hash(
            user_data["password"],
            password
        ):
            session["user_id"] = user_data["id"]
            session["user_name"] = user_data["first_name"]
            session["user_role"] = user_data["role"]

            return redirect(
                url_for("dashboard.dashboard_page")
            )

        return render_template(
            "login.html",
            error="Invalid email or password."
        )

    return render_template("login.html")


@auth.route("/logout")
def logout():
    session.clear()

    return redirect(url_for("home"))

@auth.route("/verify-otp", methods=["GET", "POST"])
def verify_otp():

    if "pending_email" not in session:
        return redirect(url_for("auth.register"))

    if request.method == "POST":

        entered_otp = request.form["otp"].strip()
        email = session["pending_email"]

        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT *
            FROM pending_registrations
            WHERE email = %s
            ORDER BY id DESC
            LIMIT 1
        """
        cursor.execute(query, (email,))
        pending = cursor.fetchone()

        cursor.close()
        connection.close()

        if not pending:
            return render_template(
                "verify_otp.html",
                error="Registration request not found."
            )

        if datetime.now() > pending["expires_at"]:

            return render_template(
                "verify_otp.html",
                error="This OTP has expired. Please register again."
            )

        if entered_otp != pending["otp"]:

            return render_template(
                "verify_otp.html",
                error="Invalid OTP. Please try again."
            )

        connection = get_db_connection()
        cursor = connection.cursor()

        insert_query = """
            INSERT INTO users
            (first_name, last_name, email, password)
            VALUES (%s, %s, %s, %s)
        """

        cursor.execute(
            insert_query,
            (
                pending["first_name"],
                pending["last_name"],
                pending["email"],
                pending["password"]
            )
        )

        delete_query = """
            DELETE FROM pending_registrations
            WHERE id = %s
        """

        cursor.execute(delete_query, (pending["id"],))

        connection.commit()
        cursor.close()
        connection.close()

        session.pop("pending_email", None)

        mail = current_app.extensions["mail"]

        msg = Message(
            subject="Welcome to FitTrack!",
            sender=current_app.config["MAIL_DEFAULT_SENDER"],
            recipients=[pending["email"]]
        )

        msg.body = f"""
    Hello {pending["first_name"]},

    Your FitTrack account has been successfully verified!

    You can now log in and start tracking your workouts.

    Thank you,
    FitTrack Team
    """

        mail.send(msg)

        return redirect(url_for("auth.login"))

    return render_template("verify_otp.html")