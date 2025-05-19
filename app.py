import uvicorn
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from src.database.config import Base, engine
from src.routes.employee import fetch_table_data, get_tables, get_table_structure

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="src/static"), name="static")

# Create router
router = APIRouter()

# Register routes explicitly
router.get("/api/tables")(get_tables)
router.get("/api/table-structure/{table_name}")(get_table_structure)
router.get("/api/table-data/{table_name}")(fetch_table_data)

# Include router
app.include_router(router)

@app.get("/")
async def index():
    return FileResponse("src/static/index.html")

# Template configuration
templates = Jinja2Templates(directory="src/static")














