from database import get_db_connection

class WorkoutExercise:
    def __init__(
        self,
        id,
        workout_id,
        exercise_id,
        sets,
        reps,
        weight,
        notes=None
    ):
        self.id = id
        self.workout_id = workout_id
        self.exercise_id = exercise_id
        self.sets = sets
        self.reps = reps
        self.weight = weight
        self.notes = notes

    def get_summary(self):
        return f"{self.sets} sets x {self.reps} reps @ {self.weight} kg"

    @staticmethod
    def get_by_workout(workout_id):
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                we.id,
                we.workout_id,
                we.exercise_id,
                e.name AS exercise_name,
                e.muscle_group,
                we.sets,
                we.reps,
                we.weight,
                we.notes
            FROM workout_exercises we
            INNER JOIN exercises e
                ON we.exercise_id = e.id
            WHERE we.workout_id = %s
            ORDER BY we.id
        """
        cursor.execute(query,(workout_id,))
        workout_exercise_data = cursor.fetchall()

        cursor.close()
        connection.close()

        workout_exercises = []

        for item in workout_exercise_data:
            workout_exercises.append(
                WorkoutExercise(
                    item["id"],
                    item["workout_id"],
                    item["exercise_id"],
                    item["sets"],
                    item["reps"],
                    item["weight"],
                    item["notes"]
                )
            )

        return workout_exercises