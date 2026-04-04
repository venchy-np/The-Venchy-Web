"""
Venchy Bot — RSS Parser Module
Async-safe RSS feed fetcher with retry logic and exponential backoff.
"""

import asyncio
import feedparser
import aiohttp
from bot.utils.logger import get_logger

log = get_logger("rss_parser")


async def fetch_feed(url: str, retries: int = 3, timeout: int = 15) -> dict | None:
    """
    Fetch and parse an RSS feed URL with retry logic.

    Args:
        url: The RSS feed URL to fetch
        retries: Number of retry attempts on failure
        timeout: Request timeout in seconds

    Returns:
        Parsed feed dict or None on total failure
    """
    for attempt in range(1, retries + 1):
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout)) as response:
                    if response.status == 200:
                        content = await response.text()
                        feed = feedparser.parse(content)

                        if feed.bozo and not feed.entries:
                            log.warning(f"Feed parse warning for {url}: {feed.bozo_exception}")
                            return None

                        return feed
                    else:
                        log.warning(
                            f"HTTP {response.status} fetching {url} "
                            f"(attempt {attempt}/{retries})"
                        )

        except asyncio.TimeoutError:
            log.warning(f"Timeout fetching {url} (attempt {attempt}/{retries})")
        except aiohttp.ClientError as e:
            log.warning(f"Client error fetching {url}: {e} (attempt {attempt}/{retries})")
        except Exception as e:
            log.error(f"Unexpected error fetching {url}: {e} (attempt {attempt}/{retries})")

        # Exponential backoff: 2s, 4s, 8s
        if attempt < retries:
            wait_time = 2 ** attempt
            log.info(f"Retrying in {wait_time}s...")
            await asyncio.sleep(wait_time)

    log.error(f"All {retries} attempts failed for {url}")
    return None


def extract_video_id(entry: dict) -> str:
    """Extract the YouTube video ID from a feed entry."""
    # YouTube RSS entries have 'yt:video:VIDEO_ID' as the id
    video_id = entry.get("yt_videoid", "")
    if not video_id:
        # Fallback: extract from the link
        link = entry.get("link", "")
        if "v=" in link:
            video_id = link.split("v=")[-1].split("&")[0]
        elif "youtu.be/" in link:
            video_id = link.split("youtu.be/")[-1].split("?")[0]
    return video_id


def extract_post_id(entry: dict) -> str:
    """Extract a unique post identifier from an RSS entry."""
    # Try multiple fields for uniqueness
    return entry.get("id", entry.get("link", entry.get("guid", "")))
