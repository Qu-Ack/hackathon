from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential
from azure.ai.agents.models import ListSortOrder
import asyncio

load_dotenv()

if not os.getenv("AZURE_PROJECT_ENDPOINT") or not os.getenv("AZURE_AGENT_ID"):
    raise RuntimeError("Missing AZURE_PROJECT_ENDPOINT or AZURE_AGENT_ID in env")

project = AIProjectClient(
    credential=DefaultAzureCredential(),
    endpoint=os.getenv("AZURE_PROJECT_ENDPOINT")
)
agent = project.agents.get_agent(os.getenv("AZURE_AGENT_ID"))

app = FastAPI()

class ActivateRequest(BaseModel):
    content: str

async def run_agent_blocking(thread_id: str):
    return project.agents.runs.create_and_process(thread_id=thread_id, agent_id=agent.id)

def fetch_assistant_text(thread_id: str) -> str:
    messages = project.agents.messages.list(thread_id=thread_id, order=ListSortOrder.ASCENDING)
    response_text = ""
    for msg in messages:
        if msg.role == "assistant" and getattr(msg, "text_messages", None):
            response_text = msg.text_messages[-1].text.value
    return response_text

@app.post("/activate/background")
async def activate_background(req: ActivateRequest, bg: BackgroundTasks):
    if not req.content:
        raise HTTPException(status_code=400, detail="content is required")
    thread = project.agents.threads.create()
    project.agents.messages.create(thread_id=thread.id, role="user", content=req.content)
    bg.add_task(project.agents.runs.create_and_process, thread_id=thread.id, agent_id=agent.id)
    return {"status": "started", "thread_id": thread.id}

@app.post("/activate/wait")
async def activate_wait(req: ActivateRequest):
    if not req.content:
        raise HTTPException(status_code=400, detail="content is required")
    thread = project.agents.threads.create()
    project.agents.messages.create(thread_id=thread.id, role="user", content=req.content)
    loop = asyncio.get_running_loop()
    run = await loop.run_in_executor(None, lambda: project.agents.runs.create_and_process(thread_id=thread.id, agent_id=agent.id))
    if getattr(run, "status", None) == "failed":
        raise HTTPException(status_code=500, detail=f"run failed: {getattr(run,'last_error', 'unknown')}")
    text = await loop.run_in_executor(None, lambda: fetch_assistant_text(thread.id))
    return {"status": "completed", "thread_id": thread.id, "response": text}

@app.get("/threads/{thread_id}/result")
def thread_result(thread_id: str):
    text = fetch_assistant_text(thread_id)
    return {"thread_id": thread_id, "response": text}

