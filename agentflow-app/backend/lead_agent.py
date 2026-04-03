"""
Lead Agent - AutoGen Native B2B Lead Generator
-----------------------------------------------
This standalone script showcases an autonomous Agent finding
real-world B2B leads using the Apify API natively in Python.

Usage:
    python lead_agent.py
"""

import asyncio
import os
import sys
import json
import requests
import time
import argparse

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination, MaxMessageTermination
from autogen_agentchat.ui import Console
from autogen_ext.models.openai import OpenAIChatCompletionClient

# ── Tool Definitions ──────────────────────────────────────────────────
def fetch_google_map_leads(search_string: str, location_query: str, max_leads: int) -> str:
    """
    Trigger an Apify Actor to fetch Google Map business leads and return a summarized dataset string.
    
    Args:
        search_string (str): The type of business (e.g. 'restaurant')
        location_query (str): The physical location (e.g. 'New York, USA')
        max_leads (int): The max amount of leads to fetch
    """
    API_KEY = os.getenv("APIFY_API_KEY", "")
    if not API_KEY:
        return "Error: APIFY_API_KEY not found in environment."
    url = f"https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token={API_KEY}"
    
    input_data = {
        "searchStringsArray": [search_string],
        "locationQuery": location_query,
        "maxCrawledPlacesPerSearch": max_leads,
        "language": "en",
        "scrapeSocialMediaProfiles": {
            "facebooks": False, "instagrams": False, "youtubes": False, "tiktoks": False, "twitters": False
        },
        "maximumLeadsEnrichmentRecords": 0
    }
    
    print(f"\n[LeadScout Tool] 🚀 Deploying Lead Finder Agent for '{search_string}' in '{location_query}'...")
    res = requests.post(url, json=input_data).json()
    if 'error' in res:
        return f"Error: {res['error']['message']}"
    
    run_id = res['data']['id']
    dataset_id = res['data']['defaultDatasetId']
    
    print(f"[LeadScout Tool] ⏳ Analyzing geographic network (Task ID: {run_id})...")
    status = res['data']['status']
    while status not in ['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT']:
        time.sleep(3)
        status_res = requests.get(f"https://api.apify.com/v2/actor-runs/{run_id}?token={API_KEY}").json()
        status = status_res['data']['status']
    
    if status != 'SUCCEEDED':
        return f"Task failed with status: {status}"
        
    print("[LeadScout Tool] ✅ Enriching profiles and downloading dataset...")
    items_res = requests.get(f"https://api.apify.com/v2/datasets/{dataset_id}/items?token={API_KEY}").json()
    
    summary = []
    for item in items_res:
        summary.append({
            "Name": item.get('title', 'N/A'),
            "Rating": item.get('totalScore', 'N/A'),
            "Phone": item.get('phone', 'N/A'),
            "Address": item.get('address', 'N/A'),
            "Website": item.get('website', 'N/A')
        })
        
    return json.dumps(summary, indent=2)


# ── LLM Provider config ───────────────────────────────────────────────
def build_client(provider: str, api_key: str | None = None) -> OpenAIChatCompletionClient:
    PROVIDERS = {
        "groq": {
            "base_url": "https://api.groq.com/openai/v1",
            "model": "llama-3.3-70b-versatile",
            "api_key_env": "GROQ_API_KEY",
            "default_key": None,
        },
    }
    cfg = PROVIDERS.get(provider, PROVIDERS["groq"])
    key = api_key or os.getenv(cfg["api_key_env"]) or cfg.get("default_key")
    if not key:
        print(f"❌ No API key for {provider}.")
        sys.exit(1)

    print(f"🤖 Initializing LeadScout logic via {provider.upper()} ({cfg['model']})")
    return OpenAIChatCompletionClient(
        model=cfg["model"],
        base_url=cfg["base_url"],
        api_key=key,
        model_info={
            "vision": False,
            "function_calling": True,
            "json_output": True,
            "family": "unknown",
            "structured_output": True,
        },
    )


async def run_lead_agent(business_type: str, location: str, max_leads: int, target_file: str = "leads_report.md"):
    client = build_client("groq")

    # Agent 1: Lead Scout Agent
    scout = AssistantAgent(
        name="LeadScout",
        model_client=client,
        tools=[fetch_google_map_leads],
        system_message="""You are an AI Lead Scouting Agent.
1. Immediately use the `fetch_google_map_leads` tool to search for the specific business type and location requested.
2. Upon receiving the JSON results, simply pass them onward. Do not change the data.
""",
        description="An autonomous agent equipped with real-world crawling tools to retrieve leads.",
    )

    # Agent 2: Report Writer
    writer = AssistantAgent(
        name="ReportWriter",
        model_client=client,
        system_message="""You are a Data Compilation Agent.
Based strictly on the data generated by the LeadScout:
1. Format it into an extremely professional B2B lead sheet using Markdown formatting.
2. Use markdown tables to clearly display properties like Business Name, Phone, and Website.
3. Once the table is completed, end your message with the word 'TERMINATE'.
""",
        description="Creates professional markdown tables from raw lead data.",
    )

    termination = TextMentionTermination("TERMINATE") | MaxMessageTermination(10)

    team = RoundRobinGroupChat(
        participants=[scout, writer],
        termination_condition=termination,
    )

    task_prompt = f"Find {max_leads} high-quality leads for '{business_type}' in the area: '{location}'."
    
    print("\n" + "="*70)
    print(f"🎯 TASK: {task_prompt}")
    print("="*70 + "\n")

    stream = team.run_stream(task=task_prompt)
    result = await Console(stream)

    report_text = ""
    for msg in result.messages:
        if hasattr(msg, 'content') and isinstance(msg.content, str):
            report_text = msg.content

    with open(target_file, "w", encoding="utf-8") as f:
        f.write(f"# AutoGen Lead Report\n\n**Parameters:**\n- Market: {business_type}\n- Geography: {location}\n\n")
        f.write(report_text.replace("TERMINATE", "").strip())
        
    print(f"\n✅ Professional Lead Report generated and stored as: {os.path.abspath(target_file)}")
    await client.close()

def main():
    parser = argparse.ArgumentParser(description="AutoGen B2B Lead Generator")
    parser.add_argument("--business", type=str, default="cosmetics", help="Type of business to search")
    parser.add_argument("--location", type=str, default="delhi, india", help="Geographic target")
    parser.add_argument("--limit", type=int, default=4, help="Max leads to fetch")
    args = parser.parse_args()

    asyncio.run(run_lead_agent(args.business, args.location, args.limit))

if __name__ == "__main__":
    main()
