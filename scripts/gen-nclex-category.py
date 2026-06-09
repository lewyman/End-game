#!/usr/bin/env python3
"""Generate NCLEX questions for a category via Zo Ask API."""
import requests, json, sys, os

try:
    import aiohttp, asyncio
except ImportError:
    os.sys