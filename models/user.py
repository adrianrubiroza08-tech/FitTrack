from database import get_db_connection

class User:
    def __init__(self, id, first_name, last_name, email, role):
        self.id = id
        self.first_name = first_name
        self.last_name = last_name
        self.email = email
        self.role = role

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"

    @staticmethod
    def find_by_email(email):
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT id, first_name, last_name, email, role
            FROM users
            WHERE email = %s
        """

        cursor.execute(query, (email,))
        user_data = cursor.fetchone()

        cursor.close()
        connection.close()

        if user_data:
            return User(
                user_data["id"],
                user_data["first_name"],
                user_data["last_name"],
                user_data["email"],
                user_data["role"]
            )

        return None
            
        

        