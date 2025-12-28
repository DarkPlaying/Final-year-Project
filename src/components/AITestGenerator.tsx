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
// Using unpkg as it more reliably serves the .mjs worker for modern pdfjs-dist versions
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export const AITestGenerator = () => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiKey, setApiKey] = useState(import.meta.env.VITE_GEMINI_API_KEY || '');
  const [difficulty, setDifficulty] = useState('Medium');
  const [numTwo, setNumTwo] = useState('10');
  const [numFive, setNumFive] = useState('5');
  const [numTen, setNumTen] = useState('2');
  const [teacherComment, setTeacherComment] = useState('');
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
      // Using gemini-1.5-flash as it is the stable and current flagship flash model
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const variationSeed = Math.floor(Math.random() * 1000000);

      let requirementText = "";
      if (teacherComment.trim()) {
        requirementText = `Follow these teacher instructions when deciding the number of questions, marks and style:\n${teacherComment.trim()}\n`;
      } else {
        requirementText = `
Generate exactly:
- ${numTwo} questions of 2 marks
- ${numFive} questions of 5 marks
- ${numTen} questions of 10 marks
        `;
      }

      const prompt = `
        You are an expert university question paper setter.
        You must create different sets of questions each time you are called,
        avoiding reusing previous questions as much as possible.

        Study material:
        --- Document Content Start ---
        ${extractedText.substring(0, 15000)}
        --- Document Content End ---

        Requirements:
        ${requirementText}
        - Preferred Question Format: ${questionType}

        Additional rules:
        - Difficulty Level: ${difficulty}
        - Do NOT repeat questions or wording from any previous paper you might have created.
        - Vary phrasing, ordering and subtopics so each paper feels different.
        - Use clear, exam-style questions only.

        Random variation id: ${variationSeed}

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
