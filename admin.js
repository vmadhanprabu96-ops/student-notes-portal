function login() {
    var password = document.getElementById("password").value;

    if (password === "admin123") {
        alert("Login successful");
        window.location.href = "upload.html";
    } else {
        alert("Wrong password");
    }
}

function upload() {
    alert("To upload notes, open GitHub → student-notes-portal → Add file → Upload files");
}
