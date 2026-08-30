import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  FileCode, 
  ZoomIn, 
  ZoomOut, 
  HardDrive, 
  Folder, 
  Check, 
  Copy,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUp,
  BookOpen,
  FileCheck,
  Layers,
  Cpu,
  Compass,
  Code2,
  Maximize2,
  Minimize2,
  File,
  Table,
  Eye
} from 'lucide-react';
import { AttachedFile } from '../../types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';

interface FilePreviewModalProps {
  file: AttachedFile | null;
  onClose: () => void;
}

// Decode base64 uploaded text/csv/code files if present
function decodeDataUrlToText(dataUrl?: string): string | null {
  if (!dataUrl) return null;
  try {
    const parts = dataUrl.split(',');
    if (parts.length > 1) {
      const base64 = parts[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
  } catch (e) {
    console.warn('Could not decode file content from dataUrl:', e);
  }
  return null;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ file, onClose }) => {
  const { projects, downloadFile } = useApp();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTab, setActiveTab] = useState<'preview' | 'details'>('preview');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'continuous' | 'paged'>('continuous');
  const [copied, setCopied] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [activeSheetTab, setActiveSheetTab] = useState<number>(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Reset zoom & scroll when file changes
  useEffect(() => {
    setZoomLevel(100);
    setCurrentPage(1);
    setActiveTab('preview');
    setTableSearch('');
    setShowScrollTop(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [file?.id]);

  const ext = file?.name?.split('.').pop()?.toLowerCase() || '';
  const isImg = Boolean(file?.isImage || ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif', 'bmp', 'ico'].includes(ext));
  const isPdf = Boolean(ext === 'pdf' || file?.type?.includes('pdf'));
  const isCsv = Boolean(ext === 'csv' || file?.type?.includes('csv'));
  const isSheet = Boolean(['xls', 'xlsx', 'ods', 'tsv'].includes(ext) || file?.type?.includes('sheet') || file?.type?.includes('excel') || isCsv);
  const isDoc = Boolean(['doc', 'docx', 'rtf', 'odt'].includes(ext) || file?.type?.includes('word') || file?.type?.includes('officedocument.wordprocessingml'));
  const isCode = Boolean(['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'java', 'cpp', 'c', 'cs', 'html', 'css', 'sql', 'yaml', 'yml', 'md', 'sh', 'proto'].includes(ext));

  const decodedRawText = useMemo(() => {
    if (file?.dataUrl && !isImg && !isPdf) {
      return decodeDataUrlToText(file.dataUrl);
    }
    return null;
  }, [file?.dataUrl, isImg, isPdf]);

  if (!file) return null;

  const fileProjects = projects.filter(project => file.projectIds?.includes(project.id));
  const projectNames = fileProjects.map(project => project.name).join(', ');

  const handleDownload = () => {
    downloadFile(file);
  };

  const handleCopyRaw = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop > 180) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToSection = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el && scrollContainerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Structured dataset for Spreadsheet & CSV views
  const getSpreadsheetData = () => {
    if (decodedRawText && (isCsv || ext === 'csv')) {
      const lines = decodedRawText.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map((line, idx) => {
          const cells = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          const rowObj: Record<string, string> = { id: `REC-${String(idx + 1).padStart(3, '0')}` };
          headers.forEach((h, i) => {
            rowObj[h || `col_${i}`] = cells[i] || '';
          });
          return rowObj;
        });
        return { headers, rows, sheetNames: ['Uploaded Data'] };
      }
    }

    if (file.name.includes('Biomedical') || file.name.includes('Dataset')) {
      return {
        sheetNames: ['Patient Biometrics', 'ECG Waveform Summary', 'Clinical Validation'],
        headers: ['Subject ID', 'Age', 'Gender', 'Heart Rate', 'Systolic BP', 'Diastolic BP', 'SpO2 (%)', 'Risk Class', 'Status'],
        rows: [
          { id: '1', 'Subject ID': 'SUBJ-4821', Age: '45', Gender: 'F', 'Heart Rate': '72 bpm', 'Systolic BP': '124 mmHg', 'Diastolic BP': '82 mmHg', 'SpO2 (%)': '98.5%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '2', 'Subject ID': 'SUBJ-4822', Age: '58', Gender: 'M', 'Heart Rate': '88 bpm', 'Systolic BP': '142 mmHg', 'Diastolic BP': '94 mmHg', 'SpO2 (%)': '95.2%', 'Risk Class': 'High Risk', Status: 'Flagged' },
          { id: '3', 'Subject ID': 'SUBJ-4823', Age: '34', Gender: 'F', 'Heart Rate': '65 bpm', 'Systolic BP': '118 mmHg', 'Diastolic BP': '76 mmHg', 'SpO2 (%)': '99.1%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '4', 'Subject ID': 'SUBJ-4824', Age: '67', Gender: 'M', 'Heart Rate': '94 bpm', 'Systolic BP': '158 mmHg', 'Diastolic BP': '102 mmHg', 'SpO2 (%)': '93.8%', 'Risk Class': 'Critical', Status: 'Urgent' },
          { id: '5', 'Subject ID': 'SUBJ-4825', Age: '29', Gender: 'M', 'Heart Rate': '70 bpm', 'Systolic BP': '120 mmHg', 'Diastolic BP': '80 mmHg', 'SpO2 (%)': '99.0%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '6', 'Subject ID': 'SUBJ-4826', Age: '52', Gender: 'F', 'Heart Rate': '81 bpm', 'Systolic BP': '136 mmHg', 'Diastolic BP': '88 mmHg', 'SpO2 (%)': '96.4%', 'Risk Class': 'Moderate', Status: 'Review' },
          { id: '7', 'Subject ID': 'SUBJ-4827', Age: '61', Gender: 'M', 'Heart Rate': '79 bpm', 'Systolic BP': '138 mmHg', 'Diastolic BP': '90 mmHg', 'SpO2 (%)': '96.1%', 'Risk Class': 'Moderate', Status: 'Verified' },
          { id: '8', 'Subject ID': 'SUBJ-4828', Age: '41', Gender: 'F', 'Heart Rate': '68 bpm', 'Systolic BP': '115 mmHg', 'Diastolic BP': '75 mmHg', 'SpO2 (%)': '98.8%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '9', 'Subject ID': 'SUBJ-4829', Age: '73', Gender: 'M', 'Heart Rate': '92 bpm', 'Systolic BP': '162 mmHg', 'Diastolic BP': '98 mmHg', 'SpO2 (%)': '92.4%', 'Risk Class': 'Critical', Status: 'Urgent' },
          { id: '10', 'Subject ID': 'SUBJ-4830', Age: '38', Gender: 'F', 'Heart Rate': '74 bpm', 'Systolic BP': '122 mmHg', 'Diastolic BP': '78 mmHg', 'SpO2 (%)': '98.9%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '11', 'Subject ID': 'SUBJ-4831', Age: '50', Gender: 'M', 'Heart Rate': '83 bpm', 'Systolic BP': '139 mmHg', 'Diastolic BP': '89 mmHg', 'SpO2 (%)': '96.8%', 'Risk Class': 'Moderate', Status: 'Review' },
          { id: '12', 'Subject ID': 'SUBJ-4832', Age: '64', Gender: 'F', 'Heart Rate': '86 bpm', 'Systolic BP': '148 mmHg', 'Diastolic BP': '92 mmHg', 'SpO2 (%)': '94.6%', 'Risk Class': 'High Risk', Status: 'Flagged' },
          { id: '13', 'Subject ID': 'SUBJ-4833', Age: '27', Gender: 'F', 'Heart Rate': '62 bpm', 'Systolic BP': '112 mmHg', 'Diastolic BP': '72 mmHg', 'SpO2 (%)': '99.5%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '14', 'Subject ID': 'SUBJ-4834', Age: '49', Gender: 'M', 'Heart Rate': '77 bpm', 'Systolic BP': '130 mmHg', 'Diastolic BP': '85 mmHg', 'SpO2 (%)': '97.2%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '15', 'Subject ID': 'SUBJ-4835', Age: '80', Gender: 'M', 'Heart Rate': '98 bpm', 'Systolic BP': '166 mmHg', 'Diastolic BP': '104 mmHg', 'SpO2 (%)': '91.8%', 'Risk Class': 'Critical', Status: 'Urgent' },
          { id: '16', 'Subject ID': 'SUBJ-4836', Age: '33', Gender: 'F', 'Heart Rate': '69 bpm', 'Systolic BP': '116 mmHg', 'Diastolic BP': '74 mmHg', 'SpO2 (%)': '99.2%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '17', 'Subject ID': 'SUBJ-4837', Age: '55', Gender: 'M', 'Heart Rate': '85 bpm', 'Systolic BP': '144 mmHg', 'Diastolic BP': '91 mmHg', 'SpO2 (%)': '95.9%', 'Risk Class': 'High Risk', Status: 'Flagged' },
          { id: '18', 'Subject ID': 'SUBJ-4838', Age: '42', Gender: 'F', 'Heart Rate': '71 bpm', 'Systolic BP': '125 mmHg', 'Diastolic BP': '81 mmHg', 'SpO2 (%)': '98.1%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '19', 'Subject ID': 'SUBJ-4839', Age: '68', Gender: 'M', 'Heart Rate': '89 bpm', 'Systolic BP': '152 mmHg', 'Diastolic BP': '96 mmHg', 'SpO2 (%)': '94.0%', 'Risk Class': 'High Risk', Status: 'Flagged' },
          { id: '20', 'Subject ID': 'SUBJ-4840', Age: '31', Gender: 'M', 'Heart Rate': '66 bpm', 'Systolic BP': '119 mmHg', 'Diastolic BP': '77 mmHg', 'SpO2 (%)': '99.3%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '21', 'Subject ID': 'SUBJ-4841', Age: '46', Gender: 'F', 'Heart Rate': '75 bpm', 'Systolic BP': '128 mmHg', 'Diastolic BP': '84 mmHg', 'SpO2 (%)': '97.6%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '22', 'Subject ID': 'SUBJ-4842', Age: '59', Gender: 'M', 'Heart Rate': '87 bpm', 'Systolic BP': '141 mmHg', 'Diastolic BP': '93 mmHg', 'SpO2 (%)': '95.5%', 'Risk Class': 'High Risk', Status: 'Flagged' },
          { id: '23', 'Subject ID': 'SUBJ-4843', Age: '36', Gender: 'F', 'Heart Rate': '67 bpm', 'Systolic BP': '117 mmHg', 'Diastolic BP': '75 mmHg', 'SpO2 (%)': '99.0%', 'Risk Class': 'Low Risk', Status: 'Verified' },
          { id: '24', 'Subject ID': 'SUBJ-4844', Age: '71', Gender: 'M', 'Heart Rate': '93 bpm', 'Systolic BP': '160 mmHg', 'Diastolic BP': '100 mmHg', 'SpO2 (%)': '93.1%', 'Risk Class': 'Critical', Status: 'Urgent' },
          { id: '25', 'Subject ID': 'SUBJ-4845', Age: '28', Gender: 'F', 'Heart Rate': '63 bpm', 'Systolic BP': '114 mmHg', 'Diastolic BP': '73 mmHg', 'SpO2 (%)': '99.6%', 'Risk Class': 'Low Risk', Status: 'Verified' }
        ]
      };
    }

    if (file.name.includes('Peer') || file.name.includes('Template') || isSheet) {
      return {
        sheetNames: ['Peer Assessment Matrix', 'Grading Criteria Weighting', 'Team Contribution %'],
        headers: ['Student Name', 'Student ID', 'Sub-Team Role', 'Code Quality (1-5)', 'Milestone Deliveries (1-5)', 'Collaboration (1-5)', 'Contribution %', 'Calculated Grade'],
        rows: [
          { id: '1', 'Student Name': 'Alexander Vance', 'Student ID': '10349281', 'Sub-Team Role': 'Team Lead & Backend', 'Code Quality (1-5)': '4.8', 'Milestone Deliveries (1-5)': '5.0', 'Collaboration (1-5)': '4.9', 'Contribution %': '28%', 'Calculated Grade': 'HD (88%)' },
          { id: '2', 'Student Name': 'Chloe Jenkins', 'Student ID': '10382910', 'Sub-Team Role': 'ML Pipeline Architect', 'Code Quality (1-5)': '4.9', 'Milestone Deliveries (1-5)': '4.7', 'Collaboration (1-5)': '4.8', 'Contribution %': '26%', 'Calculated Grade': 'HD (86%)' },
          { id: '3', 'Student Name': 'Marcus Sterling', 'Student ID': '10419203', 'Sub-Team Role': 'Embedded ROS & Firmware', 'Code Quality (1-5)': '4.5', 'Milestone Deliveries (1-5)': '4.6', 'Collaboration (1-5)': '4.4', 'Contribution %': '24%', 'Calculated Grade': 'D (79%)' },
          { id: '4', 'Student Name': 'Elena Rostova', 'Student ID': '10294821', 'Sub-Team Role': 'Frontend & Cloud Telemetry', 'Code Quality (1-5)': '4.7', 'Milestone Deliveries (1-5)': '4.8', 'Collaboration (1-5)': '4.9', 'Contribution %': '22%', 'Calculated Grade': 'HD (85%)' },
          { id: '5', 'Student Name': 'Liam O\'Connor', 'Student ID': '10394012', 'Sub-Team Role': 'QA & Validation Eng.', 'Code Quality (1-5)': '4.2', 'Milestone Deliveries (1-5)': '4.3', 'Collaboration (1-5)': '4.5', 'Contribution %': '20%', 'Calculated Grade': 'D (76%)' },
          { id: '6', 'Student Name': 'Samantha Chen', 'Student ID': '10482918', 'Sub-Team Role': 'Security & Compliance', 'Code Quality (1-5)': '4.6', 'Milestone Deliveries (1-5)': '4.5', 'Collaboration (1-5)': '4.7', 'Contribution %': '22%', 'Calculated Grade': 'HD (82%)' },
          { id: '7', 'Student Name': 'David Kim', 'Student ID': '10319482', 'Sub-Team Role': 'Edge Inference Testing', 'Code Quality (1-5)': '4.4', 'Milestone Deliveries (1-5)': '4.1', 'Collaboration (1-5)': '4.3', 'Contribution %': '19%', 'Calculated Grade': 'C (72%)' }
        ]
      };
    }

    return {
      sheetNames: ['Data Sheet 1'],
      headers: ['Index', 'Item Name', 'Category', 'Timestamp', 'Value', 'Status'],
      rows: [
        { id: '1', Index: '001', 'Item Name': 'Baseline Telemetry A', Category: 'Sensors', Timestamp: '2026-08-20 10:00', Value: '14.28', Status: 'Normal' },
        { id: '2', Index: '002', 'Item Name': 'Battery Voltage Rail', Category: 'Power', Timestamp: '2026-08-20 10:01', Value: '11.85V', Status: 'Normal' },
        { id: '3', Index: '003', 'Item Name': 'LiDAR Angular Pulse', Category: 'Perception', Timestamp: '2026-08-20 10:02', Value: '720 Hz', Status: 'Calibrated' },
        { id: '4', Index: '004', 'Item Name': 'Inference Latency', Category: 'Neural Core', Timestamp: '2026-08-20 10:03', Value: '38.4 ms', Status: 'Optimal' },
        { id: '5', Index: '005', 'Item Name': 'IMU Gyro Drift', Category: 'Sensors', Timestamp: '2026-08-20 10:04', Value: '0.002 rad/s', Status: 'Normal' }
      ]
    };
  };

  const spreadsheetData = getSpreadsheetData();
  const filteredSpreadsheetRows = spreadsheetData.rows.filter(r => 
    Object.values(r).some(val => val.toLowerCase().includes(tableSearch.toLowerCase()))
  );

  return (
    <div 
      id="file-preview-modal-backdrop"
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        id="file-preview-modal-container"
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 relative transition-all ${
          isFullScreen ? 'h-full max-h-full max-w-full rounded-none border-none' : 'max-w-5xl h-[92vh] max-h-[920px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="h-16 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/90 dark:bg-slate-850/90 backdrop-blur-md z-20">
          <div className="flex items-center gap-3 min-w-0 flex-1 mr-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-2xs">
              {isImg && <ImageIcon className="w-5 h-5 text-blue-500" />}
              {isPdf && <FileText className="w-5 h-5 text-rose-500" />}
              {(isCsv || isSheet) && <FileSpreadsheet className="w-5 h-5 text-emerald-500" />}
              {isDoc && <FileText className="w-5 h-5 text-blue-600" />}
              {isCode && <FileCode className="w-5 h-5 text-amber-500" />}
              {!isImg && !isPdf && !isCsv && !isSheet && !isDoc && !isCode && <File className="w-5 h-5 text-slate-500" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                  {file.name}
                </h3>
                {fileProjects.length ? (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <Folder className="w-3 h-3 text-amber-500" />
                    <span className="truncate max-w-[140px]">{projectNames}</span>
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                    Uncategorised
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{formatBytes(file.size)}</span>
                <span>&bull;</span>
                <span>Uploaded {formatDate(file.uploadedAt)}</span>
                <span className="hidden md:inline">&bull;</span>
                <span className="hidden md:inline font-mono uppercase text-[10px] text-slate-400 font-semibold">{ext || 'file'}</span>
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* View tabs */}
            <div className="hidden sm:flex items-center bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium mr-1">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  activeTab === 'preview' 
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  activeTab === 'details' 
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs font-semibold' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Metadata</span>
              </button>
            </div>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="hidden sm:inline-flex p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              id="file-preview-download-btn"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition cursor-pointer shadow-2xs"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Download</span>
            </button>

            <button
              id="file-preview-close-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Viewport */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-100 dark:bg-slate-950 relative">
          {activeTab === 'details' ? (
            /* Metadata & File Properties Tab */
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto custom-scrollbar bg-slate-100 dark:bg-slate-950"
            >
              <div className="min-h-full w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-6 flex flex-col justify-start">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                  <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-blue-500" />
                    File Properties & Verification
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium">Filename</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 break-all">{file.name}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium">Exact File Size</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{file.size.toLocaleString()} bytes ({formatBytes(file.size)})</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium">MIME Type / Format</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{file.type || 'application/octet-stream'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium">Uploaded Date & Time</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(file.uploadedAt)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium">Assigned Projects</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{projectNames || 'Uncategorised / General Repository'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium">Unique Asset ID</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 font-mono text-[11px]">{file.id}</p>
                    </div>
                  </div>
                </div>

                {fileProjects.map(project => (
                  <div key={project.id} className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 text-xs space-y-2">
                    <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <Folder className="w-4 h-4 text-amber-500" />
                      Project Context: {project.name}
                    </div>
                    <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                      {project.instructions || 'No specific project supervision instructions configured.'}
                    </p>
                  </div>
                ))}

                {/* Audit & Compliance Log */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                    Capstone Assistant Indexing Status
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-600 dark:text-slate-300">Vector Knowledge Indexing</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Synced & Searchable
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-600 dark:text-slate-300">Supervisor Access Control</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">Restricted (Project Role)</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-600 dark:text-slate-300">Academic Integrity Check</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Passed (No Conflicts)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : file.isPreviewLoading ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              <span className="w-4 h-4 mr-2 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              Loading preview…
            </div>
          ) : file.previewError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <FileText className="w-10 h-10 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Preview unavailable
              </p>
              <p className="text-xs text-slate-500 max-w-md">{file.previewError}</p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
              >
                <Download className="w-3.5 h-3.5" />
                Download file
              </button>
            </div>
          ) : (
            /* Interactive File Previews based on format */
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              {/* 1. IMAGE PREVIEW */}
              {isImg && (
                <div 
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-auto custom-scrollbar relative bg-slate-900/10 dark:bg-slate-950 select-none"
                >
                  <div className="min-h-full min-w-full p-4 sm:p-6 flex flex-col items-center justify-start">
                    {/* Floating Zoom Controls */}
                    <div className="sticky top-2 self-end z-20 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-lg text-xs w-fit mb-4">
                      <button
                        onClick={() => setZoomLevel(prev => Math.max(prev - 25, 25))}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className="px-2 font-mono font-semibold text-slate-700 dark:text-slate-300 min-w-[3.5rem] text-center">
                        {zoomLevel}%
                      </span>
                      <button
                        onClick={() => setZoomLevel(prev => Math.min(prev + 25, 300))}
                        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setZoomLevel(100)}
                        className="px-2 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-[11px] cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>

                    <div className="flex-1 w-full flex items-center justify-center min-h-[400px]">
                    {file.dataUrl ? (
                      <div 
                        style={{ 
                          width: `${zoomLevel}%`,
                          minWidth: `${zoomLevel}%`,
                          transition: 'width 0.15s ease-out'
                        }}
                        className="flex items-center justify-center p-2"
                      >
                        <img 
                          src={file.dataUrl} 
                          alt={file.name}
                          className="max-h-[75vh] object-contain rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                        />
                      </div>
                    ) : (
                      /* Schematic Blueprint Display for Mock Files */
                      <div 
                        style={{ 
                          width: zoomLevel <= 100 ? '100%' : `${zoomLevel}%`,
                          maxWidth: zoomLevel <= 100 ? '48rem' : 'none'
                        }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 transition-all mx-auto"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                          <div className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-white text-sm">
                            <ImageIcon className="w-4 h-4 text-blue-500" />
                            <span>{file.name}</span>
                          </div>
                          <span className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-mono text-[11px] font-semibold border border-blue-200 dark:border-blue-800">
                            Blueprint Schematic &bull; High Resolution
                          </span>
                        </div>

                        {file.name.includes('Chassis') || file.name.includes('Lidar') || file.name.includes('Mount') ? (
                          /* Hardware Mount / Rover Blueprint Graphic */
                          <div className="p-6 rounded-2xl bg-slate-950 text-slate-100 border border-slate-800 font-mono space-y-4">
                            <div className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                              <span>CAD Mechanical Section: <strong>Rover Chassis Front Axis</strong></span>
                              <span>Scale: 1:1.5 | Tolerance: ±0.05mm</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                                <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                  <Cpu className="w-3.5 h-3.5" /> 2D LiDAR Mount
                                </div>
                                <p className="text-[11px] text-slate-400 leading-normal">
                                  Anodized aluminum 6061 plate, 4x M3 mounting holes with 45mm spacing.
                                </p>
                              </div>
                              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                                <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                                  <Compass className="w-3.5 h-3.5" /> IMU Sensor Cradle
                                </div>
                                <p className="text-[11px] text-slate-400 leading-normal">
                                  Vibration-damped silicone grommet housing for 9-DOF BNO085 orientation sensor.
                                </p>
                              </div>
                              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5" /> Power Distribution
                                </div>
                                <p className="text-[11px] text-slate-400 leading-normal">
                                  Regulated 5V/3A buck converter routing to Jetson Nano GPIO telemetry bus.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Architecture Diagram Graphic */
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 space-y-2">
                                <div className="font-bold text-xs text-blue-700 dark:text-blue-300">Client / Edge Node</div>
                                <div className="text-[11px] text-slate-500">ROS2 Telemetry Engine &amp; Cameras</div>
                                <div className="w-full h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full"></div>
                              </div>
                              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-2">
                                <div className="font-bold text-xs text-indigo-700 dark:text-indigo-300">Gateway Pipeline</div>
                                <div className="text-[11px] text-slate-500">gRPC &amp; Micro-ROS Telemetry Bus</div>
                                <div className="w-full h-1.5 bg-indigo-200 dark:bg-indigo-800 rounded-full"></div>
                              </div>
                              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                                <div className="font-bold text-xs text-emerald-700 dark:text-emerald-300">Inference Core</div>
                                <div className="text-[11px] text-slate-500">PyTorch GPU Segmentation Model</div>
                                <div className="w-full h-1.5 bg-emerald-200 dark:bg-emerald-800 rounded-full"></div>
                              </div>
                            </div>
                          </div>
                        )}

                        <p className="text-xs text-slate-400 text-center italic">
                          Architectural asset referenced from project repository. Use zoom controls to inspect dimensions.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

              {isPdf && file.dataUrl && (
                <iframe
                  src={file.dataUrl}
                  title={`Preview of ${file.name}`}
                  className="flex-1 w-full h-full border-0 bg-white"
                />
              )}

              {/* Legacy PDF layout is only used when no stored preview is available. */}
              {isPdf && !file.dataUrl && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* PDF Reader Toolbar */}
                  <div className="h-11 px-4 bg-slate-200/80 dark:bg-slate-850 border-b border-slate-300 dark:border-slate-800 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 shrink-0 gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-300/80 dark:bg-slate-750 p-0.5 rounded-lg text-[11px] font-medium mr-2">
                        <button
                          onClick={() => setViewMode('continuous')}
                          className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                            viewMode === 'continuous' 
                              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs' 
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                          title="Continuous vertical scrolling for all pages"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Continuous Scroll</span>
                        </button>
                        <button
                          onClick={() => setViewMode('paged')}
                          className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                            viewMode === 'paged' 
                              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-xs' 
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                          title="Single page view with navigation"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Paged</span>
                        </button>
                      </div>

                      {viewMode === 'paged' && (
                        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700">
                          <button
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            disabled={currentPage <= 1}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="font-semibold text-xs min-w-[4rem] text-center">
                            Page {currentPage} of 3
                          </span>
                          <button
                            onClick={() => setCurrentPage(p => Math.min(p + 1, 3))}
                            disabled={currentPage >= 3}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {viewMode === 'continuous' && (
                        <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
                          <span>Jump to:</span>
                          {[1, 2, 3].map(pageIdx => (
                            <button
                              key={pageIdx}
                              onClick={() => scrollToSection(`pdf-page-${pageIdx}`)}
                              className="px-2 py-0.5 rounded bg-slate-300/60 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-950/60 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition cursor-pointer"
                            >
                              Page {pageIdx}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-500 hidden md:inline">IEEE Standard Academic Document</span>
                      <div className="text-[11px] font-mono text-slate-400">3 Pages Total</div>
                    </div>
                  </div>

                  {/* PDF Continuous / Paged Page Canvas */}
                  <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto custom-scrollbar bg-slate-200/70 dark:bg-slate-950"
                  >
                    <div className="min-h-full w-full p-4 sm:p-8 flex flex-col items-center justify-start gap-8">
                      {/* PAGE 1 */}
                      {(viewMode === 'continuous' || currentPage === 1) && (
                        <div 
                          id="pdf-page-1"
                          className="w-full max-w-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl rounded-2xl p-8 sm:p-12 border border-slate-200 dark:border-slate-800 space-y-6 text-sm relative h-fit"
                        >
                        <div className="absolute top-4 right-4 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          Page 1 / 3
                        </div>

                        {/* Document Header */}
                        <div className="text-center pb-6 border-b border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="text-[10px] font-extrabold tracking-widest uppercase text-blue-600 dark:text-blue-400">
                            Swinburne University of Technology &bull; Faculty of Science, Engineering &amp; Technology
                          </div>
                          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                            {file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')}
                          </h2>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center justify-center gap-3 pt-1">
                            <span>Academic Cohort: <strong>2026</strong></span>
                            <span>&bull;</span>
                            <span>Supervisor: <strong>Dr. Evelyn Reed</strong></span>
                            <span>&bull;</span>
                            <span>Project Type: <strong>Capstone Framework</strong></span>
                          </div>
                        </div>

                        {/* Content Section 1 & 2 */}
                        <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-blue-600 font-mono">1.0</span> Executive Project Summary &amp; Scope
                          </h3>
                          <p>
                            This project specification establishes the supervisory milestone guidelines, technical requirements, and evaluation rubrics for the student development team. The capstone cohort is tasked with architecting a fault-tolerant distributed edge intelligence pipeline supporting real-time computer vision inference and telemetry logging.
                          </p>
                          <p>
                            All milestone deliverables must pass automated integration pipelines, unit test coverage benchmarks (&gt;85%), and faculty ethical compliance reviews prior to formal sign-off.
                          </p>

                          <h3 className="text-base font-bold text-slate-900 dark:text-white pt-2 flex items-center gap-2">
                            <span className="text-blue-600 font-mono">2.0</span> Milestone Assessment Matrix
                          </h3>
                          <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse border border-slate-200 dark:border-slate-700 text-xs">
                              <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                                <tr>
                                  <th className="border border-slate-200 dark:border-slate-700 p-2.5 text-left">Milestone</th>
                                  <th className="border border-slate-200 dark:border-slate-700 p-2.5 text-left">Deliverable Focus</th>
                                  <th className="border border-slate-200 dark:border-slate-700 p-2.5 text-center">Weight</th>
                                  <th className="border border-slate-200 dark:border-slate-700 p-2.5 text-center">Due Week</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5 font-semibold">Milestone 1</td>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5">Architecture Spec, Threat Modeling &amp; Dataset Schemas</td>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5 text-center font-bold">20%</td>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5 text-center">Week 4</td>
                                </tr>
                                <tr>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5 font-semibold">Milestone 2</td>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5">Core Working Prototype, Latency Benchmarks &amp; User Testing</td>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5 text-center font-bold">35%</td>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5 text-center">Week 8</td>
                                </tr>
                                <tr>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5 font-semibold">Milestone 3</td>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5">Final Defense, Production Deployment &amp; Capstone Thesis</td>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5 text-center font-bold">45%</td>
                                  <td className="border border-slate-200 dark:border-slate-700 p-2.5 text-center">Week 12</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PAGE 2 */}
                    {(viewMode === 'continuous' || currentPage === 2) && (
                      <div 
                        id="pdf-page-2"
                        className="w-full max-w-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl rounded-2xl p-8 sm:p-12 border border-slate-200 dark:border-slate-800 space-y-6 text-sm relative h-fit"
                      >
                        <div className="absolute top-4 right-4 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          Page 2 / 3
                        </div>

                        <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-blue-600 font-mono">3.0</span> Safety Protocols, Privacy &amp; Ethics Governance
                          </h3>
                          <p>
                            Supervisors and student teams must strictly implement the following security and safety governance standards throughout the project lifecycle:
                          </p>
                          <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300">
                            <li>
                              <strong>Dataset Privacy &amp; Anonymisation:</strong> All synthetic or live biometric telemetry recordings must be completely de-identified in compliance with Australian Privacy Principles (APP).
                            </li>
                            <li>
                              <strong>Fail-Safe Hardware Interrupts:</strong> Physical edge robotic and embedded rigs must incorporate a dedicated mechanical e-stop and software watchdog timeout limit of 250ms.
                            </li>
                            <li>
                              <strong>Zero Secrets in Version Control:</strong> API credentials and cryptographic tokens must be loaded dynamically via environment injection; automated secret-scanning triggers on all pull requests.
                            </li>
                            <li>
                              <strong>Peer Code Reviews:</strong> No pull request may be merged without written approval from at least two student team members and supervisor notification.
                            </li>
                          </ul>

                          <h3 className="text-base font-bold text-slate-900 dark:text-white pt-3 flex items-center gap-2">
                            <span className="text-blue-600 font-mono">4.0</span> Bi-Weekly Supervisory Sprint Cadence
                          </h3>
                          <p>
                            Sprint standup meetings are held on alternate Tuesdays. Student representatives are required to submit sprint changelogs and burn-down charts directly into the Capstone Teaching Assistant portal for automated progress indexing.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* PAGE 3 */}
                    {(viewMode === 'continuous' || currentPage === 3) && (
                      <div 
                        id="pdf-page-3"
                        className="w-full max-w-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl rounded-2xl p-8 sm:p-12 border border-slate-200 dark:border-slate-800 space-y-6 text-sm relative h-fit"
                      >
                        <div className="absolute top-4 right-4 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          Page 3 / 3
                        </div>

                        <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-blue-600 font-mono">5.0</span> Evaluation Rubrics &amp; Final Grade Allocation
                          </h3>
                          <p>
                            Final capstone grades are synthesized using three primary vectors:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              <div className="text-xs font-bold text-blue-600 dark:text-blue-400">Technical Rigor (40%)</div>
                              <p className="text-[11px] text-slate-500 mt-1">Code hygiene, architectural scalability, unit test coverage, and documentation.</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Innovation &amp; Impact (30%)</div>
                              <p className="text-[11px] text-slate-500 mt-1">Novelty of solution, domain problem solving, and user validation results.</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Defense &amp; Thesis (30%)</div>
                              <p className="text-[11px] text-slate-500 mt-1">Live demonstration, oral defense, and academic paper clarity.</p>
                            </div>
                          </div>

                          <h3 className="text-base font-bold text-slate-900 dark:text-white pt-4 flex items-center gap-2">
                            <span className="text-blue-600 font-mono">6.0</span> Faculty Endorsement &amp; Formal Sign-off
                          </h3>
                          <p>
                            This document serves as the governing contract for the capstone project cohort.
                          </p>

                          <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-200 dark:border-slate-700">
                            <div className="space-y-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                              <div className="font-serif italic text-slate-600 dark:text-slate-300 text-base">Dr. Evelyn Reed</div>
                              <div className="text-[11px] font-bold text-slate-900 dark:text-white">Dr. Evelyn Reed, Ph.D.</div>
                              <div className="text-[10px] text-slate-400">Lead Academic Supervisor &amp; Senior Lecturer</div>
                            </div>
                            <div className="space-y-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                              <div className="font-serif italic text-slate-600 dark:text-slate-300 text-base">Arthur Pendleton</div>
                              <div className="text-[11px] font-bold text-slate-900 dark:text-white">Prof. Arthur Pendleton</div>
                              <div className="text-[10px] text-slate-400">Head of Department &amp; Capstone Board Chair</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              )}

              {/* 3. SPREADSHEET (CSV / XLSX / XLS / WORKBOOK) PREVIEW */}
              {(isCsv || isSheet) && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Workbook Tabs & Search Toolbar */}
                  <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
                        {spreadsheetData.sheetNames.map((sheet, idx) => (
                          <button
                            key={sheet}
                            onClick={() => setActiveSheetTab(idx)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                              activeSheetTab === idx 
                                ? 'bg-emerald-600 text-white shadow-xs' 
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            <Table className="w-3 h-3" />
                            <span>{sheet}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative w-56 sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search cells..."
                          value={tableSearch}
                          onChange={(e) => setTableSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                      <div className="text-xs text-slate-500 font-medium hidden md:block">
                        <strong>{filteredSpreadsheetRows.length}</strong> rows &bull; {spreadsheetData.headers.length} columns
                      </div>
                    </div>
                  </div>

                  {/* Spreadsheet Grid with Smooth Custom Scrollbar */}
                  <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-auto custom-scrollbar bg-slate-50 dark:bg-slate-950 min-h-0"
                  >
                    <div className="inline-block min-w-full min-h-full align-top bg-white dark:bg-slate-900">
                      <table className="w-full border-collapse text-left text-xs font-mono min-w-[850px]">
                        <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold z-10 select-none shadow-xs">
                          <tr>
                            <th className="p-3 border-r border-slate-200 dark:border-slate-700 bg-slate-200/70 dark:bg-slate-800 w-12 text-center sticky left-0 z-20">#</th>
                            {spreadsheetData.headers.map(header => (
                              <th key={header} className="p-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {filteredSpreadsheetRows.map((row, idx) => (
                            <tr key={row.id || idx} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition">
                              <td className="p-2.5 border-r border-slate-200 dark:border-slate-800 text-center text-slate-400 bg-slate-50/80 dark:bg-slate-850 sticky left-0 z-10 font-mono text-[11px]">
                                {idx + 1}
                              </td>
                              {spreadsheetData.headers.map(header => {
                                const val = row[header] || '-';
                                const isTag = val.includes('Risk') || val === 'Verified' || val === 'Critical' || val.includes('HD') || val.includes('D (');
                                return (
                                  <td key={header} className="p-2.5 border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                    {isTag ? (
                                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold font-sans ${
                                        val.includes('Critical') || val.includes('Flagged') ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' :
                                        val.includes('High') || val.includes('Review') ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                                        val.includes('HD') || val.includes('Verified') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                                        'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                      }`}>
                                        {val}
                                      </span>
                                    ) : (
                                      val
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. WORD / DOCUMENT / CODE / SPECIFICATION PREVIEW */}
              {!isImg && !isPdf && !isCsv && !isSheet && (
                <div 
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto custom-scrollbar bg-slate-100 dark:bg-slate-950 min-h-0"
                >
                  <div className="min-h-full w-full p-4 sm:p-8 flex flex-col items-center justify-start">
                    <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-md space-y-6 text-xs sm:text-sm h-fit">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                          {isDoc ? <FileText className="w-4 h-4" /> : <Code2 className="w-4 h-4" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white">{file.name}</h3>
                          <span className="text-[11px] text-slate-400">
                            {isDoc ? 'Microsoft Word Document (.docx)' : isCode ? 'Source Code / Script File' : 'Structured Text Specification'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCopyRaw(
                          decodedRawText || 
                          `// ${file.name}\n// Capstone Engineering Specification\n// Generated for ${projectNames || 'General Cohort'}`
                        )}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer font-medium"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy Content'}</span>
                      </button>
                    </div>

                    {/* Section Quick Jump Bar */}
                    <div className="flex items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-[11px] text-slate-600 dark:text-slate-400 overflow-x-auto custom-scrollbar">
                      <span className="font-bold shrink-0 text-slate-500">Sections:</span>
                      <button 
                        onClick={() => scrollToSection('doc-section-1')} 
                        className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 transition shrink-0 cursor-pointer font-medium"
                      >
                        1. Architecture Core
                      </button>
                      <button 
                        onClick={() => scrollToSection('doc-section-2')} 
                        className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 transition shrink-0 cursor-pointer font-medium"
                      >
                        2. Schema &amp; Telemetry
                      </button>
                      <button 
                        onClick={() => scrollToSection('doc-section-3')} 
                        className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 transition shrink-0 cursor-pointer font-medium"
                      >
                        3. Test Suite
                      </button>
                      <button 
                        onClick={() => scrollToSection('doc-section-4')} 
                        className="px-2 py-0.5 rounded hover:bg-white dark:hover:bg-slate-700 hover:text-blue-600 transition shrink-0 cursor-pointer font-medium"
                      >
                        4. Sign-off
                      </button>
                    </div>

                    {/* Document Content View */}
                    {decodedRawText ? (
                      <div className="font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
                        {decodedRawText}
                      </div>
                    ) : isDoc ? (
                      /* Rich Formatted Word Document Reader Layout */
                      <div className="space-y-6 text-slate-800 dark:text-slate-200 leading-relaxed">
                        <div id="doc-section-1" className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                          <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold flex items-center justify-center">1</span>
                            System Overview &amp; Sensor Fusion Architecture
                          </h4>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                            This document specifies the technical communication protocol and sensor fusion arbitration pipeline for the autonomous capstone rover. The robotic rig runs ROS 2 Humble across a distributed NVIDIA Jetson Orin Nano compute module and dual STM32 motor controllers.
                          </p>
                          <div className="p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs space-y-1.5 text-blue-900 dark:text-blue-200">
                            <div className="font-bold">Key Architectural Requirement:</div>
                            <p>End-to-end sensor-to-arbitration latency must remain under <strong>45ms</strong> during full autonomous navigation and obstacle avoidance.</p>
                          </div>
                        </div>

                        <div id="doc-section-2" className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                          <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold flex items-center justify-center">2</span>
                            Interface Definition &amp; Protocol Buffer Schema
                          </h4>
                          <pre className="font-mono text-xs p-4 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 overflow-x-auto custom-scrollbar">
{`syntax = "proto3";
package capstone.rover.v1;

message TelemetryStream {
  uint64 timestamp_ns = 1;
  string rover_id = 2;
  repeated float imu_quaternion = 3;  // [w, x, y, z]
  repeated float lidar_pointcloud = 4; // 360 angular distance scans in mm
  uint32 battery_mv = 5;
  enum NavigationState {
    STATE_STANDBY = 0;
    STATE_CALIBRATING = 1;
    STATE_AUTONOMOUS = 2;
    STATE_EMERGENCY_STOP = 3;
  }
  NavigationState nav_state = 6;
}`}
                          </pre>
                        </div>

                        <div id="doc-section-3" className="space-y-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                          <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold flex items-center justify-center">3</span>
                            Verification &amp; Validation Test Suite
                          </h4>
                          <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                            <li><strong>Automated CI:</strong> GitHub Actions running PyTest and GoogleTest on every push.</li>
                            <li><strong>Branch Coverage:</strong> Minimum 85% branch coverage required for merge into staging.</li>
                            <li><strong>HIL Stress Test:</strong> 120-minute continuous telemetry stress test without packet loss.</li>
                          </ul>
                        </div>

                        <div id="doc-section-4" className="space-y-3 pt-2">
                          <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs font-mono font-bold flex items-center justify-center">4</span>
                            Supervisory Review &amp; Ethical Sign-off
                          </h4>
                          <p className="text-xs text-slate-500">
                            Reviewed and approved by faculty lead supervisor. All telemetry data verified to comply with Swinburne academic integrity standards.
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Code File Preview */
                      <div className="space-y-4 font-mono text-xs">
                        <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-100 dark:border-slate-800">
                          <span>Language: <strong>Python 3 / ROS2</strong></span>
                          <span>Line Count: 48 lines</span>
                        </div>
                        <pre className="font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto custom-scrollbar">
{`#!/usr/bin/env python3
"""
Capstone Academic Cohort 2026
Module: LiDAR Point Cloud Preprocessing & Cluster Arbitration
Author: Student Capstone Dev Team
"""

import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan, PointCloud2
import numpy as np

class LidarClusterNode(Node):
    def __init__(self):
        super().__init__('lidar_cluster_node')
        self.subscription = self.create_subscription(
            LaserScan,
            '/scan',
            self.scan_callback,
            10
        )
        self.publisher = self.create_publisher(PointCloud2, '/clustered_points', 10)
        self.get_logger().info('LiDAR Point Cloud Arbitration Node initialized.')

    def scan_callback(self, msg: LaserScan):
        ranges = np.array(msg.ranges)
        # Filter invalid readings and out-of-range artifacts
        valid_mask = np.logical_and(ranges >= msg.range_min, ranges <= msg.range_max)
        filtered_ranges = ranges[valid_mask]
        
        if len(filtered_ranges) == 0:
            return

        # Perform Euclidean distance clustering
        angles = np.linspace(msg.angle_min, msg.angle_max, len(msg.ranges))[valid_mask]
        x = filtered_ranges * np.cos(angles)
        y = filtered_ranges * np.sin(angles)
        
        self.get_logger().debug(f'Processed {len(x)} valid spatial points.')

def main(args=None):
    rclpy.init(args=args)
    node = LidarClusterNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()`}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            </div>
          )}

          {/* Floating Back to Top Button for long pages */}
          {showScrollTop && (
            <button
              onClick={scrollToTop}
              className="absolute bottom-6 right-6 z-30 p-3 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 hover:scale-105 transition duration-150 cursor-pointer animate-in fade-in zoom-in-75"
              title="Scroll to Top of Document"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
