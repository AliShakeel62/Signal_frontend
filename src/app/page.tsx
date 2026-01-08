'use client';

import { useState, useRef, useCallback, ChangeEvent, FormEvent } from 'react';
import { Upload, Link, Send, X, CheckCircle, AlertCircle, Loader2, File as FileIcon, CloudCog } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabaseClient';


// Added rawFile to store the actual browser File object
interface UploadedFile {
  name: string;
  size: number;
  type: string;
  rawFile: File;
}

interface FormState {
  file: UploadedFile | null;
  webhookUrl: string;
  isLoading: boolean;
  isSubmitted: boolean;
  errors: {
    file?: string;
    webhookUrl?: string;
    submit?: string;
  };
  success: string;
}

export default function FileUploadPage() {
  const [formState, setFormState] = useState<FormState>({
    file: null,
    webhookUrl: 'https://parrot-giving-daily.ngrok-free.app/webhook-test/upload-excel',
    isLoading: false,
    isSubmitted: false,
    errors: {},
    success: '',
  });

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateWebhookUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const validateFile = (file: File): string | null => {
    const acceptedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/json',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/zip', 'application/x-zip-compressed'
    ];

    const maxSize = 10 * 1024 * 1024;

    // Check type or extension for Excel files
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (!acceptedTypes.includes(file.type) && !isExcel) {
      return 'File type not supported. Please upload an image, PDF, Excel, JSON, or ZIP file.';
    }

    if (file.size > maxSize) {
      return 'File size exceeds 10MB limit.';
    }

    return null;
  };

  const handleFileSelection = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setFormState(prev => ({
        ...prev,
        errors: { ...prev.errors, file: validationError }
      }));
      return;
    }

    setFormState(prev => ({
      ...prev,
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        rawFile: file
      },
      errors: { ...prev.errors, file: undefined }
    }));
  };

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelection(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelection(file);
  }, []);

  const handleWebhookUrlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormState(prev => ({
      ...prev,
      webhookUrl: url,
      errors: { ...prev.errors, webhookUrl: undefined }
    }));
  }, []);

  const removeFile = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      file: null,
      errors: { ...prev.errors, file: undefined }
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

const handleSubmit = useCallback(async (e: FormEvent) => {
  e.preventDefault();
  // ... (validations same rahengi)

  setFormState(prev => ({ ...prev, isLoading: true, errors: {}, success: '' }));

  try {
    const file = formState.file!.rawFile;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const rawData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    if (rawData.length === 0) throw new Error("Excel file is empty");

    // --- STEP 1: DATA MAPPING START ---
    // Yahan aap batao ke Excel ka kaunsa column DB ke kis column mein jaye
    const mappedData = rawData.map((row) => ({
      // database_column_name: row['Excel_Column_Name']
      name: row['identifier-label'], 
      website_url: row['component--field-formatter href'],
      fundingamount_date: row['component--field-formatter (4)'],
      funding_amount: row['component--field-formatter (6)'],
      round: row['component--field-formatter (5)'],
      // Agar koi static value bhejni ho:
    }));
    // --- STEP 1: DATA MAPPING END ---

    // --- STEP 2: BATCHING & INSERTION ---
    const chunkSize = 50;
    for (let i = 0; i < mappedData.length; i += chunkSize) {
      const chunk = mappedData.slice(i, i + chunkSize);
      
      const { error: supaError } = await supabase
        .from('excel_data') // Apne table ka sahi naam yahan likhein
        .insert(chunk);

      if (supaError) throw supaError;
    }

    // --- STEP 3: WEBHOOK HIT ---
    await fetch(formState.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: "Data synced successfully",
        total_rows: mappedData.length 
      })
    });

    setFormState(prev => ({
      ...prev,
      isLoading: false,
      isSubmitted: true,
      success: 'Mapped data saved and Webhook notified!'
    }));

  } catch (error: any) {
    setFormState(prev => ({
      ...prev,
      isLoading: false,
      errors: { submit: error.message }
    }));
  }
}, [formState.file, formState.webhookUrl]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-700 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-700 rounded-full filter blur-3xl"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10 animate-fadeIn">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 md:p-10">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 text-center">File Upload Portal</h1>
          <p className="text-slate-300 text-center mb-8">Upload Excel to Supabase & Notify Webhook</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Upload File</label>
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-6 md:p-8 transition-all duration-300 cursor-pointer",
                  isDragging ? "border-indigo-400 bg-indigo-500/10" :
                    formState.file ? "border-green-400 bg-green-500/10" :
                      "border-slate-600 hover:border-slate-500 hover:bg-slate-800/30"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.txt,.json,.zip,.xlsx,.xls"
                />

                {formState.file ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="bg-green-500/20 p-2 rounded-lg">
                        <FileIcon className="h-6 w-6 text-green-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium truncate max-w-[200px] md:max-w-md">{formState.file.name}</p>
                        <p className="text-slate-400 text-sm">{formatFileSize(formState.file.size)}</p>
                      </div>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(); }} className="text-slate-400 hover:text-red-400">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className={cn("mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4", isDragging ? "bg-indigo-500/20 animate-pulse" : "bg-slate-700/50")}>
                      <Upload className="h-6 w-6 text-slate-300" />
                    </div>
                    <p className="text-white font-medium mb-1">Drag & drop your file here</p>
                    <p className="text-slate-400 text-sm">Supports: Images, PDF, Excel, JSON (Max 10MB)</p>
                  </div>
                )}
              </div>
              {formState.errors.file && <div className="flex items-center mt-2 text-red-400 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{formState.errors.file}</div>}
            </div>

            <div>
              <label htmlFor="webhook-url" className="block text-sm font-medium text-slate-300 mb-2">Webhook URL (Notify n8n)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Link className="h-5 w-5 text-slate-400" /></div>
                <input
                  id="webhook-url"
                  type="text"
                  className={cn("w-full pl-10 pr-3 py-3 bg-slate-800/50 border rounded-lg text-white focus:outline-none focus:ring-2", formState.errors.webhookUrl ? "border-red-500 focus:ring-red-500/50" : "border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/50")}
                  placeholder="https://n8n.your-instance.com/webhook/..."
                  value={formState.webhookUrl}
                  onChange={handleWebhookUrlChange}
                  disabled={formState.isLoading}
                />
              </div>
              {formState.errors.webhookUrl && <div className="flex items-center mt-2 text-red-400 text-sm"><AlertCircle className="h-4 w-4 mr-1" />{formState.errors.webhookUrl}</div>}
            </div>

            <button
              type="submit"
              disabled={formState.isLoading || formState.isSubmitted}
              className={cn("w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center", formState.isLoading || formState.isSubmitted ? "bg-slate-700 cursor-not-allowed" : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.02] text-white")}
            >
              {formState.isLoading ? <><Loader2 className="animate-spin h-5 w-5 mr-2" /> Processing Data...</> :
                formState.isSubmitted ? <><CheckCircle className="h-5 w-5 mr-2" /> Done!</> :
                  <><Send className="h-5 w-5 mr-2" /> Start Processing</>}
            </button>

            {formState.success && <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-center animate-fadeIn">{formState.success}</div>}
            {formState.errors.submit && <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-center animate-fadeIn">{formState.errors.submit}</div>}
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
      `}</style>
    </div>
  );
}