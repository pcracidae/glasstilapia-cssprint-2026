"""FastAPI entry point.

Run from the backend/ folder:  uvicorn app.main:app --reload
Interactive API docs:          http://localhost:8000/docs
"""

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import items

load_dotenv()  # reads backend/.env if present (never commit .env)

app = FastAPI(title="glasstilapia API")

# The Vite dev server proxies /api to us, so CORS is only a fallback
# for calling the API directly from the browser during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(items.router, prefix="/api/items", tags=["items"])
