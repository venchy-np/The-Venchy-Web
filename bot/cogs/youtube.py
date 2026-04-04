"""
Venchy Bot — YouTube Cog
Slash commands for managing YouTube feeds + background polling task.
"""

import discord
from discord import app_commands
from discord.ext import commands, tasks
from datetime import datetime

from bot.firebase_client import (
    get_youtube_feeds,
    add_youtube_feed,
    remove_youtube_feed,
    update_youtube_last_videos,
    get_all_youtube_feeds_global,
)
from bot.utils.rss_parser import fetch_feed, extract_video_id
from bot.utils.embeds import (
    build_youtube_embed,
    build_success_embed,
    build_error_embed,
    build_list_embed,
)
from bot.utils.logger import get_logger
from bot.config import config

log = get_logger("youtube")

YOUTUBE_RSS_URL = "https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"


class YouTubeCog(commands.Cog):
    """YouTube feed management and notification polling."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    async def cog_load(self):
        """Start the polling task when the cog loads."""
        self.youtube_poll_task.start()
        log.info("YouTube polling task started")

    async def cog_unload(self):
        """Stop the polling task when the cog unloads."""
        self.youtube_poll_task.cancel()
        log.info("YouTube polling task stopped")

    # ── Slash Command Group ─────────────────────────────────────
    yt_group = app_commands.Group(
        name="yt",
        description="Manage YouTube feed notifications",
        default_permissions=discord.Permissions(administrator=True),
    )

    @yt_group.command(name="add", description="Add a YouTube channel to monitor for new uploads")
    @app_commands.describe(
        channel_id="The YouTube channel ID (starts with UC...)",
        channel_name="A friendly name for this channel",
        discord_channel="The Discord channel to send notifications to (defaults to current)",
        ping_role="Role to ping when a new video is uploaded (optional)",
    )
    async def yt_add(
        self,
        interaction: discord.Interaction,
        channel_id: str,
        channel_name: str,
        discord_channel: discord.TextChannel = None,
        ping_role: discord.Role = None,
    ):
        await interaction.response.defer(ephemeral=True)

        target_channel = discord_channel or interaction.channel

        # Validate channel ID format
        if not channel_id.startswith("UC") or len(channel_id) < 20:
            await interaction.followup.send(
                embed=build_error_embed(
                    "Invalid Channel ID",
                    "YouTube channel IDs start with **UC** and are 24 characters long.\n"
                    "Example: `UCxxxxxxxxxxxxxxxxxxxxxx`\n\n"
                    "💡 **How to find it:** Go to the YouTube channel → View Page Source → "
                    "search for `channel_id` or use a Channel ID finder tool."
                ),
                ephemeral=True,
            )
            return

        # Verify the RSS feed is accessible
        rss_url = YOUTUBE_RSS_URL.format(channel_id=channel_id)
        feed = await fetch_feed(rss_url, retries=2)

        if feed is None or not feed.entries:
            await interaction.followup.send(
                embed=build_error_embed(
                    "Feed Not Found",
                    f"Could not fetch the RSS feed for channel ID: `{channel_id}`\n"
                    "Please double-check the channel ID and try again."
                ),
                ephemeral=True,
            )
            return

        # Get current video IDs to avoid sending old videos as notifications
        current_video_ids = [extract_video_id(entry) for entry in feed.entries[:10]]

        feed_data = {
            "channel_id": channel_id,
            "channel_name": channel_name,
            "discord_channel_id": str(target_channel.id),
            "ping_role_id": str(ping_role.id) if ping_role else None,
            "last_video_ids": current_video_ids,
            "added_at": datetime.utcnow().isoformat(),
            "added_by": str(interaction.user.id),
        }

        await add_youtube_feed(interaction.guild_id, channel_id, feed_data)

        log.info(f"Added YouTube feed: {channel_name} ({channel_id}) in guild {interaction.guild_id}")

        await interaction.followup.send(
            embed=build_success_embed(
                "YouTube Channel Added",
                f"**{channel_name}** is now being monitored!\n\n"
                f"📺 Channel ID: `{channel_id}`\n"
                f"📢 Notifications: {target_channel.mention}\n"
                f"🔔 Role Ping: {ping_role.mention if ping_role else 'None'}\n"
                f"⏱️ Polling: Every {config.YOUTUBE_POLL_INTERVAL} minutes\n\n"
                f"*Current videos have been indexed — only new uploads will trigger notifications.*"
            ),
            ephemeral=True,
        )

    @yt_group.command(name="remove", description="Stop monitoring a YouTube channel")
    @app_commands.describe(channel_id="The YouTube channel ID to remove")
    async def yt_remove(self, interaction: discord.Interaction, channel_id: str):
        await interaction.response.defer(ephemeral=True)

        removed = await remove_youtube_feed(interaction.guild_id, channel_id)

        if removed:
            log.info(f"Removed YouTube feed: {channel_id} from guild {interaction.guild_id}")
            await interaction.followup.send(
                embed=build_success_embed(
                    "YouTube Channel Removed",
                    f"Channel `{channel_id}` has been removed from monitoring."
                ),
                ephemeral=True,
            )
        else:
            await interaction.followup.send(
                embed=build_error_embed(
                    "Not Found",
                    f"No YouTube feed found with channel ID: `{channel_id}`"
                ),
                ephemeral=True,
            )

    @yt_group.command(name="list", description="List all monitored YouTube channels")
    async def yt_list(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        feeds = await get_youtube_feeds(interaction.guild_id)

        items = []
        for feed in feeds:
            channel_mention = f"<#{feed.get('discord_channel_id', 'unknown')}>"
            role_info = f"<@&{feed['ping_role_id']}>" if feed.get("ping_role_id") else "No ping"
            items.append(
                f"📺 **{feed.get('channel_name', 'Unknown')}**\n"
                f"   ID: `{feed.get('channel_id', 'N/A')}` • "
                f"Notifications: {channel_mention} • "
                f"Ping: {role_info}"
            )

        await interaction.followup.send(
            embed=build_list_embed(
                "YouTube Feeds",
                items,
                empty_message="No YouTube channels are being monitored.\nUse `/yt add` to get started!"
            ),
            ephemeral=True,
        )

    @yt_group.command(name="test", description="Send a test YouTube notification")
    @app_commands.describe(channel_id="The YouTube channel ID to test")
    async def yt_test(self, interaction: discord.Interaction, channel_id: str):
        await interaction.response.defer(ephemeral=True)

        rss_url = YOUTUBE_RSS_URL.format(channel_id=channel_id)
        feed = await fetch_feed(rss_url, retries=2)

        if feed is None or not feed.entries:
            await interaction.followup.send(
                embed=build_error_embed(
                    "Feed Error",
                    f"Could not fetch feed for `{channel_id}`"
                ),
                ephemeral=True,
            )
            return

        entry = feed.entries[0]
        video_id = extract_video_id(entry)
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        thumbnail = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
        channel_name = entry.get("author", "Unknown Channel")
        published = entry.get("published", "Unknown")

        embed = build_youtube_embed(
            video_title=entry.get("title", "Unknown Title"),
            video_url=video_url,
            channel_name=channel_name,
            thumbnail_url=thumbnail,
            published_date=published,
        )

        await interaction.followup.send(
            content="📺 **Test notification** — here's what a real notification looks like:",
            embed=embed,
            ephemeral=True,
        )

    # ── Background Polling Task ─────────────────────────────────
    @tasks.loop(minutes=config.YOUTUBE_POLL_INTERVAL)
    async def youtube_poll_task(self):
        """Poll all YouTube feeds across all guilds for new videos."""
        try:
            all_feeds = await get_all_youtube_feeds_global()

            if not all_feeds:
                return

            log.info(f"Polling {len(all_feeds)} YouTube feed(s)...")

            for feed_data in all_feeds:
                try:
                    # Skip if the bot is no longer in this guild
                    guild_id = feed_data.get("guild_id")
                    if guild_id and not self.bot.get_guild(int(guild_id)):
                        continue

                    await self._check_youtube_feed(feed_data)
                except Exception as e:
                    log.error(
                        f"Error checking YouTube feed {feed_data.get('channel_id', '?')}: {e}"
                    )

        except Exception as e:
            log.error(f"YouTube polling task error: {e}")

    @youtube_poll_task.before_loop
    async def before_youtube_poll(self):
        """Wait until the bot is ready before starting."""
        await self.bot.wait_until_ready()
        log.info("YouTube poller is ready")

    @youtube_poll_task.error
    async def youtube_poll_error(self, error):
        """Handle polling task errors to prevent the task from dying."""
        log.error(f"YouTube polling task crashed: {error}")
        # The task will automatically restart on the next iteration

    async def _check_youtube_feed(self, feed_data: dict):
        """Check a single YouTube feed for new videos."""
        channel_id = feed_data.get("channel_id")
        guild_id = feed_data.get("guild_id")
        discord_channel_id = feed_data.get("discord_channel_id")
        ping_role_id = feed_data.get("ping_role_id")
        last_video_ids = feed_data.get("last_video_ids", [])
        channel_name = feed_data.get("channel_name", "Unknown")

        rss_url = YOUTUBE_RSS_URL.format(channel_id=channel_id)
        feed = await fetch_feed(rss_url)

        if feed is None or not feed.entries:
            return

        # Check for new videos (entries not in last_video_ids)
        new_entries = []
        for entry in feed.entries[:10]:
            video_id = extract_video_id(entry)
            if video_id and video_id not in last_video_ids:
                new_entries.append(entry)

        if not new_entries:
            return

        # Get the Discord channel
        discord_channel = self.bot.get_channel(int(discord_channel_id))
        if not discord_channel:
            log.warning(f"Discord channel {discord_channel_id} not found for guild {guild_id}")
            return

        # Send notifications for new videos (oldest first)
        for entry in reversed(new_entries):
            video_id = extract_video_id(entry)
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            thumbnail = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
            published = entry.get("published", "Unknown")

            embed = build_youtube_embed(
                video_title=entry.get("title", "New Video"),
                video_url=video_url,
                channel_name=channel_name,
                thumbnail_url=thumbnail,
                published_date=published,
            )

            # Build message content with optional role ping
            content = ""
            if ping_role_id:
                content = f"<@&{ping_role_id}>"

            try:
                await discord_channel.send(content=content, embed=embed)
                log.info(f"[YT] Sent notification: {entry.get('title', '?')} ({video_id})")
            except discord.Forbidden:
                log.error(f"Missing permissions to send to channel {discord_channel_id}")
            except Exception as e:
                log.error(f"Failed to send YouTube notification: {e}")

        # Update stored video IDs
        current_ids = [extract_video_id(e) for e in feed.entries[:10]]
        await update_youtube_last_videos(guild_id, channel_id, current_ids)


async def setup(bot: commands.Bot):
    """Add the YouTube cog to the bot."""
    await bot.add_cog(YouTubeCog(bot))
