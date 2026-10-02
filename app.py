"""IncomeLens web routes. Run with: python -m uvicorn app:app --reload"""

import json
import os
import uuid
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
