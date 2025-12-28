import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { Loader2, Upload, FileText, Download, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

// Initialize PDF.js worker
// We use a CDN to avoid complex build configuration for the worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const AITestGenerator = () => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionCount, setQuestionCount] = useState('10');
  const [questionType, setQuestionType] = useState('Mixed'); // Mixed, MCQ, Theory

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
    if (!apiKey) {
      toast.error('Gemini API Key is missing. Please add it to your .env file or settings.');
      return;
    }

    setIsGenerating(true);
    setGeneratedContent('');

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      const prompt = `
        Act as an expert teacher. Create a question paper based on the following text content.
        
        Configuration:
        - Difficulty: ${difficulty}
        - Number of Questions: Approximate ${questionCount} marks worth or count.
        - Question Type: ${questionType} (If Mixed, include MCQs, Short Answers, and Long Answers).
        
        Format the output clearly with:
        - Title (Test Name)
        - Instructions
        - Sections (e.g., Section A: MCQ, Section B: Short Answer)
        - Marking Scheme (indicate marks for each question)
        
        Content to base questions on:
        "${extractedText.substring(0, 30000)}" 
        (Note: Content truncated to fit limits if too long)
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      setGeneratedContent(text);
      toast.success('Question paper generated!');
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error('Failed to generate test. ' + (error.message || 'Check your API key.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!generatedContent) return;
    const doc = new jsPDF();

    // Simple text wrapping
    const splitText = doc.splitTextToSize(generatedContent, 180);
    let y = 10;

    // Add simple header
    doc.setFontSize(16);
    doc.text("Generated Question Paper", 10, y);
    y += 10;

    doc.setFontSize(12);
    // Loop through text lines to handle page breaks
    for (let i = 0; i < splitText.length; i++) {
      if (y > 280) {
        doc.addPage();
        y = 10;
      }
      doc.text(splitText[i], 10, y);
      y += 7;
    }

    doc.save('question-paper.pdf');
    toast.success('Downloaded as PDF');
  };

  const handleCopyToClipboard = () => {
    if (!generatedContent) return;
    navigator.clipboard.writeText(generatedContent);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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

              {/* API Key Warning (Only if missing in env) */}
              {!import.meta.env.VITE_GEMINI_API_KEY && (
                <div className="space-y-2">
                  <Label className="text-xs text-yellow-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> API Key Required
                  </Label>
                  <Input
                    type="password"
                    placeholder="Paste Gemini API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-xs h-8"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700 text-white">
            <CardHeader>
              <CardTitle>2. Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Difficulty Level</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select value={questionType} onValueChange={setQuestionType}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mixed">Mixed (MCQ + Theory)</SelectItem>
                    <SelectItem value="MCQ Only">Multiple Choice Only</SelectItem>
                    <SelectItem value="Theory Only">Theory / Descriptive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Number of Questions / Marks</Label>
                <Select value={questionCount} onValueChange={setQuestionCount}>
                  <SelectTrigger className="bg-slate-900 border-slate-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Short (10 Marks / ~5 Qs)</SelectItem>
                    <SelectItem value="25">Medium (25 Marks / ~10 Qs)</SelectItem>
                    <SelectItem value="50">Long (50 Marks)</SelectItem>
                    <SelectItem value="100">Full Paper (100 Marks)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
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
          <Card className="bg-slate-800 border-slate-700 text-white h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>3. Generated Paper</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyToClipboard} disabled={!generatedContent}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleDownloadPDF} disabled={!generatedContent}>
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-[400px]">
              {generatedContent ? (
                <Textarea
                  className="w-full h-full min-h-[500px] bg-slate-950/50 border-slate-700 font-mono text-sm leading-relaxed p-6"
                  value={generatedContent}
                  readOnly
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-slate-500 border-2 border-dashed border-slate-700 rounded-lg bg-slate-900/50">
                  <FileText className="h-16 w-16 mb-4 opacity-20" />
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
