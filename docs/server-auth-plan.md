# Server-side plan: citizen accounts and anonymous reports

The frontend already supports this (try it with `npm run dev:mock`). Until the backend implements it, reporting still works and every report shows as **Anonymous**. Sign-up shows "not enabled on the server yet".

## The rule

> **The server decides whether a report is anonymous, never the client.**
> A report is linked to an account only if `POST /api/incidents` arrives with a **valid** `Authorization: Bearer <token>`
> and the body does not ask for `"anonymous": true`. Otherwise it is anonymous.

| Request to `POST /api/incidents` | Result |
|---|---|
| No `Authorization` header | Anonymous (`reporter_id = NULL`, `is_anonymous = true`) |
| Valid token, no `anonymous` flag | Linked (`reporter_id = user.id`, `is_anonymous = false`) |
| Valid token + `"anonymous": true` | Anonymous: the user chose it. Do not store their id. |
| Header present but token invalid or expired | **401**. Don't silently downgrade. The frontend then clears the session and resubmits without a token, so the report is never lost. |

## 1. Database changes (`app/models.py`)

```python
class User(Base):
    # existing: id, name, email, password_hash, role, created_at
    phone = Column(String(15), nullable=True)
    role = Column(String(20), default="user", nullable=False)   # "admin" | "user"  (default changes from "admin")

class Incident(Base):
    # new
    reporter_id  = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    is_anonymous = Column(Boolean, default=True, nullable=False)
    reporter     = relationship("User")

class AuthToken(Base):                      # replaces the in-memory ACTIVE_TOKENS dict
    __tablename__ = "auth_tokens"
    token_hash = Column(String(64), primary_key=True)          # sha256 of the token, never the raw token
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
```

SQLite's `create_all()` does not add columns to an existing table. Delete `emergency.db` once and the seed recreates it.

## 2. Passwords and tokens (`app/auth.py`)

The current `sha256(static_salt + password)` is fast to brute-force. Use the standard library's PBKDF2 (no new dependency):

```python
import hashlib, hmac, os, secrets
from datetime import timedelta

def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, 200_000)
    return f"pbkdf2${salt.hex()}${dk.hex()}"

def verify_password(pw: str, stored: str) -> bool:
    try:
        _, salt_hex, dk_hex = stored.split("$")
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt_hex), 200_000)
    return hmac.compare_digest(dk.hex(), dk_hex)

TOKEN_TTL = timedelta(hours=12)
_hash = lambda t: hashlib.sha256(t.encode()).hexdigest()

def issue_token(db, user) -> str:
    token = secrets.token_urlsafe(32)
    db.add(AuthToken(token_hash=_hash(token), user_id=user.id, expires_at=utc_now() + TOKEN_TTL))
    db.commit()
    return token

def _user_from_header(authorization, db):
    """None = no header. Raises 401 if a header is present but invalid/expired."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(401, "Invalid Authorization header format. Expected 'Bearer <token>'")
    row = db.get(AuthToken, _hash(token.strip()))
    if not row or row.expires_at < utc_now():
        raise HTTPException(401, "Invalid or expired authentication token")
    return db.get(User, row.user_id)

def get_optional_user(authorization: str | None = Header(None), db: Session = Depends(get_db)):
    return _user_from_header(authorization, db)

def require_user(user = Depends(get_optional_user)):
    if user is None:
        raise HTTPException(401, "Missing Authorization header")
    return user

def require_admin(user = Depends(require_user)):
    if user.role != "admin":
        raise HTTPException(403, "Admin privileges required")     # 403, not 401: signed in but not allowed
    return user
```

Remember to re-hash the seeded admin with the new `hash_password`.

## 3. New and changed endpoints

| Method | Path | Auth | Body / response |
|---|---|---|---|
| POST | `/api/auth/register` | public | `{name 2-80, email, password ≥8, phone?}` → **201** `{token, user:{id,name,email,role:"user"}}`. **409** if the email exists. Always create `role="user"`, never trust a role from the body. |
| POST | `/api/auth/login` | public | unchanged shape `{token, user}`; works for both roles |
| GET | `/api/auth/me` | user | `{id,name,email,role}`; the frontend calls this on page load to validate a stored token |
| POST | `/api/auth/logout` | user | deletes the token row → **204** |
| POST | `/api/incidents` | **optional** | add `anonymous: bool = False` to `IncidentCreate`; logic below |
| GET | `/api/me/incidents` | user | `{items, total}` of the caller's own reports, newest first, same filters as the admin list |
| *all admin routes* | | admin | switch to the new `require_admin` (403 for citizens) |

```python
@router.post("", response_model=IncidentResponse, status_code=201)
def create_incident(payload: IncidentCreate, db: Session = Depends(get_db),
                    user: User | None = Depends(get_optional_user)):
    reporter = None if (user is None or payload.anonymous) else user
    incident = Incident(
        ...,                                   # existing fields
        reporter_id=reporter.id if reporter else None,
        is_anonymous=reporter is None,
        contact_name=payload.contact_name or (reporter.name if reporter else None),
        contact_email=payload.contact_email or (reporter.email if reporter else None),
        contact_phone=payload.contact_phone or (reporter.phone if reporter else None),
    )
```

## 4. Response fields the frontend reads

Add to `IncidentResponse` (admin views and `/me/incidents`):

```python
class ReporterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int; name: str; email: str

class IncidentResponse(...):
    is_anonymous: bool
    reporter: Optional[ReporterOut] = None      # None when anonymous
```

- `GET /incidents/track/{ref}` stays public and must **not** include `reporter` or contact fields.
- `GET /dashboard/stats`: add `"anonymous": <count>, "registered": <count>`. The dashboard then shows a "By reporter" bar.

## 5. Abuse and privacy checklist

- **Rate limits:** limit `POST /auth/login` and `/auth/register` per IP (e.g. 10/min), and anonymous `POST /incidents` per IP (e.g. 5/min). Without accounts, rate limits are the main spam control.
- **Login errors:** use one generic message ("Invalid email or password") so attackers can't tell which emails exist.
- **Anonymous means anonymous:** for anonymous reports, don't store the IP or user agent with the incident. If you need them for abuse control, keep them in a separate log with short retention.
- **Contact data:** never return contact fields from public endpoints.
- **CORS:** in production, drop `"*"` from `allow_origins`. The app uses Bearer headers, not cookies, so `allow_credentials` isn't needed.

## 6. Test checklist (curl)

```bash
B=http://localhost:8000/api
# register → token
curl -s -X POST $B/auth/register -H 'Content-Type: application/json' -d '{"name":"Priya Raman","email":"priya@example.com","password":"priya1234"}'
# linked report
curl -s -X POST $B/incidents -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"title":"Fire in kitchen","description":"Smoke spreading in flat","category_code":"FIRE","location":"Adyar","people_affected":2}'   # → is_anonymous:false
# same user, anonymous on purpose
curl ... -d '{..., "anonymous": true}'                                   # → is_anonymous:true, reporter:null
# no header
curl ... (no Authorization)                                              # → is_anonymous:true
# bad token
curl ... -H "Authorization: Bearer nope"                                 # → 401
# my reports / citizen blocked from admin
curl -s $B/me/incidents -H "Authorization: Bearer $TOKEN"                # → only linked reports
curl -s $B/dashboard/stats -H "Authorization: Bearer $TOKEN"             # → 403
```
