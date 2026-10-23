from flask import Blueprint, render_template, request, redirect, url_for, session
from urllib.parse import quote_plus

from database import get_db_connection
from models.workout import Workout
from models.exercise import Exercise

workout = Blueprint("workout", __name__)

@workout.route("/workouts")
def workouts():

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    user_id = session["user_id"]

    workouts = Workout.get_by_user(user_id)

    return render_template(
        "workout.html",
        workouts=workouts
    )

@workout.route("/workout/create", methods=["GET", "POST"])
def create_workout():

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    source = request.args.get("source", "dashboard")

    if request.method == "POST":

        workout_name = request.form["workout_name"].strip()
        workout_date = request.form["workout_date"].strip()
        notes = request.form["notes"].strip()

        if not workout_name or not workout_name:
            return render_template(
                "create_workout.html",
                error="Workout name and date are required.",
                source=source
            )

        connection =get_db_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO workouts
            (user_id, workout_name, workout_date, notes)
            VALUES (%s, %s, %s, %s)
        """

        cursor.execute(
            query,
            (
                session["user_id"],
                workout_name,
                workout_date,
                notes
            )
        )

        connection.commit()

        cursor.close()
        connection.close()

        return redirect(url_for("workout.workouts"))

    return render_template("create_workout.html", source=source)

@workout.route("/workout/edit/<int:workout_id>", methods=["GET", "POST"])
def edit_workout(workout_id):

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT id, workout_name, workout_date, notes
        FROM workouts
        WHERE id = %s AND user_id = %s
    """

    cursor.execute(
        query,
        (workout_id, session["user_id"])
    )

    workout_data = cursor.fetchone()

    cursor.close()
    connection.close()

    if not workout_data:
        return "Workout not found.", 404

    if request.method == "POST":

        workout_name = request.form["workout_name"].strip()
        workout_date = request.form["workout_date"].strip()
        notes = request.form["notes"].strip()

        if not workout_name or not workout_date:
            return render_template(
                "edit_workout.html",
                workout=workout_data,
                error="Workout name and date are required."
            )

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            UPDATE workouts
            SET workout_name = %s,
                workout_date = %s,
                notes = %s
            WHERE id = %s AND user_id = %s
        """

        cursor.execute(
            query,
            (
                workout_name,
                workout_date,
                notes,
                workout_id,
                session["user_id"]
            )
        )

        connection.commit()

        cursor.close()
        connection.close()

        return redirect(url_for("workout.workouts"))

    return render_template(
        "edit_workout.html",
        workout=workout_data
    )

@workout.route("/workouts/delete/<int:workout_id>", methods=["POST"])
def delete_workout(workout_id):

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    connection = get_db_connection()
    cursor = connection.cursor()

    query = """
        DELETE FROM workouts
        WHERE id = %s AND user_id = %s
    """

    cursor.execute(
        query,
        (
            workout_id,
            session["user_id"]
        )
    )

    connection.commit()

    cursor.close()
    connection.close()

    return redirect(url_for("workout.workouts"))

@workout.route("/workouts/view/<int:workout_id>")
def view_workout(workout_id):

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT id, workout_name, workout_date, notes
        FROM workouts
        WHERE id = %s AND user_id = %s
    """

    cursor.execute(
        query, 
        (workout_id, session["user_id"])
    )

    workout_data = cursor.fetchone()

    if not workout_data:
        cursor.close()
        connection.close()
        return "Workout not found.", 404

    exercise_query = """
        SELECT
            we.id,
            e.name AS exercise_name,
            we.sets,
            we.reps,
            we.weight
        FROM workout_exercises we
        JOIN exercises e
            ON we.exercise_id = e.id
        WHERE we.workout_id = %s
        ORDER BY e.name
    """

    cursor.execute(
        exercise_query,
        (workout_id,)
    )

    exercises = cursor.fetchall()

    cursor.close()
    connection.close()

    return render_template(
        "view_workout.html",
        workout=workout_data,
        exercises=exercises
    )

@workout.route("/workouts/view/<int:workout_id>/add-exercise", methods=["GET", "POST"])
def add_exercise(workout_id):

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    source = request.values.get("source", "view")

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    workout_query = """
        SELECT id, workout_name
        FROM workouts
        WHERE id = %s AND user_id = %s
    """

    cursor.execute(
        workout_query,
        (workout_id, session["user_id"])
    )

    workout_data = cursor.fetchone()

    if not workout_data:
        cursor.close()
        connection.close()
        return "Workout not found.", 404

    exercise_query = """
        SELECT id, name
        FROM exercises
        ORDER BY name
    """

    cursor.execute(exercise_query)

    exercises = cursor.fetchall()
    print("EXERCISES:", exercises)

    cursor.close()
    connection.close()

    exercises = Exercise.get_all()

    if request.method == "POST":

        exercise_id = request.form["exercise_id"]
        sets = request.form["sets"]
        reps = request.form["reps"]
        weight = request.form["weight"]

        if not exercise_id:
            return render_template(
                "add_exercise.html",
                workout=workout_data,
                exercises=exercises,
                error="Please select an exercise.",
                source=source
            )

        try:
            sets = int(sets)
            reps = int(reps)
            weight = float(weight)
        except ValueError:
            return render_template(
                "add_exercise.html",
                workout=workout_data,
                exercises=exercises,
                error="Please enter valid number.",
                source=source
            )

        if sets < 1:
            return render_template(
                "add_exercise.html",
                workout=workout_data,
                exercises=exercises,
                error="Sets must be at least 1.",
                source=source
            )

        if reps < 1:
            return render_template(
                "add_exercise.html",
                workout=workout_data,
                exercises=exercises,
                error="Reps must be at least 1.",
                source=source
            )

        if weight < 0:
            return render_template(
                "add_exercise.html",
                workout=workout_data,
                exercises=exercises,
                error="Weight cannot be negative.",
                source=source
            )

        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO workout_exercises
            (workout_id, exercise_id, sets, reps, weight)
            VALUES (%s, %s, %s, %s, %s)
        """
        cursor.execute(
            query,
            (
                workout_id,
                exercise_id,
                sets,
                reps,
                weight
            )
        )

        connection.commit()

        cursor.close()
        connection.close()

        return redirect(
            url_for(
                "workout.view_workout",
                workout_id=workout_id
            )
        )

    return render_template(
        "add_exercise.html",
        workout=workout_data,
        exercises=exercises,
        source=source
    )

@workout.route("/workout/view/<int:workout_id>/edit_exercise/<int:exercise_id>", methods=["GET", "POST"])
def edit_exercise(workout_id, exercise_id):

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    connection = get_db_connection()
    cursor = connection.cursor(dictionary=True)

    query = """
        SELECT
            we.id,
            we.exercise_id,
            e.name AS exercise_name,
            we.sets,
            we.reps,
            we.weight
        FROM workout_exercises we
        JOIN exercises e
            ON we.exercise_id = e.id
        JOIN workouts w
            ON we.workout_id = w.id
        WHERE we.id = %s
        AND we.workout_id = %s
        AND w.user_id = %s
    """

    cursor.execute(
        query, 
        (
            exercise_id,
            workout_id,
            session["user_id"]
        )
    )

    exercise_data = cursor.fetchone()

    cursor.close()
    connection.close()

    if not exercise_data:
        return "Exercise not found.", 404

    if request.method == "POST":

        sets = request.form["sets"]
        reps = request.form["reps"]
        weight = request.form["weight"]

        connection = get_db_connection()
        cursor = connection.cursor()

        update_query = """
            UPDATE workout_exercises
            SET sets = %s,
                reps = %s,
                weight = %s
            WHERE id = %s
            AND workout_id = %s
        """

        cursor.execute(
            update_query,
            (
                sets,
                reps,
                weight,
                exercise_id,
                workout_id
            )
        )

        connection.commit()

        cursor.close()
        connection.close()

        return redirect(
            url_for(
                "workout.view_workout",
                workout_id=workout_id
            )
        )

    return render_template (
        "edit_exercise.html",
        workout_id=workout_id,
        exercise=exercise_data
    )

@workout.route("/workout/view/<int:workout_id>/delete-exercise/<int:exercise_id>", methods=["POST"])
def delete_exercise(workout_id, exercise_id):

    if "user_id" not in session:
        return redirect(url_for("auth.login"))

    connection = get_db_connection()
    cursor = connection.cursor()

    query = """
        DELETE we
        FROM workout_exercises we
        JOIN workouts w
            ON we.workout_id = w.id
        WHERE we.id = %s
        AND we.workout_id = %s
        AND w.user_id = %s
    """

    cursor.execute(
        query,
        (
            exercise_id,
            workout_id,
            session["user_id"]
        )
    )

    connection.commit()

    cursor.close()
    connection.close()

    return redirect(
        url_for(
            "workout.view_workout",
            workout_id=workout_id
        )
    )


    
       