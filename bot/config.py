"""
Venchy Bot — Configuration Module
Loads and validates all environment variables.
"""

import os
import sys
import json
import io
from dotenv import load_dotenv

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Load .env file if it exists (local development)
load_dotenv()


class Config:
    """Centralized configuration loaded from environment variables."""

    def __init__(self):
        # -- Discord ---------------------------------------------------
        self.DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
        if not self.DISCORD_TOKEN:
            print("[ERROR] DISCORD_TOKEN is not set! Please set it in your .env file or environment variables.")
            sys.exit(1)

        # -- Firebase --------------------------------------------------
        # Priority: JSON string env var > file path env var > default file
        self.FIREBASE_CREDENTIALS = None
        
        json_str = os.getenv("FIREBASE_CREDENTIALS_JSON")
        json_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "serviceAccountKey.json")

        if json_str:
            try:
                self.FIREBASE_CREDENTIALS = json.loads(json_str)
                print("[OK] Firebase credentials loaded from FIREBASE_CREDENTIALS_JSON")
            except json.JSONDecodeError:
                print("[ERROR] FIREBASE_CREDENTIALS_JSON contains invalid JSON!")
                sys.exit(1)
        elif os.path.exists(json_path):
            self.FIREBASE_CREDENTIALS = json_path
            print(f"[OK] Firebase credentials loaded from file: {json_path}")
        else:
            print("[ERROR] No Firebase credentials found!")
            print("   Set FIREBASE_CREDENTIALS_JSON (JSON string) or")
            print(f"   Place your service account key at: {json_path}")
            sys.exit(1)

        # -- Bot Settings ----------------------------------------------
        self.YOUTUBE_POLL_INTERVAL = int(os.getenv("YOUTUBE_POLL_INTERVAL", "3"))   # minutes
        self.INSTAGRAM_POLL_INTERVAL = int(os.getenv("INSTAGRAM_POLL_INTERVAL", "5"))  # minutes

        # -- Admin User IDs (optional) ---------------------------------
        admin_ids = os.getenv("ADMIN_USER_IDS", "")
        self.ADMIN_USER_IDS = [int(uid.strip()) for uid in admin_ids.split(",") if uid.strip()]


# Singleton instance
config = Config()
