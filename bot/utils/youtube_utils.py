import re
import aiohttp
from bot.utils.logger import get_logger

log = get_logger("youtube_utils")

# Regex to find YouTube Channel IDs
YT_CHANNEL_ID_RE = re.compile(r'UC[a-zA-Z0-9_-]{22}')

async def resolve_youtube_id(input_str: str) -> dict:
    """
    Resolves a YouTube handle, URL, or ID into a canonical Channel ID and Name.
    Returns: {"id": "UC...", "name": "Channel Name", "thumbnail": "url"} or None
    """
    input_str = input_str.strip()
    
    # 1. If it's already a valid ID, we still want to fetch the name
    if YT_CHANNEL_ID_RE.fullmatch(input_str):
        return await _fetch_channel_info(f"https://www.youtube.com/channel/{input_str}")

    # 2. If it's a handle (starting with @)
    if input_str.startswith("@"):
        return await _fetch_channel_info(f"https://www.youtube.com/{input_str}")

    # 3. If it's a full URL
    if "youtube.com" in input_str or "youtu.be" in input_str:
        return await _fetch_channel_info(input_str)

    # 4. Try as a handle even if @ is missing
    if len(input_str) > 0 and " " not in input_str:
        return await _fetch_channel_info(f"https://www.youtube.com/@{input_str}")

    return None

async def _fetch_channel_info(url: str) -> dict:
    """Fetches YouTube page and extracts channel metadata."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(url, timeout=10) as response:
                if response.status != 200:
                    log.error(f"Failed to fetch YouTube page: {url} (Status: {response.status})")
                    return None
                
                html = await response.text()
                
                # Find Channel ID
                # Look for canonical link or meta tags
                match = YT_CHANNEL_ID_RE.search(html)
                if not match:
                    log.warning(f"Could not find Channel ID in HTML for: {url}")
                    return None
                
                channel_id = match.group(0)
                
                # Find Channel Name
                # Look for <meta property="og:title" content="...">
                name_match = re.search(r'<meta property="og:title" content="([^"]+)">', html)
                channel_name = name_match.group(1) if name_match else "Unknown Channel"
                
                # Find Thumbnail
                # Look for <meta property="og:image" content="...">
                thumb_match = re.search(r'<meta property="og:image" content="([^"]+)">', html)
                thumbnail = thumb_match.group(1) if thumb_match else ""
                
                return {
                    "id": channel_id,
                    "name": channel_name,
                    "thumbnail": thumbnail
                }
                
    except Exception as e:
        log.error(f"Error resolving YouTube link {url}: {e}")
        return None
