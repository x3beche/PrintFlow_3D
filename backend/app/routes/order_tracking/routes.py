from fastapi import HTTPException, Depends
from fastapi.responses import StreamingResponse
from typing import AsyncGenerator
import json
import asyncio
import queue
import threading
import logging
from models.user import User
from routes.authentication.auth_modules import get_session
from app import app
from datetime import datetime