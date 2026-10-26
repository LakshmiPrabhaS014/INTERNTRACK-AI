const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, "data", "interntrack.db"));

app.use(helmet({ contentSecurityPolicy: false })); // CDN fonts/XLSX are used by the demo frontend.
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(express.static(path.join(__dirname, "public")));

db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_code TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  company TEXT,
  role TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  review_date TEXT,
  reviewer TEXT,
  submission TEXT NOT NULL DEFAULT 'Pending',
  ai_advisory TEXT,
  decision TEXT NOT NULL DEFAULT 'Pending',
  feedback TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const count = db.prepare("SELECT COUNT(*) AS n FROM students").get().n;
if (count === 0) {
  const seed = db.prepare(`INSERT INTO students
    (student_code,name,email,department,company,role,start_date,end_date,status)
    VALUES (@student_code,@name,@email,@department,@company,@role,@start_date,@end_date,@status)`);
  const sample = [
    ["IT-001","Lakshmi Prabha S","lakshmi@example.com","CSE","Kyunshing Industrial Motherson Private Limited","Quality Intern","2026-08-01","2026-11-01","Active"],
    ["IT-002","Karthika Devi K","karthika@example.com","CSE","Demo Technologies","Software Intern","2026-08-01","2026-11-01","Active"],
    ["IT-003","Rogesh Balaji V","rogesh@example.com","IT","Demo Technologies","AI Intern","2026-08-01","2026-11-01","Active"]
  ];
  const tx = db.transaction(rows => rows.forEach(r => seed.run({
    student_code:r[0],name:r[1],email:r[2],department:r[3],company:r[4],role:r[5],
    start_date:r[6],end_date:r[7],status:r[8]
  })));
  tx(sample);
}

function log(action, detail = "") {
  db.prepare("INSERT INTO activity_log(action,detail) VALUES(?,?)").run(action, detail);
}
function validId(value) { return Number.isInteger(Number(value)) && Number(value) > 0; }

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "InternTrack AI API" }));

app.get("/api/students", (req, res) => {
  const q = String(req.query.q || "").trim();
  const status = String(req.query.status || "").trim();
  const rows = db.prepare(`
    SELECT * FROM students
    WHERE (@q = '' OR name LIKE @like OR student_code LIKE @like OR company LIKE @like)
      AND (@status = '' OR status = @status)
    ORDER BY name
  `).all({ q, like: `%${q}%`, status });
  res.json(rows);
});

app.get("/api/students/:id", (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid student id" });
  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(Number(req.params.id));
  if (!student) return res.status(404).json({ error: "Student not found" });
  const reviews = db.prepare("SELECT * FROM reviews WHERE student_id = ? ORDER BY review_date").all(student.id);
  res.json({ ...student, reviews });
});

app.post("/api/students", (req, res) => {
  const { student_code, name, email = "", department = "", company = "", role = "",
    start_date = "", end_date = "", status = "Active" } = req.body || {};
  if (!String(name || "").trim()) return res.status(400).json({ error: "Student name is required" });
  try {
    const result = db.prepare(`INSERT INTO students
      (student_code,name,email,department,company,role,start_date,end_date,status)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
      student_code || null, String(name).trim(), email, department, company, role, start_date, end_date, status
    );
    log("Student added", String(name).trim());
    res.status(201).json(db.prepare("SELECT * FROM students WHERE id = ?").get(result.lastInsertRowid));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Student code already exists" });
    res.status(500).json({ error: "Could not create student" });
  }
});

app.put("/api/students/:id", (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid student id" });
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT * FROM students WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Student not found" });
  const fields = ["student_code","name","email","department","company","role","start_date","end_date","status"];
  const body = req.body || {};
  const updated = Object.fromEntries(fields.map(k => [k, body[k] === undefined ? existing[k] : body[k]]));
  if (!String(updated.name || "").trim()) return res.status(400).json({ error: "Student name is required" });
  try {
    db.prepare(`UPDATE students SET student_code=@student_code,name=@name,email=@email,
      department=@department,company=@company,role=@role,start_date=@start_date,
      end_date=@end_date,status=@status WHERE id=@id`).run({ ...updated, id });
    log("Student updated", updated.name);
    res.json(db.prepare("SELECT * FROM students WHERE id = ?").get(id));
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) return res.status(409).json({ error: "Student code already exists" });
    res.status(500).json({ error: "Could not update student" });
  }
});

app.delete("/api/students/:id", (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid student id" });
  const student = db.prepare("SELECT * FROM students WHERE id = ?").get(Number(req.params.id));
  if (!student) return res.status(404).json({ error: "Student not found" });
  db.prepare("DELETE FROM students WHERE id = ?").run(student.id);
  log("Student deleted", student.name);
  res.json({ ok: true });
});

app.get("/api/reviews", (req, res) => {
  const studentId = req.query.student_id ? Number(req.query.student_id) : null;
  const rows = db.prepare(`
    SELECT reviews.*, students.name AS student_name, students.student_code
    FROM reviews JOIN students ON students.id = reviews.student_id
    WHERE (? IS NULL OR reviews.student_id = ?)
    ORDER BY COALESCE(review_date,'9999-12-31'), reviews.id
  `).all(studentId, studentId);
  res.json(rows);
});

app.post("/api/reviews", (req, res) => {
  const { student_id, stage, review_date = "", reviewer = "", submission = "Pending",
    ai_advisory = "", decision = "Pending", feedback = "" } = req.body || {};
  if (!validId(student_id) || !String(stage || "").trim()) {
    return res.status(400).json({ error: "student_id and stage are required" });
  }
  if (!db.prepare("SELECT id FROM students WHERE id = ?").get(Number(student_id))) {
    return res.status(404).json({ error: "Student not found" });
  }
  const result = db.prepare(`INSERT INTO reviews
    (student_id,stage,review_date,reviewer,submission,ai_advisory,decision,feedback)
    VALUES (?,?,?,?,?,?,?,?)`).run(Number(student_id), stage, review_date, reviewer, submission, ai_advisory, decision, feedback);
  log("Review scheduled", `${stage} for student #${student_id}`);
  res.status(201).json(db.prepare("SELECT * FROM reviews WHERE id = ?").get(result.lastInsertRowid));
});

app.patch("/api/reviews/:id", (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid review id" });
  const id = Number(req.params.id);
  const old = db.prepare("SELECT * FROM reviews WHERE id = ?").get(id);
  if (!old) return res.status(404).json({ error: "Review not found" });
  const allowed = ["stage","review_date","reviewer","submission","ai_advisory","decision","feedback"];
  const next = { ...old };
  for (const field of allowed) if (req.body[field] !== undefined) next[field] = req.body[field];
  db.prepare(`UPDATE reviews SET stage=@stage,review_date=@review_date,reviewer=@reviewer,
    submission=@submission,ai_advisory=@ai_advisory,decision=@decision,feedback=@feedback WHERE id=@id`)
    .run({ ...next, id });
  log("Review updated", `${next.stage} · ${next.decision}`);
  res.json(db.prepare("SELECT * FROM reviews WHERE id = ?").get(id));
});

app.get("/api/activity", (_req, res) => {
  res.json(db.prepare("SELECT * FROM activity_log ORDER BY id DESC LIMIT 50").all());
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found" }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`InternTrack AI running at http://localhost:${PORT}`));
