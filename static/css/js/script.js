document.addEventListener("DOMContentLoaded", function () {

    const confirmPassword = document.querySelector(
        'input[name="confirm_password"]'
    );

    const newPassword = document.querySelector(
        'input[name="new_password"]'
    );

    if (confirmPassword && newPassword) {

        confirmPassword.addEventListener("input", function () {

            if (confirmPassword.value !== newPassword.value) {

                confirmPassword.setCustomValidity(
                    "Passwords do not match."
                );

            } else {

                confirmPassword.setCustomValidity("");

            }

        });

        newPassword.addEventListener("input", function () {

            if (confirmPassword.value !== newPassword.value) {

                confirmPassword.setCustomValidity(
                    "Passwords do not match."
                );

            } else {

                confirmPassword.setCustomValidity("");

            }

        });

    }

    const deleteForms = document.querySelectorAll(
        'form[action*="/delete/"], form[action*="/delete-exercise/"]'
    );

    deleteForms.forEach(function (form) {

        form.addEventListener("submit", function (event) {

            const confirmed = confirm(
                "Are you sure you want to delete this?"
            );

            if (!confirmed) {

                event.preventDefault();

            }

        });

    });

    const forms = document.querySelectorAll("form");

    forms.forEach(function (form) {

        form.addEventListener("submit", function (event) {

            const requiredFields = form.querySelectorAll(
                "input[required], select[required], textarea[required]"
            );

            let valid = true;

            requiredFields.forEach(function (field) {

                if (field.value.trim() === "") {

                    valid = false;

                    field.classList.add("is-invalid");

                } else {

                    field.classList.remove("is-invalid");

                }

            });

            if (!valid) {

                event.preventDefault();

                alert("Please complete all required fields.");

            }

        });

    });

    const emailFields = document.querySelectorAll(
        'input[type="email"]'
    );

    emailFields.forEach(function (email) {

        email.addEventListener("input", function () {

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (
                email.value !== "" &&
                !emailPattern.test(email.value)
            ) {

                email.classList.add("is-invalid");

            } else {

                email.classList.remove("is-invalid");

            }

        });

    });

    const setsField = document.querySelector(
        'input[name="sets"]'
    );

    const repsField = document.querySelector(
        'input[name="reps"]'
    );

    const weightField = document.querySelector(
        'input[name="weight"]'
    );


    if (setsField) {

        setsField.addEventListener("input", function () {

            if (Number(setsField.value) < 1) {

                setsField.setCustomValidity(
                    "Sets must be at least 1."
                );

            } else {

                setsField.setCustomValidity("");

            }

        });

    }


    if (repsField) {

        repsField.addEventListener("input", function () {

            if (Number(repsField.value) < 1) {

                repsField.setCustomValidity(
                    "Reps must be at least 1."
                );

            } else {

                repsField.setCustomValidity("");

            }

        });

    }


    if (weightField) {

        weightField.addEventListener("input", function () {

            if (Number(weightField.value) < 0) {

                weightField.setCustomValidity(
                    "Weight cannot be negative."
                );

            } else {

                weightField.setCustomValidity("");

            }

        });

    }

    const fields = document.querySelectorAll(
        "input, select, textarea"
    );

    fields.forEach(function (field) {

        field.addEventListener("input", function () {

            if (field.value.trim() !== "") {

                field.classList.remove("is-invalid");

            }

        });

    });

});