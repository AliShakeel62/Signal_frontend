"use client"
import { useState, useRef, useCallback, ChangeEvent } from 'react';
import { useEffect } from 'react';
import { 
  Upload, Link, Send, X, CheckCircle, AlertCircle, Loader2, File, 
  RotateCw, Search, Edit, Trash2, Eye, Database, Cloud, ChevronLeft, ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {supabase} from '../../lib/supabaseClient';

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  rawFile: File;
}

interface LeadData {
  id: string;
  company_name: string;
  website_url: string;
  funding_date: string;
  funding_amount: string;
  funding_round: string;
  linkedin_url: string;
  score: number;
  score_detail: string;
  decision_maker_data: string;
  decision_maker_linkedin: string;
  decision_maker_email: string;
  created_at: string;
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

interface TableState {
  data: LeadData[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
}


const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};

export default function FileUploadPage() {
  const [activeView, setActiveView] = useState<'upload' | 'table'>('upload');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(50);
  
  const [formState, setFormState] = useState<FormState>({
    file: null,
    webhookUrl: 'https://parrot-giving-daily.ngrok-free.app/webhook-test/upload-lead',
    isLoading: false,
    isSubmitted: false,
    errors: {},
    success: '',
  });
  
  const [tableState, setTableState] = useState<TableState>({
    data: [],
    isLoading: true,
    error: null,
    searchTerm: '',
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  
 const fetchTableData = useCallback(async () => {
    setTableState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const { data: supaData, error: supaError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (supaError) {
        throw new Error(supaError.message);
      }

      setTableState(prev => ({
        ...prev,
        data: supaData || [],
        isLoading: false
      }));


      console.log("Fetched Data:", supaData);

    } catch (error: any) {
      console.error("Fetch Error:", error);
      setTableState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to fetch data. Please try again.'
      }));
    }
  }, []);

  useEffect(() => {
    if (activeView === 'table') {
      fetchTableData();
    }
  }, [activeView, fetchTableData]);

  const validateFile = (file: File): string | null => {
    const acceptedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    const maxSize = 10 * 1024 * 1024;
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (!acceptedTypes.includes(file.type) && !isExcel) {
      return 'File type not supported. Please upload an Excel file (.xlsx or .xls).';
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
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  const handleSubmit = useCallback(async () => {
    const errors: FormState['errors'] = {};
    
    if (!formState.file) {
      errors.file = 'Please select an Excel file to upload';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormState(prev => ({ ...prev, errors }));
      return;
    }
    
    setFormState(prev => ({
      ...prev,
      isLoading: true,
      errors: {},
      success: ''
    }));
    
    try {
      const file = formState.file!.rawFile;
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const rawData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

      if (rawData.length === 0) {
        throw new Error("Excel file is empty");
      }

      
      const mappedData = rawData.map((row) => ({
        company_name: row['identifier-label'] || '', 
        website_url: row['component--field-formatter href'] || '',
        funding_date: row['component--field-formatter (4)'] || '',
        funding_amount: row['component--field-formatter (6)'] || '',
        funding_round: row['component--field-formatter (5)'] || '',
      }));

      const chunkSize = 50;
      let totalInserted = 0;
      
      for (let i = 0; i < mappedData.length; i += chunkSize) {
        const chunk = mappedData.slice(i, i + chunkSize);
        
        const { error: supaError } = await supabase
          .from('leads')
          .insert(chunk);

        if (supaError) {
          throw new Error(`Supabase error: ${supaError || 'Failed to insert data'}`);
        }
        
        totalInserted += chunk.length;
        await delay(200);
      }


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
        success: `Successfully uploaded ${totalInserted} records to database!`
      }));
      
      setTimeout(() => {
        setFormState({
          file: null,
          webhookUrl: 'https://parrot-giving-daily.ngrok-free.app/webhook-test/upload-lead',
          isLoading: false,
          isSubmitted: false,
          errors: {},
          success: ''
        });
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }, 3000);
      
    } catch (error: any) {
      setFormState(prev => ({
        ...prev,
        isLoading: false,
        errors: { submit: error.message || 'Failed to submit file. Please try again.' }
      }));
    }
  }, [formState.file, formState.webhookUrl]);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTableState(prev => ({ ...prev, searchTerm: e.target.value }));
    setCurrentPage(1);
  }, []);

  const filteredData = tableState.data.filter(item =>
    (item.company_name?.toLowerCase() || '').includes(tableState.searchTerm.toLowerCase()) ||
    (item.website_url?.toLowerCase() || '').includes(tableState.searchTerm.toLowerCase()) ||
    (item.funding_round?.toLowerCase() || '').includes(tableState.searchTerm.toLowerCase())
  );
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    tableContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-700 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-700 rounded-full filter blur-3xl"></div>
      </div>
      
      <div className="w-full max-w-6xl relative z-10">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8 md:p-10">
          <div className="flex justify-center mb-8">
            <div className="bg-slate-800/50 p-1 rounded-lg flex">
              <button
                onClick={() => setActiveView('upload')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center",
                  activeView === 'upload'
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "text-slate-300 hover:text-white"
                )}
              >
                <Upload className="h-4 w-4 mr-2" />
                File Upload
              </button>
              <button
                onClick={() => setActiveView('table')}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center",
                  activeView === 'table'
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "text-slate-300 hover:text-white"
                )}
              >
                <Database className="h-4 w-4 mr-2" />
                Database Table
              </button>
            </div>
          </div>
          
          {activeView === 'upload' && (
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 text-center">
                Excel Upload to Supabase
              </h1>
              <p className="text-slate-300 text-center mb-8">
                Upload your Excel file to sync data with database
              </p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Upload Excel File
                  </label>
                  <div
                    className={cn(
                      "relative border-2 border-dashed rounded-xl p-6 md:p-8 transition-all duration-300 cursor-pointer",
                      isDragging
                        ? "border-indigo-400 bg-indigo-500/10"
                        : formState.file
                        ? "border-green-400 bg-green-500/10"
                        : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/30"
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
                      accept=".xlsx,.xls"
                    />
                    
                    {formState.file ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="bg-green-500/20 p-2 rounded-lg">
                            <File className="h-6 w-6 text-green-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium truncate max-w-xs md:max-w-md">
                              {formState.file.name}
                            </p>
                            <p className="text-slate-400 text-sm">
                              {formatFileSize(formState.file.size)}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile();
                          }}
                          className="text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className={cn(
                          "mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4 transition-all duration-300",
                          isDragging ? "bg-indigo-500/20 animate-pulse" : "bg-slate-700/50"
                        )}>
                          <Upload className="h-6 w-6 text-slate-300" />
                        </div>
                        <p className="text-white font-medium mb-1">
                          {isDragging ? "Drop your Excel file here" : "Drag & drop your Excel file here"}
                        </p>
                        <p className="text-slate-400 text-sm">
                          or click to browse from your computer
                        </p>
                        <p className="text-slate-500 text-xs mt-2">
                          Supports: .xlsx, .xls (Max 10MB)
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {formState.errors.file && (
                    <div className="flex items-center mt-2 text-red-400 text-sm">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {formState.errors.file}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleSubmit}
                  disabled={formState.isLoading || formState.isSubmitted}
                  className={cn(
                    "w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center text-white",
                    formState.isLoading || formState.isSubmitted
                      ? "bg-slate-700 cursor-not-allowed"
                      : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transform hover:scale-[1.02] active:scale-[0.98]"
                  )}
                >
                  {formState.isLoading ? (
                    <>
                      <Loader2 className="animate-spin h-5 w-5 mr-2" />
                      Uploading to Database...
                    </>
                  ) : formState.isSubmitted ? (
                    <>
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Upload Successful
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5 mr-2" />
                      Upload to Supabase
                    </>
                  )}
                </button>
                
                {formState.success && (
                  <div className="flex items-center justify-center p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    {formState.success}
                  </div>
                )}
                
                {formState.errors.submit && (
                  <div className="flex items-center justify-center p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    {formState.errors.submit}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeView === 'table' && (
            <div>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 md:mb-0">
                  Database Records
                </h1>
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      className="pl-10 pr-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200 w-full md:w-64"
                      placeholder="Search records..."
                      value={tableState.searchTerm}
                      onChange={handleSearchChange}
                    />
                  </div>
                  
                  <button
                    onClick={fetchTableData}
                    disabled={tableState.isLoading}
                    className="p-2 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-300 hover:text-white hover:border-indigo-500 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RotateCw className={cn("h-4 w-4", tableState.isLoading && "animate-spin")} />
                  </button>
                </div>
              </div>
              
              <div 
                ref={tableContainerRef}
                className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden"
                style={{ maxHeight: '600px', overflowY: 'auto' }}
              >
                {tableState.isLoading ? (
                  <div className="p-4">
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="bg-slate-700/30 rounded-lg h-12 animate-pulse"></div>
                      ))}
                    </div>
                  </div>
                ) : tableState.error ? (
                  <div className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <p className="text-red-400">{tableState.error}</p>
                    <button
                      onClick={fetchTableData}
                      className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                            Company Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                            Company Linkedin
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                            Website
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                            Funding Round
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                            Funding Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                           Funding Amount
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                            Score
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                            Score Ranking
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                            Decision Maker Linkedin
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-300 uppercase">
                            Decision Maker Email
                          </th>
                        </tr>
                      </thead>
                      
                      <tbody className="divide-y divide-slate-700/50">
                        {filteredData.length > 0 ? (
                          filteredData.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-700/20 transition-colors">
                              <td className="px-4 py-4 text-sm font-medium text-white">
                                {item.company_name}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-300">
                                {item.linkedin_url}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-300">
                                {item.website_url}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-300">
                                {item.funding_round}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-300">
                                {item.funding_date}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-300">
                                {item.funding_amount}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-300">
                                {item.score}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-300">
                                {item.score_detail}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-300">
                                {item.decision_maker_linkedin}
                              </td>
                              <td className="px-4 py-4 text-sm text-slate-300">
                                {item.decision_maker_email}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                              No records found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                  <div className="text-sm text-slate-400">
                    Showing <span className="text-white font-medium">{indexOfFirstRow + 1}</span> to{' '}
                    <span className="text-white font-medium">{Math.min(indexOfLastRow, filteredData.length)}</span> of{' '}
                    <span className="text-white font-medium">{filteredData.length}</span> records
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg bg-slate-800/50 border border-slate-600 text-slate-300 hover:text-white hover:border-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <div className="flex gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        let pageNum;
                        if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        if (pageNum <= 0 || pageNum > totalPages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={cn(
                              "w-10 h-10 rounded-lg text-sm font-medium transition-all",
                              currentPage === pageNum
                                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                                : "bg-slate-800/50 border border-slate-600 text-slate-300 hover:text-white hover:border-indigo-500"
                            )}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg bg-slate-800/50 border border-slate-600 text-slate-300 hover:text-white hover:border-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex items-center justify-center text-xs text-slate-500">
                <Cloud className="h-3 w-3 mr-1" />
                Connected to Supabase
              </div>
            </div>
          )}
        </div>
      </div>
      
      <style jsx global>{`
        /* Custom scrollbar styles */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(51, 65, 85, 0.3);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(99, 102, 241, 0.6);
          border-radius: 10px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(99, 102, 241, 0.8);
        }
      `}</style>
    </div>
  );
}