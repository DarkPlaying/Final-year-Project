# implementation Plan: AI CSV Generator Bot

This guide outlines the steps to integrate an AI Bot into your Student Dashboard that can create and edit CSV files based on user prompts.

## Overview
The goal is to allow a user (likely a teacher) to type a prompt (e.g., "Generate a list of 10 students with random marks" or "Calculate grades for this CSV data") and receive a downloadable CSV file.

## Approaches

### Option 1: Frontend-Only (Fastest)
Use the Google Gemini API (or OpenAI) directly in your React application.
- **Pros**: No need to deploy a new backend server; quick availability.
- **Cons**: API Key is exposed to the client (can be mitigated with restricted keys or Firebase Functions).

### Option 2: Python Backend (Your existing method)
Update your existing Hugging Face Space (`darkplayer23-question-paper-generator`) to include a new "CSV Agent".
- **Pros**: Your Python code is hidden; you can use Python's powerful `pandas` library for CSV manipulation.
- **Cons**: Requires updating and redeploying your external Python project.

---

## Recommended Path: Option 1 (Frontend + Gemini API)
Since you are using React and Firebase, integrating the **Gemini API** is straightforward and powerful for this task.

### Step 1: Get an API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Create a new API Key.
3. Add it to your `.env` file: `VITE_GEMINI_API_KEY=your_key_here`.

### Step 2: Create the Bot Component
Create a new file `src/components/CsvGenBot.tsx`.

#### Key Features:
- **Chat Interface**: Text area for user prompts.
- **Result Preview**: Display the generated data in a table before downloading.
- **Download Button**: Button to save the data as `.csv`.

### Step 3: Implement the Logic
Use the Google Generative AI SDK (`@google/generative-ai`).

**Prompt Engineering Strategy**:
You must instruct the AI to return *only* the CSV data, or a JSON object that can be easily converted.

*System Prompt Example:*
> "You are a data assistant. Your job is to generate tabular data based on the user's request. Output ONLY valid CSV content (comma-separated values). Do not output markdown code blocks. The first line must be the headers."

### Step 4: Add to Dashboard
Import the component into `TeacherDashboard.tsx` (or Student Dashboard) and create a new tab/route for it.

---

## Technical Details (React Implementation)

**Dependencies**:
- `npm install @google/generative-ai`

**Sample Code Structure**:
```tsx
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const handleGenerate = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const result = await model.generateContent(`
    Generate CSV data for: ${prompt}.
    Output STRICTLY CSV format errors. 
    No markdown formatting.
  `);
  const text = result.response.text();
  // ... process text -> download CSV
}
```

## Next Steps
1. Confirm if you want to use **Google Gemini** (Free tier available) or **OpenAI** (Paid).
2. Confirm if you want to implement this directly in the **Dashboard** or update your **Hugging Face Python app**.
3. I can generate the full code for the `CsvGenBot` component right now if you wish.
