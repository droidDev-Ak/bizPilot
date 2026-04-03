import os
import json
import asyncio
import traceback
from pathlib import Path
from telegram import Update
from telegram.ext import ContextTypes, ApplicationBuilder, MessageHandler, filters

AGENTS_DIR = Path(__file__).resolve().parent / "generated_agents"
REGISTRY_FILE = AGENTS_DIR / "registry.json"

def load_registry() -> list:
    if REGISTRY_FILE.exists():
        return json.loads(REGISTRY_FILE.read_text(encoding="utf-8"))
    return []

def detect_llm(pref: str = "groq"):
    """Returns (api_key, gemini_key, base_url, model_name, api_type, provider_label)"""
    groq_key = os.getenv("GROQ_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    openai_key = os.getenv("OPENAI_API_KEY", "")

    if openai_key and openai_key.startswith("AIza"):
        gemini_key = openai_key
        openai_key = ""

    if groq_key and (pref.lower() == "groq" or not pref):
        return groq_key, "", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", None, "Groq (Llama 3.3)"
    elif gemini_key and (pref.lower() == "gemini" or not pref):
        return "", gemini_key, None, "gemini-1.5-flash", "google", "Google Gemini (1.5 Flash)"
    elif groq_key:
         return groq_key, "", "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile", None, "Groq (Llama 3.3)"
    elif gemini_key:
         return "", gemini_key, None, "gemini-1.5-flash", "google", "Google Gemini (1.5 Flash)"
    elif openai_key and openai_key.startswith("nvapi-"):
        return openai_key, "", "https://integrate.api.nvidia.com/v1", "meta/llama-3.1-70b-instruct", None, "NVIDIA NIM"
    return "", "", None, "", None, "None"

async def run_autogen_inference(user_text: str, agent_id: str) -> str:
    try:
        registry = load_registry()
        entry = next((a for a in registry if a["agent_id"] == agent_id), None)
        system_msg = entry["prompt"] if entry else "You are a helpful customer support agent."
        system_msg += "\n\n[CRITICAL INSTRUCTION: Keep your responses highly concise and suitable for a mobile text messaging application.]"
        pref = "groq" if (entry and "Groq" in entry.get("provider", "")) else "gemini"

        api_key, gemini_key, base_url, model_name, api_type, provider = detect_llm(pref)

        # Run inference via litellm/openai sync package wrapped in asyncio
        from openai import OpenAI
        client = OpenAI(api_key=api_key or gemini_key, base_url=base_url)

        def make_call():
            return client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": user_text}
                ]
            )
        
        response = await asyncio.to_thread(make_call)
        return response.choices[0].message.content

    except Exception as e:
        traceback.print_exc()
        error_msg = str(e)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            return "⏳ Rate limit hit. Please wait a moment and try again."
        return f"System Error: Unable to process request. ({error_msg})"


async def handle_telegram_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_text = update.message.text
    chat_id = update.message.chat_id
    
    # Check if there's a specifically activated agent id configured for this bot instance
    agent_id = context.bot_data.get("active_agent_id", "")
    if not agent_id:
        registry = load_registry()
        agent_id = registry[-1]["agent_id"] if registry else ""
    
    # Typing action for UX
    try:
        await context.bot.send_chat_action(chat_id=chat_id, action="typing")
    except:
        pass
    
    if not agent_id:
        await update.message.reply_text("No active agent configured. Please deploy an agent from the dashboard.")
        return
        
    response_text = await run_autogen_inference(user_text, agent_id)
    await update.message.reply_text(response_text)


class TelegramBotManager:
    def __init__(self):
        self.app = None
        self.is_running = False

    async def start(self, token: str, agent_id: str = None):
        if self.is_running:
            await self.stop()
            
        try:
            self.app = ApplicationBuilder().token(token).build()
            if agent_id:
                self.app.bot_data["active_agent_id"] = agent_id
                
            self.app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_telegram_message))
            
            await self.app.initialize()
            await self.app.start()
            await self.app.updater.start_polling()
            self.is_running = True
            print(f"Telegram Bot started listening for agent {agent_id or 'latest'}.")
        except Exception as e:
            self.is_running = False
            print(f"Error starting Telegram Bot: {e}")
            raise e

    async def stop(self):
        if self.app and self.is_running:
            print("Stopping Telegram bot...")
            await self.app.updater.stop()
            await self.app.stop()
            await self.app.shutdown()
            self.is_running = False
            self.app = None

# Global instance
tg_manager = TelegramBotManager()
