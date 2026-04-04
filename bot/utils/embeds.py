"""
Venchy Bot — Embed Builders Module
Rich Discord embed templates for YouTube and Instagram notifications.
"""

import discord
from datetime import datetime


# ── Color Palette ───────────────────────────────────────────────
YOUTUBE_RED = 0xFF0000
INSTAGRAM_PURPLE = 0xC13584
SUCCESS_GREEN = 0x2ECC71
ERROR_RED = 0xE74C3C
INFO_BLUE = 0x3498DB
WARNING_YELLOW = 0xF39C12


def build_youtube_embed(
    video_title: str,
    video_url: str,
    channel_name: str,
    thumbnail_url: str = None,
    published_date: str = None,
) -> discord.Embed:
    """
    Build a rich embed for a new YouTube video notification.
    """
    embed = discord.Embed(
        title=f"📺  {video_title}",
        url=video_url,
        description=(
            f"**{channel_name}** just uploaded a new video!\n\n"
            f"🔗 **[Watch Now]({video_url})**"
        ),
        color=YOUTUBE_RED,
        timestamp=datetime.utcnow(),
    )

    if thumbnail_url:
        embed.set_image(url=thumbnail_url)

    embed.set_author(
        name=f"🔴 New YouTube Upload",
        icon_url="https://www.youtube.com/s/desktop/f506bd45/img/favicon_144x144.png",
    )

    if published_date:
        embed.add_field(name="📅 Published", value=published_date, inline=True)

    embed.add_field(name="📺 Channel", value=channel_name, inline=True)

    embed.set_footer(
        text="Venchy Bot • YouTube Notifications",
        icon_url="https://www.youtube.com/s/desktop/f506bd45/img/favicon_144x144.png",
    )

    return embed


def build_instagram_embed(
    post_url: str,
    caption: str = None,
    image_url: str = None,
    author_name: str = "Instagram",
    published_date: str = None,
) -> discord.Embed:
    """
    Build a rich embed for a new Instagram post notification.
    """
    # Truncate caption if too long
    if caption and len(caption) > 300:
        caption = caption[:297] + "..."

    description = ""
    if caption:
        description = f"📝 *{caption}*\n\n"
    description += f"🔗 **[View Post]({post_url})**"

    embed = discord.Embed(
        title=f"📸  New Post from {author_name}",
        url=post_url,
        description=description,
        color=INSTAGRAM_PURPLE,
        timestamp=datetime.utcnow(),
    )

    if image_url:
        embed.set_image(url=image_url)

    embed.set_author(
        name="📸 New Instagram Post",
        icon_url="https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png",
    )

    if published_date:
        embed.add_field(name="📅 Posted", value=published_date, inline=True)

    embed.set_footer(
        text="Venchy Bot • Instagram Notifications",
        icon_url="https://www.instagram.com/static/images/ico/favicon-192.png/68d99ba29cc8.png",
    )

    return embed


def build_success_embed(title: str, description: str) -> discord.Embed:
    """Build a success response embed."""
    embed = discord.Embed(
        title=f"✅  {title}",
        description=description,
        color=SUCCESS_GREEN,
        timestamp=datetime.utcnow(),
    )
    embed.set_footer(text="Venchy Bot")
    return embed


def build_error_embed(title: str, description: str) -> discord.Embed:
    """Build an error response embed."""
    embed = discord.Embed(
        title=f"❌  {title}",
        description=description,
        color=ERROR_RED,
        timestamp=datetime.utcnow(),
    )
    embed.set_footer(text="Venchy Bot")
    return embed


def build_info_embed(title: str, description: str) -> discord.Embed:
    """Build an informational embed."""
    embed = discord.Embed(
        title=f"ℹ️  {title}",
        description=description,
        color=INFO_BLUE,
        timestamp=datetime.utcnow(),
    )
    embed.set_footer(text="Venchy Bot")
    return embed


def build_list_embed(title: str, items: list[str], empty_message: str = "No items found.") -> discord.Embed:
    """Build a list embed for displaying feeds."""
    if not items:
        description = f"*{empty_message}*"
    else:
        description = "\n".join(items)

    embed = discord.Embed(
        title=f"📋  {title}",
        description=description,
        color=INFO_BLUE,
        timestamp=datetime.utcnow(),
    )
    embed.set_footer(text=f"Venchy Bot • {len(items)} item(s)")
    return embed
