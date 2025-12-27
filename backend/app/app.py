from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(root_path="/api/v1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "https://medipol.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tags_metadata = [
    {
        "name": "user authentication",
        "description": "Operations with authentication.",
    },
    {
        "name": "user operations",
        "description": "Operations with user.",
    },
    {
        "name": "administration",
        "description": "Operations with administrations.",
    },
]

from routes.authentication.routes import *
from routes.user.routes import *
from routes.admin.routes import *
from routes.content.routes import *
from routes.order.routes import *
from routes.order_list.routes import *
from routes.manifacturer_pool.routes import *
from routes.manifacturer_process.routes import *