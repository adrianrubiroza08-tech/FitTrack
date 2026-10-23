from flask import Flask, render_template
from flask_wtf.csrf import CSRFProtect
from flask_mail import Mail
from dotenv import load_dotenv 


from routes.auth import auth
from routes.dashboard import dashboard
from routes.workout import workout
from routes.profile import profile
from routes.progress import progress

app = Flask(__name__)

app.secret_key = app.config["SECRET_KEY"]
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

app.config.from_object("config.Config")

csrf = CSRFProtect(app)
mail = Mail(app)

app.register_blueprint(auth)
app.register_blueprint(dashboard)
app.register_blueprint(workout)
app.register_blueprint(profile)
app.register_blueprint(progress)

@app.route("/")
def home():
    return render_template("home.html")

if __name__ == "__main__":
    app.run(debug=True)
