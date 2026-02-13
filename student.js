// List of notes in GitHub notes folder
const notes = [
  {
    name: "Environmental Chemistry Chapter I & II",
    file: "notes/Environ Chem Chap I & II , word 2003.doc"
  },
  {
    name: "Functional and Non Functional Requirements",
    file: "notes/Functional and non functional requirements.ppt"
  }
];

// Display notes
const container = document.getElementById("notes");

notes.forEach(note => {
  const div = document.createElement("div");

  div.innerHTML = `
    <p>
      📄 ${note.name}
      <br>
      <a href="${note.file}" target="_blank">View</a> |
      <a href="${note.file}" download>Download</a>
    </p>
  `;

  container.appendChild(div);
});
