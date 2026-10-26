"""Optional Python advisory API for InternTrack AI.
This provides transparent rule-based feedback suggestions, not an autonomous grade.
"""
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "InternTrack AI advisory API"})

@app.post("/advisory")
def advisory():
    payload = request.get_json(silent=True) or {}
    summary = str(payload.get("summary", "")).strip()
    stage = str(payload.get("stage", "Progress Review")).strip()
    if not summary:
        return jsonify({"error": "Please provide a submission summary."}), 400

    lower = summary.lower()
    checks = [
        {
            "criterion": "Work summary",
            "status": "Good" if len(summary) >= 80 else "Needs detail",
            "suggestion": "Summarize tasks completed, tools used, and the outcome."
        },
        {
            "criterion": "Evidence and results",
            "status": "Mentioned" if any(w in lower for w in ["result", "tested", "built", "implemented", "measured", "completed"]) else "Missing",
            "suggestion": "Add measurable results, screenshots, test outcomes, or other evidence."
        },
        {
            "criterion": "Learning reflection",
            "status": "Mentioned" if any(w in lower for w in ["learned", "challenge", "improved", "skill", "lesson"]) else "Missing",
            "suggestion": "Describe one challenge, what you learned, and how you addressed it."
        },
        {
            "criterion": "Next steps",
            "status": "Mentioned" if any(w in lower for w in ["next", "plan", "will", "upcoming", "goal"]) else "Missing",
            "suggestion": "State the next action and a realistic target date."
        }
    ]
    missing = [item["criterion"] for item in checks if item["status"] in ("Missing", "Needs detail")]
    return jsonify({
        "stage": stage,
        "advisory_only": True,
        "summary": "Review the submission against the checklist. A human reviewer makes the final decision.",
        "checks": checks,
        "suggested_feedback": (
            "Please expand these areas: " + ", ".join(missing) + "."
            if missing else "The summary covers the main areas; verify the evidence and provide specific reviewer feedback."
        )
    })

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)
