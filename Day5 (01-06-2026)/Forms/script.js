const form = document.getElementById("registrationForm");

form.addEventListener("submit", function (e) {
    e.preventDefault();

    clearErrors();

    let isValid = true;

    const name = document.getElementById("name");
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");

    // Name Validation
    if (name.value.trim() === "") {
        showError(name, "nameError", "Name is required");
        isValid = false;
    }

    // Email Validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (email.value.trim() === "") {
        showError(email, "emailError", "Email is required");
        isValid = false;
    } else if (!emailPattern.test(email.value.trim())) {
        showError(email, "emailError", "Invalid email format");
        isValid = false;
    }

    // Password Validation
    if (password.value.length < 6) {
        showError(
            password,
            "passwordError",
            "Password must be at least 6 characters"
        );
        isValid = false;
    }

    // Confirm Password Validation
    if (confirmPassword.value !== password.value) {
        showError(
            confirmPassword,
            "confirmPasswordError",
            "Passwords do not match"
        );
        isValid = false;
    }

    if (isValid) {
        alert("Form submitted successfully!");
        form.reset();
    }
});
function togglePassword(inputId, icon) {
    const input = document.getElementById(inputId);

    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function showError(input, errorId, message) {
    input.classList.add("invalid");
    document.getElementById(errorId).textContent = message;
}

function clearErrors() {
    document.querySelectorAll(".error").forEach(error => {
        error.textContent = "";
    });

    document.querySelectorAll("input").forEach(input => {
        input.classList.remove("invalid");
    });
}