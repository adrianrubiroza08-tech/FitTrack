from database import get_db_connection


class Exercise:
    def __init__(self, id, name, muscle_group):
        self.id = id
        self.name = name
        self.muscle_group = muscle_group


    def get_info(self):
        return f"{self.name} - {self.muscle_group}"

    @staticmethod
    def get_all():
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT id, name, muscle_group
            FROM exercises
            ORDER BY name
        """

        cursor.execute(query)
        exercise_data = cursor.fetchall()

        cursor.close()
        connection.close()

        exercises = []

        for exercise in exercise_data:
            exercises.append(
                Exercise(
                    exercise["id"],
                    exercise["name"],
                    exercise["muscle_group"]
                )
            )

        return exercises 