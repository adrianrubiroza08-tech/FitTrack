# FitTrack – Fitness Management System

## About the Project

FitTrack is a web-based fitness management system that allows users to create accounts, log in, record workouts, manage exercises, and track workout history. It also includes profile management and email OTP verification during registration.

## Features

- User registration and login
- Email OTP verification
- Workout logging and management
- Exercise management with sets, reps, and weight
- Workout history and progress tracking
- Profile editing and password changing
- Email notifications
- CSRF protection and password hashing

## Technologies Used

- Python
- Flask
- MySQL
- XAMPP
- HTML, CSS, and JavaScript
- Flask-Mail
- Flask-WTF
- python-dotenv

## Requirements

- Python 3
- XAMPP with MySQL
- A web browser
- A Gmail account and Gmail App Password for email features

## Installation and Setup

### 1. Download the Project

Clone this repository or download the source code from GitHub.

### 2. Set Up the Database

1. Start Apache and MySQL in XAMPP.
2. Open phpMyAdmin.
3. Create a database named `fittrack_db`.
4. Import the provided `fittrack_schema.sql` file.

**Note:** The schema file contains the database structure. You may need to add exercise records or other initial data if your installation requires them.

### 3. Set Up the Python Environment

Create and activate a virtual environment.

On Windows:

```powershell
python -m venv venv
venv\Scripts\activate
```

Install the required packages:

```powershell
python -m pip install -r requirements.txt
```

### 4. Configure Environment Variables

Copy `.env.example` to `.env` and enter your own local settings.

Configure the following variables as needed:

- `SECRET_KEY`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `MAIL_USERNAME`
- `MAIL_PASSWORD`

Use your own Gmail App Password for email features. Never upload your actual `.env` file or share your credentials publicly.

### 5. Run FitTrack

Start the application:

```powershell
python app.py
```

Open the local URL displayed in your terminal.

## Security Notes

- Keep `.env` private.
- Never publish passwords, secret keys, or private database backups.
- Use a unique secret key for your local installation.
- Use test data when sharing database examples.

## Project Purpose

FitTrack was developed as an academic project to demonstrate web development, database integration, user authentication, and fitness record management.
