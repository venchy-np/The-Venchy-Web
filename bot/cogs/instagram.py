"""
Venchy Bot — Instagram Cog
Slash commands for managing Instagram RSS feeds + background polling task.
"""

import discord
from discord import app_commands
from discord.ext import commands, tasks
from datetime import datetime

from bot.firebase_client import (
    get_instagram_feeds,
    add_instagram_feed,
    remove_instagram_feed,
    update_instagram_last_posts,
    get_all_instagram_feeds_global,
)
from bot.utils.rss_parser import fetch_feed, extract_post_id
from bot.utils.embeds import (
    build_instagram_embed,
    build_success_embed,
    build_error_embed,
    build_list_embed,
)
from bot.utils.logger import get_logger
from bot.config import config

log = get_logger("instagram")


class InstagramCog(commands.Cog):
    """Instagram RSS feed management and notification polling."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    async def cog_load(self):
        """Start the polling task when the cog loads."""
        self.instagram_poll_task.start()
        log.info("Instagram polling task started")

    async def cog_unload(self):
        """Stop the polling task when the cog unloads."""
        self.instagram_poll_task.cancel()
        log.info("Instagram polling task stopped")

    # ── Slash Command Group ─────────────────────────────────────
    insta_group = app_commands.Group(
        name="insta",
        description="Manage Instagram feed notifications",
        default_permissions=discord.Permissions(administrator=True),
    )

    @insta_group.command(name="add", description="Add an Instagram RSS feed to monitor for new posts")
    @app_commands.describe(
        rss_url="The RSS feed URL (from RSS.app or similar service)",
        label="A friendly name/label for this feed (e.g., 'my_brand')",
        discord_channel="The Discord channel to send notifications to (defaults to current)",
        ping_role="Role to ping when a new post is detected (optional)",
    )
    async def insta_add(
        self,
        interaction: discord.Interaction,
        rss_url: str,
        label: str,
        discord_channel: discord.TextChannel = None,
        ping_role: discord.Role = None,
    ):
        await interaction.response.defer(ephemeral=True)

        target_channel = discord_channel or interaction.channel

        # Validate URL format
        if not rss_url.startswith("http"):
            await interaction.followup.send(
                embed=build_error_embed(
                    "Invalid URL",
                    "Please provide a valid RSS feed URL starting with `http://` or `https://`\n\n"
                    "💡 **How to get an Instagram RSS feed:**\n"
                    "1. Go to [RSS.app](https://rss.app)\n"
                    "2. Paste the Instagram profile URL\n"
                    "3. Copy the generated RSS feed URL"
                ),
                ephemeral=True,
            )
            return

        # Sanitize label (use as document ID)
        safe_label = label.lower().replace(" ", "_").replace("/", "_")[:50]

        # Verify the RSS feed is accessible
        feed = await fetch_feed(rss_url, retries=2)

        if feed is None:
            await interaction.followup.send(
                embed=build_error_embed(
                    "Feed Error",
                    f"Could not fetch the RSS feed at:\n`{rss_url}`\n\n"
                    "Please check the URL and ensure it's a valid RSS feed."
                ),
                ephemeral=True,
            )
            return

        # Get current post IDs to avoid sending old posts as notifications
        current_post_ids = [extract_post_id(entry) for entry in feed.entries[:10]] if feed.entries else []

        feed_data = {
            "rss_url": rss_url,
            "label": safe_label,
            "display_name": label,
            "discord_channel_id": str(target_channel.id),
            "ping_role_id": str(ping_role.id) if ping_role else None,
            "last_post_ids": current_post_ids,
            "added_at": datetime.utcnow().isoformat(),
            "added_by": str(interaction.user.id),
        }

        await add_instagram_feed(interaction.guild_id, safe_label, feed_data)

        log.info(f"Added Instagram feed: {label} in guild {interaction.guild_id}")

        posts_found = len(current_post_ids)
        await interaction.followup.send(
            embed=build_success_embed(
                "Instagram Feed Added",
                f"**{label}** is now being monitored!\n\n"
                f"📸 Label: `{safe_label}`\n"
                f"🔗 RSS URL: `{rss_url[:60]}...`\n"
                f"📢 Notifications: {target_channel.mention}\n"
                f"🔔 Role Ping: {ping_role.mention if ping_role else 'None'}\n"
                f"⏱️ Polling: Every {config.INSTAGRAM_POLL_INTERVAL} minutes\n"
                f"📊 Indexed {posts_found} existing post(s)\n\n"
                f"*Only new posts will trigger notifications.*"
            ),
            ephemeral=True,
        )

    @insta_group.command(name="remove", description="Stop monitoring an Instagram feed")
    @app_commands.describe(label="The label of the Instagram feed to remove")
    async def insta_remove(self, interaction: discord.Interaction, label: str):
        await interaction.response.defer(ephemeral=True)

        safe_label = label.lower().replace(" ", "_").replace("/", "_")[:50]
        removed = await remove_instagram_feed(interaction.guild_id, safe_label)

        if removed:
            log.info(f"Removed Instagram feed: {safe_label} from guild {interaction.guild_id}")
            await interaction.followup.send(
                embed=build_success_embed(
                    "Instagram Feed Removed",
                    f"Feed `{safe_label}` has been removed from monitoring."
                ),
                ephemeral=True,
            )
        else:
            await interaction.followup.send(
                embed=build_error_embed(
                    "Not Found",
                    f"No Instagram feed found with label: `{safe_label}`\n"
                    "Use `/insta list` to see all active feeds."
                ),
                ephemeral=True,
            )

    @insta_group.command(name="list", description="List all monitored Instagram feeds")
    async def insta_list(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        feeds = await get_instagram_feeds(interaction.guild_id)

        items = []
        for feed in feeds:
            channel_mention = f"<#{feed.get('discord_channel_id', 'unknown')}>"
            role_info = f"<@&{feed['ping_role_id']}>" if feed.get("ping_role_id") else "No ping"
            rss_preview = feed.get("rss_url", "N/A")[:50] + "..."
            items.append(
                f"📸 **{feed.get('display_name', feed.get('label', 'Unknown'))}**\n"
                f"   Label: `{feed.get('label', 'N/A')}` • "
                f"Notifications: {channel_mention} • "
                f"Ping: {role_info}\n"
                f"   RSS: `{rss_preview}`"
            )

        await interaction.followup.send(
            embed=build_list_embed(
                "Instagram Feeds",
                items,
                empty_message="No Instagram feeds are being monitored.\nUse `/insta add` to get started!"
            ),
            ephemeral=True,
        )

    # ── Background Polling Task ─────────────────────────────────
    @tasks.loop(minutes=config.INSTAGRAM_POLL_INTERVAL)
    async def instagram_poll_task(self):
        """Poll all Instagram RSS feeds across all guilds for new posts."""
        try:
            all_feeds = await get_all_instagram_feeds_global()

            if not all_feeds:
                return

            log.info(f"Polling {len(all_feeds)} Instagram feed(s)...")

            for feed_data in all_feeds:
                try:
                    # Skip if the bot is no longer in this guild
                    guild_id = feed_data.get("guild_id")
                    if guild_id and not self.bot.get_guild(int(guild_id)):
                        continue

                    await self._check_instagram_feed(feed_data)
                except Exception as e:
                    log.error(
                        f"Error checking Instagram feed {feed_data.get('label', '?')}: {e}"
                    )

        except Exception as e:
            log.error(f"Instagram polling task error: {e}")

    @instagram_poll_task.before_loop
    async def before_instagram_poll(self):
        """Wait until the bot is ready before starting."""
        await self.bot.wait_until_ready()
        log.info("Instagram poller is ready")

    @instagram_poll_task.error
    async def instagram_poll_error(self, error):
        """Handle polling task errors to prevent the task from dying."""
        log.error(f"Instagram polling task crashed: {error}")

    async def _check_instagram_feed(self, feed_data: dict):
        """Check a single Instagram RSS feed for new posts."""
        label = feed_data.get("label")
        guild_id = feed_data.get("guild_id")
        rss_url = feed_data.get("rss_url")
        discord_channel_id = feed_data.get("discord_channel_id")
        ping_role_id = feed_data.get("ping_role_id")
        last_post_ids = feed_data.get("last_post_ids", [])
        display_name = feed_data.get("display_name", label)

        feed = await fetch_feed(rss_url)

        if feed is None or not feed.entries:
            return

        # Check for new posts
        new_entries = []
        for entry in feed.entries[:10]:
            post_id = extract_post_id(entry)
            if post_id and post_id not in last_post_ids:
                new_entries.append(entry)

        if not new_entries:
            return

        # Get the Discord channel
        discord_channel = self.bot.get_channel(int(discord_channel_id))
        if not discord_channel:
            log.warning(f"Discord channel {discord_channel_id} not found for guild {guild_id}")
            return

        # Send notifications for new posts (oldest first)
        for entry in reversed(new_entries):
            post_url = entry.get("link", "")
            caption = entry.get("title", entry.get("summary", ""))
            published = entry.get("published", "")

            # Try to extract image URL from various RSS feed formats
            image_url = None
            # Check for media content
            if hasattr(entry, "media_content") and entry.media_content:
                image_url = entry.media_content[0].get("url")
            # Check for media thumbnail
            elif hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
                image_url = entry.media_thumbnail[0].get("url")
            # Check for enclosures
            elif entry.get("enclosures"):
                for enc in entry.enclosures:
                    if enc.get("type", "").startswith("image"):
                        image_url = enc.get("href", enc.get("url"))
                        break

            embed = build_instagram_embed(
                post_url=post_url,
                caption=caption if caption else None,
                image_url=image_url,
                author_name=display_name,
                published_date=published if published else None,
            )

            # Build message content with optional role ping
            content = ""
            if ping_role_id:
                content = f"<@&{ping_role_id}>"

            try:
                await discord_channel.send(content=content, embed=embed)
                log.info(f"[IG] Sent notification: {display_name} - {post_url[:60]}")
            except discord.Forbidden:
                log.error(f"Missing permissions to send to channel {discord_channel_id}")
            except Exception as e:
                log.error(f"Failed to send Instagram notification: {e}")

        # Update stored post IDs
        current_ids = [extract_post_id(e) for e in feed.entries[:10]]
        await update_instagram_last_posts(guild_id, label, current_ids)


async def setup(bot: commands.Bot):
    """Add the Instagram cog to the bot."""
    await bot.add_cog(InstagramCog(bot))
