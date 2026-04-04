import os
import aiohttp
from aiohttp import web
from firebase_admin import auth
from bot.utils.logger import get_logger
from bot.config import config

log = get_logger("api")

# Permission bitmask for 'MANAGE_GUILD'
MANAGE_GUILD = 0x20

async def handle_auth(request):
    """
    Exchanges a Discord access_token for a Firebase Custom Token
    and a list of manageable guilds.
    """
    try:
        data = await request.json()
        access_token = data.get("access_token")

        if not access_token:
            return web.json_response({"error": "Missing access_token"}, status=400)

        async with aiohttp.ClientSession() as session:
            # 1. Get Discord User Profile
            headers = {"Authorization": f"Bearer {access_token}"}
            async with session.get("https://discord.com/api/v10/users/@me", headers=headers) as resp:
                if resp.status != 200:
                    return web.json_response({"error": "Invalid Discord token"}, status=401)
                user_data = await resp.json()
                discord_id = user_data["id"]

            # 2. Get Discord User Guilds
            async with session.get("https://discord.com/api/v10/users/@me/guilds", headers=headers) as resp:
                if resp.status != 200:
                    guilds_data = []
                else:
                    guilds_data = await resp.json()

        # 3. Filter guilds where user has MANAGE_GUILD permission
        manageable_guilds = []
        for guild in guilds_data:
            perms = int(guild.get("permissions", "0"))
            if (perms & MANAGE_GUILD) == MANAGE_GUILD:
                manageable_guilds.append({
                    "id": guild["id"],
                    "name": guild["name"],
                    "icon": guild.get("icon")
                })

        # 4. Generate Firebase Custom Token
        custom_token = auth.create_custom_token(discord_id).decode("utf-8")

        return web.json_response({
            "firebase_token": custom_token,
            "guilds": manageable_guilds,
            "user": {
                "id": discord_id,
                "username": user_data.get("username"),
                "avatar": user_data.get("avatar")
            }
        })

    except Exception as e:
        log.error(f"Auth error: {e}")
        return web.json_response({"error": str(e)}, status=500)


def create_app():
    app = web.Application()
    
    # Simple CORS middleware
    async def cors_middleware(app, handler):
        async def middleware(request):
            if request.method == "OPTIONS":
                response = web.Response(status=204)
            else:
                try:
                    response = await handler(request)
                except web.HTTPException as ex:
                    response = ex
                except Exception as e:
                    log.error(f"Unhandled exception in API: {e}")
                    response = web.json_response({"error": str(e)}, status=500)
            
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = "POST, GET, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            return response
        return middleware

    app.middlewares.append(cors_middleware)
    
    app.router.add_post("/auth", handle_auth)
    
    return app

async def start_api_server(port=None):
    if port is None:
        port = int(os.environ.get("PORT", 8080))
    
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", port)
    
    log.info(f"API Server starting on port {port}...")
    await site.start()
