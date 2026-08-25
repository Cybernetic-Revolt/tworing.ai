# Runs inside LXC 129: fix Kelly's broken script in place.
# - Joes' -> Joe's (TTS was saying "Josie's")
# - phantom tools check_caller_history / send_sms_confirmation -> real tools
# - booking params date/time -> slotStart
# - prepend authoritative CRITICAL OPERATING RULES (efficiency, real tools)
# Preserves all the business domain content. Idempotent-ish (guards on header).
import json
import urllib.request

KELLY = "de15dfc8-6bb8-494b-9efa-32e1ba943aa9"
with open("/etc/bilco-platform.env") as f:
    env = dict(l.strip().split("=", 1) for l in f if "=" in l and not l.startswith("#"))
API_KEY = env["VAPI_API_KEY"]


def req(path, method="GET", body=None):
    r = urllib.request.Request(
        "https://api.vapi.ai" + path, method=method,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json", "User-Agent": "curl/8.5.0"},
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read())


HEADER = """# CRITICAL OPERATING RULES (these override anything below that conflicts)

- The business is "Joe's Lawn & Snow" (Joe's — like the man's name Joe). Never say "Joes'".
- BE BRIEF. Ask at most 3-4 short questions before you book a quote visit or take a message. The detailed per-service checklists later in this prompt are REFERENCE ONLY: pick the one or two details that actually matter for this caller, then move on. The crew confirms the rest at the quote. Do NOT run down a long list of questions.
- The ONLY tools you have are: find_appointments, check_availability, book_appointment, reschedule_appointment, cancel_appointment, take_message, transferCall. No other tool exists. Never attempt to call a tool that is not in this list.
- Booking: call check_availability, offer at most two of the returned times (earliest first), then call book_appointment with the EXACT bracketed slotStart value from check_availability. Collect name + callback number + service + address first. The confirmation text is sent automatically by book_appointment — there is NO SMS tool to call.
- To change/cancel: call find_appointments first (it uses the caller's number) to see what's booked, confirm it, then reschedule_appointment or cancel_appointment.
- Filler discipline: when a tool is running, say at most ONE short "one moment". Never stack "just a sec / hold on / one moment" back to back.

---

"""

a = req(f"/assistant/{KELLY}")
model = a["model"]
first = a.get("firstMessage", "")
new_first = first.replace("Joes'", "Joe's")

changed_first = new_first != first
patch = {}
if changed_first:
    patch["firstMessage"] = new_first

for m in model.get("messages", []):
    if m.get("role") != "system":
        continue
    c = m["content"]
    c = c.replace("Joes'", "Joe's")
    # Repoint phantom tools to real ones / remove tool calls that don't exist.
    c = c.replace("check_caller_history", "find_appointments")
    c = c.replace("call `send_sms_confirmation`", "rely on the automatic confirmation text (no tool to call)")
    c = c.replace("Use `send_sms_confirmation` only after the verbal booking confirmation.",
                  "The booking confirmation text is sent automatically by book_appointment — there is no SMS tool.")
    c = c.replace("send_sms_confirmation", "the automatic confirmation text")
    # Fix booking params: date/time -> slotStart.
    c = c.replace("* date = YYYY-MM-DD.\n* time = HH:MM in 24-hour time.",
                  "* slotStart = the EXACT bracketed slotStart value returned by check_availability (never reformat it).")
    if not c.startswith("# CRITICAL OPERATING RULES"):
        c = HEADER + c
    m["content"] = c
    patch["model"] = model
    break

if patch:
    req(f"/assistant/{KELLY}", "PATCH", patch)

b = req(f"/assistant/{KELLY}")
sys = next(m["content"] for m in b["model"]["messages"] if m.get("role") == "system")
print("firstMessage:", repr(b.get("firstMessage")))
print("has CRITICAL header:", sys.startswith("# CRITICAL OPERATING RULES"))
print("remaining 'Joes':", "Joes'" in sys)
print("remaining check_caller_history:", "check_caller_history" in sys)
print("remaining send_sms_confirmation:", "send_sms_confirmation" in sys)
print("tools:", [t.get("function", {}).get("name") or t.get("type") for t in b["model"].get("tools", [])])
