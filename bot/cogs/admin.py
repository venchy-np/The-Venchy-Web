"""
Venchy Bot — Admin Cog
General admin commands: status, sync, help.
"""

import discord
from discord import app_commands
from discord.ext import commands
from datetime import datetime
import platform

from bot.firebase_client import get_youtube_feeds, get_instagram_feeds
from bot.utils.embeds import build_info_embed, build_success_embed
from bot.utils.logger import get_logger

log = get_logger("admin")

# Track bot start time for uptime calculation
START_TIME = datetime.utcnow()


class AdminCog(commands.Cog):
    """General admin and utility commands."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    # ── /status — Bot status overview ───────────────────────────
    @app_commands.command(name="status", description="View Venchy Bot's current status and stats")
    async def status(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        # Calculate uptime
        uptime = datetime.utcnow() - START_TIME
        hours, remainder = divmod(int(uptime.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        uptime_str = f"{hours}h {minutes}m {seconds}s"

        # Get feed counts for this guild
        yt_feeds = await get_youtube_feeds(interaction.guild_id)
        ig_feeds = await get_instagram_feeds(interaction.guild_id)

        # Get YouTube cog polling info
        yt_cog = self.bot.get_cog("YouTubeCog")
        ig_cog = self.bot.get_cog("InstagramCog")

        yt_status = "🟢 Running" if yt_cog and yt_cog.youtube_poll_task.is_running() else "🔴 Stopped"
        ig_status = "🟢 Running" if ig_cog and ig_cog.instagram_poll_task.is_running() else "🔴 Stopped"

        embed = discord.Embed(
            title="⚡ Venchy Bot Status",
            color=0x9B59B6,
            timestamp=datetime.utcnow(),
        )

        embed.add_field(
            name="🤖 Bot Info",
            value=(
                f"**Latency:** {round(self.bot.latency * 1000)}ms\n"
                f"**Uptime:** {uptime_str}\n"
                f"**Servers:** {len(self.bot.guilds)}\n"
                f"**Python:** {platform.python_version()}\n"
                f"**discord.py:** {discord.__version__}"
            ),
            inline=True,
        )

        embed.add_field(
            name="📊 This Server",
            value=(
                f"**YouTube Feeds:** {len(yt_feeds)}\n"
                f"**Instagram Feeds:** {len(ig_feeds)}\n"
                f"**Total Feeds:** {len(yt_feeds) + len(ig_feeds)}"
            ),
            inline=True,
        )

        embed.add_field(
            name="⚙️ Polling Status",
            value=(
                f"**YouTube:** {yt_status}\n"
                f"**Instagram:** {ig_status}"
            ),
            inline=False,
        )

        embed.set_footer(text="Venchy Bot • Made with ❤️")

        await interaction.followup.send(embed=embed, ephemeral=True)

    # ── /sync_meta — Force sync guild metadata ────────────────────
    @app_commands.command(name="sync_meta", description="Force sync this server's channels and roles to the dashboard")
    @app_commands.default_permissions(administrator=True)
    async def sync_meta(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        events_cog = self.bot.get_cog("EventsCog")
        if not events_cog:
            await interaction.followup.send("❌ Internal Error: EventsCog not found.", ephemeral=True)
            return

        try:
            await events_cog.sync_guild_metadata(interaction.guild)
            await interaction.followup.send(
                embed=build_success_embed(
                    "Metadata Synced",
                    "Successfully synced all **channels** and **roles** to the dashboard Firestore."
                ),
                ephemeral=True,
            )
        except Exception as e:
            log.error(f"Failed to sync metadata: {e}")
            await interaction.followup.send(
                content=f"❌ Failed to sync metadata: {e}",
                ephemeral=True,
            )

    # ── /sync — Force sync slash commands ───────────────────────
    @app_commands.command(name="sync", description="Force sync slash commands (bot owner only)")
    @app_commands.default_permissions(administrator=True)
    async def sync_commands(self, interaction: discord.Interaction):
        await interaction.response.defer(ephemeral=True)

        try:
            synced = await self.bot.tree.sync()
            log.info(f"Synced {len(synced)} commands by {interaction.user}")
            await interaction.followup.send(
                embed=build_success_embed(
                    "Commands Synced",
                    f"Successfully synced **{len(synced)}** slash commands globally.\n"
                    "It may take up to an hour for changes to appear everywhere."
                ),
                ephemeral=True,
            )
        except Exception as e:
            log.error(f"Failed to sync commands: {e}")
            await interaction.followup.send(
                content=f"❌ Failed to sync commands: {e}",
                ephemeral=True,
            )

    # ── /help — Command overview ────────────────────────────────
    @app_commands.command(name="help", description="View all Venchy Bot commands")
    async def help_command(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="📖 Venchy Bot Commands",
            description="Here are all available commands:",
            color=0x9B59B6,
            timestamp=datetime.utcnow(),
        )

        embed.add_field(
            name="📺 YouTube",
            value=(
                "`/yt add` — Add a YouTube channel to monitor\n"
                "`/yt remove` — Stop monitoring a YouTube channel\n"
                "`/yt list` — List all monitored channels\n"
                "`/yt test` — Send a test notification"
            ),
            inline=False,
        )

        embed.add_field(
            name="📸 Instagram",
            value=(
                "`/insta add` — Add an Instagram RSS feed\n"
                "`/insta remove` — Remove an Instagram feed\n"
                "`/insta list` — List all monitored feeds"
            ),
            inline=False,
        )

        embed.add_field(
            name="⚙️ General",
            value=(
                "`/status` — View bot status and stats\n"
                "`/sync` — Force sync slash commands (admin)\n"
                "`/sync_meta` — Force sync dashboard metadata (admin)\n"
                "`/help` — Show this help menu"
            ),
            inline=False,
        )

        embed.add_field(
            name="🌐 Web Dashboard",
            value="[Open Dashboard](https://www.sajandhl.qzz.io/venchybot)",
            inline=False,
        )

        embed.set_footer(text="Venchy Bot • All feed commands require Administrator permission")

        await interaction.response.send_message(embed=embed, ephemeral=True)


async def setup(bot: commands.Bot):
    """Add the Admin cog to the bot."""
    await bot.add_cog(AdminCog(bot))
