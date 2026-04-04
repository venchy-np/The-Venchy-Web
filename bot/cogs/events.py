"""
Venchy Bot — Events Cog
Handles bot lifecycle events: on_ready, guild join/remove.
"""

import discord
from discord.ext import commands
from bot.firebase_client import db
from bot.utils.logger import get_logger

log = get_logger("events")


class EventsCog(commands.Cog):
    """Bot event handlers."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_ready(self):
        log.info("=" * 50)
        log.info(f"Venchy Bot is online!")
        log.info(f"   User: {self.bot.user} (ID: {self.bot.user.id})")
        log.info(f"   Servers: {len(self.bot.guilds)}")
        log.info(f"   Latency: {round(self.bot.latency * 1000)}ms")
        log.info("=" * 50)

        activity = discord.Activity(
            type=discord.ActivityType.watching,
            name="YouTube & Instagram"
        )
        await self.bot.change_presence(
            status=discord.Status.online,
            activity=activity,
        )

        log.info("Syncing metadata for all guilds...")
        for guild in self.bot.guilds:
            try:
                await self.sync_guild_metadata(guild)
            except Exception as e:
                log.error(f"  [FAIL] Failed to sync metadata for {guild.name}: {e}")
        log.info("Finished syncing all guilds.")

    async def sync_guild_metadata(self, guild: discord.Guild):
        """Syncs guild channels and roles to Firestore."""
        from bot.firebase_client import set_guild_meta

        # Get text channels
        channels = [
            {"id": str(c.id), "name": c.name, "type": str(c.type)}
            for c in guild.text_channels
        ]
        
        # Sort roles by position (highest first) and exclude @everyone
        roles = [
            {"id": str(r.id), "name": r.name}
            for r in sorted(guild.roles, key=lambda x: x.position, reverse=True)
            if not r.is_default()
        ]

        await set_guild_meta(guild.id, channels, roles)
        log.debug(f"Synced {len(channels)} channels and {len(roles)} roles for {guild.name}")

    @commands.Cog.listener()
    async def on_guild_join(self, guild: discord.Guild):
        log.info(f"Joined new server: {guild.name} (ID: {guild.id}, Members: {guild.member_count})")

        # Basic guild info
        guild_ref = db.collection("guilds").document(str(guild.id))
        guild_ref.set({
            "guild_id": str(guild.id),
            "guild_name": guild.name,
            "member_count": guild.member_count,
            "joined_at": discord.utils.utcnow().isoformat(),
        }, merge=True)

        # Sync metadata (channels/roles) for the dashboard
        await self.sync_guild_metadata(guild)

        if guild.system_channel and guild.system_channel.permissions_for(guild.me).send_messages:
            embed = discord.Embed(
                title="Hey there! I'm Venchy Bot!",
                description=(
                    "Thanks for adding me! I'll keep your server updated with "
                    "the latest YouTube uploads and Instagram posts.\n\n"
                    "**Get started:**\n"
                    "`/yt add` - Monitor a YouTube channel\n"
                    "`/insta add` - Monitor an Instagram feed\n"
                    "`/help` - See all commands\n\n"
                    "**Dashboard:** [sajandhl.qzz.io/venchybot](https://www.sajandhl.qzz.io/venchybot)"
                ),
                color=0x9B59B6,
            )
            embed.set_footer(text="All feed commands require Administrator permission")
            try:
                await guild.system_channel.send(embed=embed)
            except discord.Forbidden:
                pass

    @commands.Cog.listener()
    async def on_guild_remove(self, guild: discord.Guild):
        log.info(f"Removed from server: {guild.name} (ID: {guild.id})")

    # -- Real-time Metadata Sync ---------------------------------------

    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel):
        if isinstance(channel, discord.TextChannel):
            await self.sync_guild_metadata(channel.guild)

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel):
        if isinstance(channel, discord.TextChannel):
            await self.sync_guild_metadata(channel.guild)

    @commands.Cog.listener()
    async def on_guild_channel_update(self, before, after):
        if isinstance(after, discord.TextChannel) and before.name != after.name:
            await self.sync_guild_metadata(after.guild)

    @commands.Cog.listener()
    async def on_guild_role_create(self, role):
        await self.sync_guild_metadata(role.guild)

    @commands.Cog.listener()
    async def on_guild_role_delete(self, role):
        await self.sync_guild_metadata(role.guild)

    @commands.Cog.listener()
    async def on_guild_role_update(self, before, after):
        if before.name != after.name:
            await self.sync_guild_metadata(after.guild)


async def setup(bot: commands.Bot):
    await bot.add_cog(EventsCog(bot))
