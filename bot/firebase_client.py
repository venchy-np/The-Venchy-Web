"""
Venchy Bot — Firebase Client Module
Initializes Firebase Admin SDK and exposes a Firestore client.
"""

import firebase_admin
from firebase_admin import credentials, firestore
from bot.config import config


def _initialize_firebase():
    """Initialize the Firebase Admin SDK with service account credentials."""
    if firebase_admin._apps:
        return firestore.client()

    cred_data = config.FIREBASE_CREDENTIALS

    if isinstance(cred_data, dict):
        cred = credentials.Certificate(cred_data)
    elif isinstance(cred_data, str):
        cred = credentials.Certificate(cred_data)
    else:
        raise ValueError("Invalid Firebase credentials format")

    firebase_admin.initialize_app(cred)
    print("[OK] Firebase Admin SDK initialized successfully")
    return firestore.client()


# Singleton Firestore client
db = _initialize_firebase()


# -- Helper Functions --------------------------------------------------

async def get_guild_doc(guild_id: int):
    return db.collection("guilds").document(str(guild_id))

async def set_guild_meta(guild_id: int, channels: list, roles: list):
    """Save guild channels and roles to Firestore for the web dashboard."""
    guild_ref = db.collection("guilds").document(str(guild_id))
    guild_ref.set({"guild_id": str(guild_id)}, merge=True)
    guild_ref.collection("info").document("meta").set({
        "channels": channels,
        "roles": roles
    })

async def get_youtube_feeds(guild_id: int) -> list:
    guild_ref = db.collection("guilds").document(str(guild_id))
    feeds = guild_ref.collection("youtube_feeds").stream()
    return [feed.to_dict() for feed in feeds]


async def add_youtube_feed(guild_id: int, channel_id: str, data: dict):
    guild_ref = db.collection("guilds").document(str(guild_id))
    guild_ref.set({"guild_id": str(guild_id)}, merge=True)
    guild_ref.collection("youtube_feeds").document(channel_id).set(data)


async def remove_youtube_feed(guild_id: int, channel_id: str) -> bool:
    guild_ref = db.collection("guilds").document(str(guild_id))
    doc_ref = guild_ref.collection("youtube_feeds").document(channel_id)
    doc = doc_ref.get()
    if doc.exists:
        doc_ref.delete()
        return True
    return False


async def update_youtube_last_videos(guild_id: int, channel_id: str, video_ids: list):
    guild_ref = db.collection("guilds").document(str(guild_id))
    guild_ref.collection("youtube_feeds").document(channel_id).update({
        "last_video_ids": video_ids
    })


async def get_instagram_feeds(guild_id: int) -> list:
    guild_ref = db.collection("guilds").document(str(guild_id))
    feeds = guild_ref.collection("instagram_feeds").stream()
    return [feed.to_dict() for feed in feeds]


async def add_instagram_feed(guild_id: int, label: str, data: dict):
    guild_ref = db.collection("guilds").document(str(guild_id))
    guild_ref.set({"guild_id": str(guild_id)}, merge=True)
    guild_ref.collection("instagram_feeds").document(label).set(data)


async def remove_instagram_feed(guild_id: int, label: str) -> bool:
    guild_ref = db.collection("guilds").document(str(guild_id))
    doc_ref = guild_ref.collection("instagram_feeds").document(label)
    doc = doc_ref.get()
    if doc.exists:
        doc_ref.delete()
        return True
    return False


async def update_instagram_last_posts(guild_id: int, label: str, post_ids: list):
    guild_ref = db.collection("guilds").document(str(guild_id))
    guild_ref.collection("instagram_feeds").document(label).update({
        "last_post_ids": post_ids
    })


async def get_all_guilds() -> list:
    guilds = db.collection("guilds").stream()
    return [guild.to_dict() for guild in guilds]


async def get_all_youtube_feeds_global() -> list:
    all_feeds = []
    guilds = db.collection("guilds").stream()
    for guild in guilds:
        guild_id = guild.id
        feeds = db.collection("guilds").document(guild_id).collection("youtube_feeds").stream()
        for feed in feeds:
            feed_data = feed.to_dict()
            feed_data["guild_id"] = guild_id
            all_feeds.append(feed_data)
    return all_feeds


async def get_all_instagram_feeds_global() -> list:
    all_feeds = []
    guilds = db.collection("guilds").stream()
    for guild in guilds:
        guild_id = guild.id
        feeds = db.collection("guilds").document(guild_id).collection("instagram_feeds").stream()
        for feed in feeds:
            feed_data = feed.to_dict()
            feed_data["guild_id"] = guild_id
            all_feeds.append(feed_data)
    return all_feeds
