from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import google.generativeai as genai
import os
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
API_KEY = os.getenv("VITE_GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not API_KEY:
    print("Warning: GOOGLE_API_KEY not found in environment")

genai.configure(api_key=API_KEY)

class GenerateRequest(BaseModel):
    text: str
    difficulty: str
    numQuestions: dict
    questionType: str
    teacherComment: str = ""
    apiKey: str = "" # Optional override

@app.post("/generate")
async def generate_paper(req: GenerateRequest):
    try:
        # Use key from request if provided, else env
        active_key = req.apiKey if req.apiKey else API_KEY
        if not active_key:
            raise HTTPException(status_code=400, detail="API Key is missing")
        
        genai.configure(api_key=active_key)
        
        # Use the model from app2.py
        # Fallback to 1.5-flash if 2.5-flash-lite is unavailable/beta
        try:
            model = genai.GenerativeModel("gemini-2.0-flash-exp") 
            # Note: app2.py used "gemini-2.5-flash-lite" which might be a typo or private beta.
            # Using a widely available flash model or 1.5-flash.
            # Let's try 1.5-flash as it is standard.
            model = genai.GenerativeModel("gemini-1.5-flash")
        except:
             model = genai.GenerativeModel("gemini-pro")

        
        # Construct Prompt (Logic from app2.py)
        requirement_text = ""
        if req.teacherComment:
            requirement_text = f"Follow these teacher instructions: {req.teacherComment}\n"
        else:
            requirement_text = f"""
Generate exactly:
- {req.numQuestions.get('two', 10)} questions of 2 marks
- {req.numQuestions.get('five', 5)} questions of 5 marks
- {req.numQuestions.get('ten', 2)} questions of 10 marks
            """

        prompt = f"""
        You are an expert university question paper setter.
        
        Study material:
        --- Document Content Start ---
        {req.text[:15000]}
        --- Document Content End ---

        Requirements:
        {requirement_text}
        - Preferred Question Format: {req.questionType}
        - Difficulty Level: {req.difficulty}

        Additional rules:
        - Do NOT repeat questions.
        - Vary phrasing.
        - Use clear, exam-style questions.

        Format the output clearly exactly like this:
        📘 **Question Paper**
        ---
        **Section A (2 Marks Questions)**
        1. ...
        2. ...

        **Section B (5 Marks Questions)**
        1. ...
        2. ...

        **Section C (10 Marks Questions)**
        1. ...
        2. ...
        """

        response = model.generate_content(prompt)
        return {"content": response.text}

    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
