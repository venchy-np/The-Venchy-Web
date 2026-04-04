"""
Venchy Bot — Main Entry Point
Initializes the bot, loads cogs, and starts the event loop.
"""

import discord
from discord.ext import commands

from bot.config import config
from bot.api import start_api_server
from bot.utils.logger import get_logger

log = get_logger("main")


class VenchyBot(commands.Bot):
    """Custom bot class with cog loading and command syncing."""

    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.guilds = True
        intents.members = False

        super().__init__(
            command_prefix="!",
            intents=intents,
            help_command=None,
        )

    async def setup_hook(self):
        """Called before the bot connects -- load cogs and sync commands."""
        log.info("Loading cogs...")

        cog_modules = [
            "bot.cogs.events",
            "bot.cogs.admin",
            "bot.cogs.youtube",
            "bot.cogs.instagram",
        ]

        for cog in cog_modules:
            try:
                await self.load_extension(cog)
                log.info(f"  [OK] Loaded: {cog}")
            except Exception as e:
                log.error(f"  [FAIL] Failed to load {cog}: {e}")

        # Start the Auth API Server
        await start_api_server()

        log.info("Syncing slash commands...")
        try:
            synced = await self.tree.sync()
            log.info(f"  [OK] Synced {len(synced)} slash command(s)")
        except Exception as e:
            log.error(f"  [FAIL] Failed to sync commands: {e}")


def main():
    """Create and run the bot."""
    print("=" * 50)
    print("  Venchy Bot -- Starting up...")
    print("=" * 50)

    bot = VenchyBot()

    try:
        bot.run(config.DISCORD_TOKEN, log_handler=None)
    except discord.LoginFailure:
        log.error("[FAIL] Invalid Discord token! Please check your DISCORD_TOKEN.")
    except KeyboardInterrupt:
        log.info("Bot shutting down gracefully...")
    except Exception as e:
        log.error(f"[FAIL] Fatal error: {e}")


if __name__ == "__main__":
    main()
