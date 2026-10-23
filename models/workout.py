from database import get_db_connection


class Workout:
    def __init__(self, id, user_id, workout_name, workout_date, notes=None):
        self.id = id 
        self.user_id = user_id
        self.workout_name = workout_name
        self.workout_date = workout_date
        self.notes = notes

    def get_summary(self):
        return f"{self.workout_name} - {self.workout_date}"

    @staticmethod
    def get_by_user(user_id):
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT id, user_id, workout_name, workout_date, notes
            FROM workouts
            WHERE user_id = %s
            ORDER BY workout_date DESC
        """
        cursor.execute(query,(user_id,))
        workout_data = cursor.fetchall()

        cursor.close()
        connection.close()

        workouts = []

        for workout in workout_data:
            workouts.append(
                Workout(
                    workout["id"],
                    workout["user_id"],
                    workout["workout_name"],
                    workout["workout_date"],
                    workout["notes"]
                )
            )

        return workouts