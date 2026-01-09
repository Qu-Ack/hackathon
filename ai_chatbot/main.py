from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
import os

GEMINI_API_KEY = "AIzaSyAg3RpF6RSnM0u2R_BrdPtb3MVj1Y8fmnM"
os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = genai.Client()

class GenerateRequest(BaseModel):
    content: str
    model: str = "gemini-2.5-flash"

@app.post("/generate")
async def generate(req: GenerateRequest):
    try:
        response = client.models.generate_content(
            model=req.model,
            contents=req.content
        )
        return {"response": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
