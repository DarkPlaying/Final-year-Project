import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Loader2, Upload, FileText, Download, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
// Initialize PDF.js worker
// Using unpkg as it more reliably serves the .mjs worker for modern pdfjs-dist versions
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
export const AITestGenerator = () => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [numTwo, setNumTwo] = useState('10');
  const [numFive, setNumFive] = useState('5');
  const [numTen, setNumTen] = useState('2');
  const [teacherComment, setTeacherComment] = useState('');
  const [questionType, setQuestionType] = useState('Mixed'); // Mixed, MCQ, Theory
  const [modelName, setModelName] = useState('gemini-2.5-flash-lite'); // Default model
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setExtractedText('');
    setGeneratedContent('');
    setIsExtracting(true);
    try {
      let text = '';
      if (selectedFile.type === 'application/pdf') {
        text = await extractTextFromPDF(selectedFile);
      } else if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await extractTextFromDOCX(selectedFile);
      } else if (selectedFile.type === 'text/plain') {
        text = await extractTextFromTXT(selectedFile);
      } else {
        throw new Error('Unsupported file type. Please upload PDF, DOCX, or TXT.');
      }
      if (!text.trim()) throw new Error('Could not extract any text from the file.');
      setExtractedText(text);
      toast.success('File processed successfully!');
    } catch (error: any) {
      console.error('Extraction error:', error);
      toast.error(error.message || 'Failed to process file');
      setFile(null);
    } finally {
      setIsExtracting(false);
    }
  };
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };
  const extractTextFromDOCX = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };
  const extractTextFromTXT = async (file: File): Promise<string> => {
    return await file.text();
  };
  const handleGenerate = async () => {
    if (!extractedText) {
      toast.error('No content to generate from.');
      return;
    }
    // Resolve API Key (User input OR Environment Variable)
    const effectiveApiKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!effectiveApiKey) {
      toast.error('API Key is missing! Please enter it or set it in your environment.');
      return;
    }
    setIsGenerating(true);
    setGeneratedContent('');
    // Helper to build prompt
    const buildPrompt = () => {
      let requirementText = "";
      let typeInstruction = "";
      // Handle Question Type Enforcement
      if (questionType === "MCQ Only" || questionType === "Multiple Choice Only") {
        typeInstruction = "STRICT REQUIREMENT: All questions MUST be Multiple Choice Questions (MCQs) with 4 options (a, b, c, d). Do NOT generate descriptive questions.";
      } else if (questionType === "Theory Only") {
        typeInstruction = "STRICT REQUIREMENT: All questions MUST be descriptive/theory questions. Do NOT generate MCQs.";
      } else {
        typeInstruction = "Include a mix of MCQs and descriptive questions.";
      }
      if (teacherComment.trim()) {
        requirementText = `Follow these teacher instructions: ${teacherComment.trim()}\n`;
      } else {
        requirementText = `Generate exactly: ${numTwo} questions of 2 marks, ${numFive} of 5 marks, ${numTen} of 10 marks.`;
      }
      return `
            You are an expert university question paper setter.
            Study material: ${extractedText.substring(0, 12000)}
            
            CONFIGURATION:
            ${requirementText}
            
            FORMAT RULES:
            ${typeInstruction}
            
            IMPORTANT STRUCTURAL RULE FOR 5-MARK and 10-MARK QUESTIONS:
            For every 5-mark and 10-mark question, you MUST provide an internal choice using 'a)' and 'b)' labels.
            Format it strictly like this example:
            11. a) [First Question Text]
                OR
                b) [Alternative Question Text]
            
            Difficulty: ${difficulty}
            
            Output Format:
            📘 **Question Paper**
            ---
            **Section A (2 Marks)**...
            `;
    };
    // 1. Try Python Backend First
    try {
      const response = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: extractedText,
          difficulty,
          numQuestions: { two: parseInt(numTwo), five: parseInt(numFive), ten: parseInt(numTen) },
          questionType, teacherComment, apiKey, modelName
        })
      });
      if (response.ok) {
        const data = await response.json();
        setGeneratedContent(data.content);
        toast.success('Generated via Python Backend!');
        return;
      }
    } catch (e) {
      console.warn("Backend unavailable, using client-side fallback...");
    }
    // 2. Client-Side Fallback Strategies
    const prompt = buildPrompt();
    const generateWithSDK = async (modelToUse: string) => {
      const genAI = new GoogleGenerativeAI(effectiveApiKey);
      const model = genAI.getGenerativeModel({ model: modelToUse });
      const result = await model.generateContent(prompt);
      return (await result.response).text();
    };
    const generateWithREST = async (modelToUse: string) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${effectiveApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `REST Error: ${response.status}`);
      }
      const data = await response.json();
      return data.candidates[0].content.parts[0].text;
    };
    try {
      // Attempt 1: SDK with selected model
      const text = await generateWithSDK(modelName);
      setGeneratedContent(text);
      toast.success('Generated successfully!');
    } catch (error: any) {
      console.warn(`Attempt 1 (${modelName}) failed.`, error);
      // Check for Rate Limit / Quota errors
      const isQuotaError = error.message?.includes('429') ||
        error.message?.toLowerCase().includes('quota') ||
        error.message?.toLowerCase().includes('exhausted');
      if (isQuotaError) {
        toast.warning(`Rate limit reached for ${modelName}. Attempting fallback...`);
      }
      try {
        // Attempt 2: REST API 
        // If it was a quota error, switch to 'gemini-1.5-flash' (usually has separate/higher quota).
        // Otherwise retain the selected model but try REST (fixes 404s).
        const fallbackModel = isQuotaError ? 'gemini-1.5-flash' : modelName;
        toast.loading(`Retrying with ${fallbackModel}...`);
        const text = await generateWithREST(fallbackModel);
        setGeneratedContent(text);
        toast.dismiss();
        toast.success('Generated with fallback!');
      } catch (err2: any) {
        console.warn("Attempt 2 (REST) failed.", err2);
        try {
          // Attempt 3: SDK with Gemini Pro (last resort)
          // If we haven't tried gemini-pro yet, try it now.
          const finalFallback = 'gemini-pro';
          if (modelName === finalFallback) throw err2; // Don't retry if we already started with it
          const text = await generateWithSDK(finalFallback);
          setGeneratedContent(text);
          toast.dismiss();
          toast.success('Generated with Gemini Pro!');
        } catch (err3: any) {
          toast.dismiss();
          console.error("All attempts failed.", err3);
          if (isQuotaError || err3.message?.includes('429')) {
            toast.error(`⚠️ Daily Quota Exceeded. Please select a different AI Model in the settings and try again.`);
          } else {
            toast.error(`Generation failed: ${err3.message || 'Check API Key'}`);
          }
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };
  const handleDownloadPDF = () => {
    if (!generatedContent) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxLineWidth = pageWidth - (margin * 2);
    let y = 20;
    // Function to add page border
    const addBorder = () => {
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.rect(margin - 5, margin - 5, pageWidth - ((margin - 5) * 2), pageHeight - ((margin - 5) * 2));
    };
    // Initial setup
    addBorder();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Question Paper", pageWidth / 2, y, { align: "center" });
    y += 15;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const lines = generatedContent.split('\n');
    lines.forEach((line) => {
      // Check for page break
      if (y > pageHeight - 20) {
        doc.addPage();
        addBorder();
        y = 20;
      }
      line = line.trim();
      // FILTER: Skip empty lines, separators, and title duplications
      if (!line || line === '---' || line === '___' || line.includes('📘') || line.toLowerCase() === 'question paper' || line.toLowerCase() === '**question paper**') {
        return;
      }
      // Detect Headers (e.g., **Section A**) - Improved detection
      const isHeader = (line.startsWith('**') && line.endsWith('**')) || line.toLowerCase().includes('section');
      const isQuestion = /^\d+\./.test(line) || /^Q\./.test(line); // Starts with "1." or "Q."
      if (isHeader) {
        y += 5;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        // Remove all markdown bold/italic chars
        const cleanLine = line.replace(/[\*#_]/g, '').trim();
        doc.text(cleanLine, pageWidth / 2, y, { align: "center" });
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
      } else if (isQuestion) {
        doc.setFont("helvetica", "bold");
        const splitLine = doc.splitTextToSize(line, maxLineWidth);
        doc.text(splitLine, margin, y);
        y += (splitLine.length * 5) + 2; // Better line height
        doc.setFont("helvetica", "normal");
      } else {
        if (line.trim().toUpperCase() === 'OR') {
          y += 2;
          doc.setFont("helvetica", "bold");
          doc.text("OR", pageWidth / 2, y, { align: "center" });
          y += 6;
          doc.setFont("helvetica", "normal");
        } else {
          const splitLine = doc.splitTextToSize(line, maxLineWidth);
          doc.text(splitLine, margin, y);
          y += (splitLine.length * 5);
        }
      }
    });
    doc.save('Question_Paper.pdf');
    toast.success('Downloaded Professional PDF');
  };
  const handleCopyToClipboard = () => {
    if (!generatedContent) return;
    navigator.clipboard.writeText(generatedContent);
    toast.success('Copied to clipboard');
  };
  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white">AI Question Paper Generator</h1>
        <p className="text-slate-400">Generate comprehensive tests and question papers using Google Gemini AI.
          Upload your syllabus or study material (PDF, DOCX, TXT) to get started.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Input & Config */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="bg-slate-800 border-slate-700 text-white">
            <CardHeader>
              <CardTitle>1. Upload Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${isExtracting ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/50'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                />
                {isExtracting ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                    <span className="text-sm text-blue-400">Reading file...</span>
                  </div>
                ) : file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-green-400" />
                    <span className="text-sm font-medium text-white">{file.name}</span>
                    <span className="text-xs text-slate-400">Click to change</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-slate-400" />
                    <span className="text-sm text-slate-300">Upload PDF, DOCX, or TXT</span>
                    <span className="text-xs text-slate-500">Max 20MB</span>
                  </div>
                )}
              </div>
              {/* API Key Management Section */}
              <div className="space-y-3 pt-4 border-t border-slate-700">
                <Label className="text-white flex justify-between items-center">
                  <span>Gemini API Key</span>
                  <span className="text-xs text-slate-400 font-normal">(Optional if set in env)</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Enter Gemini API Key (leaves blank to use default)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="bg-slate-900 border-slate-700 h-9 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-yellow-600 text-yellow-500 hover:bg-yellow-600/10 hover:text-yellow-400"
                    onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
                  >
                    Get Key 🔑
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  Don't have a key? Click "Get Key" to generate one for free.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800 border-slate-700 text-white">
            <CardHeader>
              <CardTitle>2. Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 h-9 transition-all hover:bg-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Easy">Easy</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <Select value={modelName} onValueChange={setModelName}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 h-9 transition-all hover:bg-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Recommended)</SelectItem>
                      <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (New)</SelectItem>
                      <SelectItem value="gemini-3-flash">Gemini 3 Flash (Experimental)</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</SelectItem>
                      <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro (High Quality)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Question Type</Label>
                  <Select value={questionType} onValueChange={setQuestionType}>
                    <SelectTrigger className="bg-slate-900 border-slate-700 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mixed">Mixed (MCQ + Theory)</SelectItem>
                      <SelectItem value="MCQ Only">Multiple Choice Only</SelectItem>
                      <SelectItem value="Theory Only">Theory / Descriptive Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>2-Mark Questions</Label>
                  <Input
                    type="number"
                    min="0"
                    max="20"
                    value={numTwo}
                    onChange={e => setNumTwo(e.target.value)}
                    className="bg-slate-900 border-slate-700 h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label>5-Mark Questions</Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={numFive}
                    onChange={e => setNumFive(e.target.value)}
                    className="bg-slate-900 border-slate-700 h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label>10-Mark Questions</Label>
                  <Input
                    type="number"
                    min="0"
                    max="5"
                    value={numTen}
                    onChange={e => setNumTen(e.target.value)}
                    className="bg-slate-900 border-slate-700 h-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Extra Instructions (Optional)</Label>
                <Textarea
                  placeholder="e.g. Include one question about DBMS..."
                  value={teacherComment}
                  onChange={e => setTeacherComment(e.target.value)}
                  className="bg-slate-900 border-slate-700 min-h-[80px] text-sm"
                />
              </div>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
                disabled={!file || !extractedText || isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" /> Generate Question Paper
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
        {/* Right Column: Preview */}
        <div className="lg:col-span-2 h-full min-h-[500px]">
          <Card className="lg:col-span-2 bg-slate-800 border-slate-700 text-white flex flex-col h-full">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>3. Generated Paper</CardTitle>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300 hover:bg-slate-700 flex-1 sm:flex-none"
                  onClick={handleCopyToClipboard}
                  disabled={!generatedContent}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                  onClick={handleDownloadPDF}
                  disabled={!generatedContent}
                >
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-[500px] p-4 sm:p-6">
              {generatedContent ? (
                <div className="w-full h-full bg-slate-900 rounded-md p-4 overflow-y-auto whitespace-pre-wrap font-mono text-sm border border-slate-700 shadow-inner">
                  {generatedContent}
                </div>
              ) : (
                <div className="w-full h-full bg-slate-900/50 rounded-md border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p>Your generated question paper will appear here.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};