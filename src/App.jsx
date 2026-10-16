import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import Swal from 'sweetalert2';

import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import './App.css';
import PreFlightModal from './PreFlightModal';
import HelpModal from './HelpModal';
import OcrConfigModal from './OcrConfigModal';
import usePdfProcessor from './usePdfProcessor';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// 🌟 ลำดับหมวดหมู่
const CATEGORIES = ['AR', 'IN', 'EE', 'AC', 'ST', 'SN', 'ME', 'AD'];

const DEFAULT_CROP = { width: 16, height: 15, xOffset: 0, yOffset: 0 };
const DEFAULT_ALT_CROP = { width: 25, height: 25, xOffset: 0, yOffset: 0 };
const DEFAULT_CR_LIST = { width: 25, height: 10, xOffset: 0, yOffset: 0 };
const DEFAULT_COVER = { width: 30, height: 10, xOffset: 0, yOffset: 0 };

function App() {
  const [masterFile, setMasterFile] = useState(null);
  const [crFiles, setCrFiles] = useState([]); 
  const [dragMaster, setDragMaster] = useState(false);
  const [dragCr, setDragCr] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // AI State
  const [aiEnabled, setAiEnabled] = useState(localStorage.getItem('aiEnabled') === 'true');
  const [geminiApiKey, setGeminiApiKey] = useState(localStorage.getItem('geminiApiKey') || '');

  const [showOcrConfig, setShowOcrConfig] = useState(false);
  const [cropConfig, setCropConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('ocr_cropConfig');
      return saved ? JSON.parse(saved) : DEFAULT_CROP;
    } catch { return DEFAULT_CROP; }
  });
  const [altCropConfig, setAltCropConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('ocr_altCropConfig');
      return saved ? JSON.parse(saved) : DEFAULT_ALT_CROP;
    } catch { return DEFAULT_ALT_CROP; }
  });
  const [crListCropConfig, setCrListCropConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('ocr_crListCropConfig');
      return saved ? JSON.parse(saved) : DEFAULT_CR_LIST;
    } catch { return DEFAULT_CR_LIST; }
  });
  const [coverCropConfig, setCoverCropConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('ocr_coverCropConfig');
      return saved ? JSON.parse(saved) : DEFAULT_COVER;
    } catch { return DEFAULT_COVER; }
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('ocr_cropConfig', JSON.stringify(cropConfig));
  }, [cropConfig]);
  useEffect(() => {
    localStorage.setItem('ocr_altCropConfig', JSON.stringify(altCropConfig));
  }, [altCropConfig]);
  useEffect(() => {
    localStorage.setItem('ocr_crListCropConfig', JSON.stringify(crListCropConfig));
  }, [crListCropConfig]);
  useEffect(() => {
    localStorage.setItem('ocr_coverCropConfig', JSON.stringify(coverCropConfig));
  }, [coverCropConfig]);

  const handleResetOcrDefaults = () => {
    setCropConfig(DEFAULT_CROP);
    setAltCropConfig(DEFAULT_ALT_CROP);
    setCrListCropConfig(DEFAULT_CR_LIST);
    setCoverCropConfig(DEFAULT_COVER);
    localStorage.removeItem('ocr_cropConfig');
    localStorage.removeItem('ocr_altCropConfig');
    localStorage.removeItem('ocr_crListCropConfig');
    localStorage.removeItem('ocr_coverCropConfig');
  };

  const [activeCategories, setActiveCategories] = useState({
    AR: true, IN: true, EE: true, AC: true, ST: true, SN: true, ME: true, AD: false
  });

  const [resetKey, setResetKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const processor = usePdfProcessor(masterFile, crFiles, activeCategories, cropConfig, altCropConfig, crListCropConfig, coverCropConfig, isDarkMode, CATEGORIES, aiEnabled, geminiApiKey);
  const {
    logs, isProcessing, downloadUrl, crSummary, stats, downloadFilename,
    progress, previewData, testPageNum, reviewData, manualInputs,
    setTestPageNum, setManualInputs, setReviewData,
    handleTestOcr, handleScanFiles, handleConfirmExecute, exportLogReport, resetProcessor
  } = processor;

  const logEndRef = useRef(null);
  const scrollToBottom = () => logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [logs]);

  const handleCopyCrNames = () => {
    if (crFiles.length === 0) return;
    const fileNames = crFiles.map(f => f.name).join('\n');
    navigator.clipboard.writeText(fileNames).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); 
    });
  };

  const handleReset = () => {
    setMasterFile(null);
    setCrFiles([]);
    setResetKey(prev => prev + 1); 
    resetProcessor();
  };

  const handleOpenOcrConfig = () => {
    Swal.fire({
      title: 'ต้องการรหัสผ่าน',
      text: 'กรุณาใส่รหัสผ่านเพื่อเข้าถึงส่วนการตั้งค่าขั้นสูง',
      input: 'password',
      inputPlaceholder: 'Password',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
      showCancelButton: true,
      customClass: {
        popup: isDarkMode ? 'theme-dark' : 'theme-light',
        confirmButton: 'btn-run',
        cancelButton: 'btn-secondary',
        input: 'manual-input',
      },
      preConfirm: (password) => {
        if (password === '0000') {
          return true;
        }
        Swal.showValidationMessage('รหัสผ่านไม่ถูกต้อง!');
        return false;
      },
      allowOutsideClick: true,
    }).then((result) => {
      if (result.isConfirmed) {
        setShowOcrConfig(true);
      }
    });
  };

  const handleAiSettings = () => {
    Swal.fire({
      title: 'ตั้งค่า Gemini AI',
      text: 'กรุณาใส่ Gemini API Key ของคุณ (ข้อมูลนี้จะถูกบันทึกไว้ในเครื่องของคุณเท่านั้น)',
      input: 'password',
      inputValue: geminiApiKey,
      inputPlaceholder: 'AIzaSy...',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      customClass: {
        popup: isDarkMode ? 'theme-dark' : 'theme-light',
        confirmButton: 'btn-run',
        cancelButton: 'btn-secondary',
        input: 'manual-input',
      },
    }).then((result) => {
      if (result.isConfirmed) {
        setGeminiApiKey(result.value);
        localStorage.setItem('geminiApiKey', result.value);
        Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: isDarkMode ? 'theme-dark' : 'theme-light' }
        });
      }
    });
  };

  const toggleAiMode = () => {
    const newVal = !aiEnabled;
    setAiEnabled(newVal);
    localStorage.setItem('aiEnabled', newVal);
  };

  const handleExcludeItem = (itemToExclude, type) => {
    setReviewData(currentData => {
      if (!currentData) return null;

      const list = currentData[type] || [];
      const updatedList = list.filter(item => {
        if (type === 'purged') {
          return item.masterPageNum !== itemToExclude.masterPageNum;
        }
        return item.dwgNo !== itemToExclude.dwgNo;
      });

      return { ...currentData, [type]: updatedList };
    });
  };

  return (
    <div className={isDarkMode ? 'theme-dark' : 'theme-light'} style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', height: 'auto', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', padding: '24px 16px', boxSizing: 'border-box', transition: 'background-color 0.2s' }}>
      <PreFlightModal 
        reviewData={reviewData} masterFile={masterFile} crFiles={crFiles} manualInputs={manualInputs} 
        setManualInputs={setManualInputs} setReviewData={setReviewData} 
        handleConfirmExecute={handleConfirmExecute} onExcludeItem={handleExcludeItem}
      />

      <OcrConfigModal 
        showOcrConfig={showOcrConfig} setShowOcrConfig={setShowOcrConfig} 
        cropConfig={cropConfig} setCropConfig={setCropConfig} 
        altCropConfig={altCropConfig} setAltCropConfig={setAltCropConfig}
        crListCropConfig={crListCropConfig} setCrListCropConfig={setCrListCropConfig}
        coverCropConfig={coverCropConfig} setCoverCropConfig={setCoverCropConfig}
        testPageNum={testPageNum} setTestPageNum={setTestPageNum} 
        handleTestOcr={handleTestOcr} previewData={previewData} 
        masterFile={masterFile} crFiles={crFiles}
        aiEnabled={aiEnabled} toggleAiMode={toggleAiMode}
        geminiApiKey={geminiApiKey} setGeminiApiKey={(val) => { setGeminiApiKey(val); localStorage.setItem('geminiApiKey', val); }}
        onResetDefaults={handleResetOcrDefaults}
      />

      <HelpModal showHelp={showHelp} setShowHelp={setShowHelp} />

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '1024px', gap: '16px' }}>

        {/* 🌟 Header & Control Panel */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '20px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '900', letterSpacing: '0.5px', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>FloorPlan-Revised-CR-Auto</h1>
                <span className="badge-primary" style={{ whiteSpace: 'nowrap' }}>v4.1</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold', marginRight: '4px', whiteSpace: 'nowrap' }}>หมวดหมู่ (FILTER):</span>
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => !isProcessing && setActiveCategories(prev => ({...prev, [cat]: !prev[cat]}))}
                    className={`cat-toggle ${activeCategories[cat] ? 'active' : 'inactive'}`}
                    disabled={isProcessing}
                    style={{ flexShrink: 0, padding: '2px 7px' }}
                    title={activeCategories[cat] ? `ค้นหาหมวด ${cat}` : `ข้ามหมวด ${cat}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <button 
              className={`btn-tool ${aiEnabled ? 'active' : ''}`} 
              onClick={toggleAiMode} 
              style={{ borderColor: aiEnabled ? '#9c27b0' : '', color: aiEnabled ? '#9c27b0' : '', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '36px', padding: '0 10px' }}
              title={aiEnabled ? 'คลิกเพื่อปิด AI Mode' : 'คลิกเพื่อเปิด AI Mode'}
            >
              <span>✨</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>AI</span>
            </button>
            
            <button 
              className="btn-tool btn-icon" 
              onClick={handleAiSettings} 
              style={{ backgroundColor: 'rgba(156, 39, 176, 0.1)', color: '#9c27b0', borderColor: 'rgba(156, 39, 176, 0.3)' }} 
              title="ตั้งค่า Gemini AI API Key"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5L11 9l-1.5-1.5L8 9l-1.5-1.5L5 9"></path>
                <circle cx="7.5" cy="16.5" r="5.5"></circle>
              </svg>
            </button>

            <button 
              className="btn-tool btn-icon" 
              onClick={() => setShowHelp(true)} 
              title="คู่มือการใช้งาน (Manual)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            </button>

            <button 
              className="btn-tool btn-icon btn-ocr" 
              onClick={handleOpenOcrConfig} 
              title="ตั้งค่า OCR (OCR Configuration)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>

            <button 
              className="btn-tool btn-icon" 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              title={isDarkMode ? 'เปลี่ยนเป็นโหมดสว่าง (Light Mode)' : 'เปลี่ยนเป็นโหมดมืด (Dark Mode)'}
            >
              {isDarkMode ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>

            <button 
              className="btn-tool btn-icon btn-reset" 
              onClick={handleReset} 
              title="เริ่มใหม่ (Reset All)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </div>
        </div>

        {/* 🌟 Upload & Action Area */}
        <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
          <div 
            className={`upload-box ${dragMaster ? 'drag-active' : ''}`} 
            style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            onDragOver={(e) => { e.preventDefault(); setDragMaster(true); }}
            onDragLeave={() => setDragMaster(false)}
            onDrop={(e) => { e.preventDefault(); setDragMaster(false); if(e.dataTransfer.files.length) setMasterFile(e.dataTransfer.files[0]); }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '0.5px' }}>[1] ไฟล์ MASTER</span>
              {masterFile ? <span style={{ fontSize: '0.85rem', color: 'var(--color-up)', fontWeight: 'bold' }}>เชื่อมต่อแล้ว</span> : <span style={{ fontSize: '0.8rem', color: 'var(--border-color)' }}>รอไฟล์ (AWAITING)</span>}
            </div>
            <input key={resetKey ? `master-${resetKey}` : 'master'} type="file" accept="application/pdf" onChange={(e) => setMasterFile(e.target.files[0])} disabled={isProcessing} style={{ width: '100%' }} />
            {masterFile && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={masterFile.name}>
                📄 {masterFile.name} ({(masterFile.size / (1024 * 1024)).toFixed(2)} MB)
              </div>
            )}
          </div>

          <div 
            className={`upload-box ${dragCr ? 'drag-active' : ''}`} 
            style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}
            onDragOver={(e) => { e.preventDefault(); setDragCr(true); }}
            onDragLeave={() => setDragCr(false)}
            onDrop={(e) => { e.preventDefault(); setDragCr(false); if(e.dataTransfer.files.length) setCrFiles(Array.from(e.dataTransfer.files)); }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '700', letterSpacing: '0.5px' }}>[2] รายการ CR</span>
                {crFiles.length > 0 && (
                  <button 
                    onClick={(e) => { e.preventDefault(); handleCopyCrNames(); }}
                    style={{ 
                      background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: copied ? 'var(--color-up)' : 'var(--text-muted)', 
                      padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', cursor: 'pointer', fontFamily: 'JetBrains Mono', fontWeight: 'bold', transition: 'all 0.2s'
                    }}
                    title="Copy File Names"
                  >
                    {copied ? '✅ คัดลอกแล้ว' : '📋 คัดลอกชื่อ'}
                  </button>
                )}
              </div>
              {crFiles.length > 0 ? <span style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>พบ {crFiles.length} รายการ</span> : <span style={{ fontSize: '0.8rem', color: 'var(--border-color)' }}>รอไฟล์ (AWAITING)</span>}
            </div>
            <input key={resetKey ? `cr-${resetKey}` : 'cr'} type="file" multiple accept="application/pdf" onChange={(e) => setCrFiles(Array.from(e.target.files))} disabled={isProcessing} style={{ width: '100%' }} />
            {crFiles.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📁 รวม {crFiles.length} ไฟล์ ({(crFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)} MB)
              </div>
            )}
          </div>

          <button 
            className="btn-run"
            onClick={handleScanFiles} 
            disabled={!masterFile || crFiles.length === 0 || isProcessing || reviewData} 
            style={{ 
              padding: '0 36px', 
              border: 'none', 
              color: '#fff', 
              fontSize: '1.1rem', 
              fontWeight: 'bold',
              minWidth: '200px',
              letterSpacing: '1.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            {isProcessing ? (
              <><div className="spinner"></div> PROCESSING {progress}%</>
            ) : (
              '⚡ เริ่มทำงาน'
            )}
          </button>
        </div>

        {/* 🌟 Dashboard (สไตล์ Order Book) */}
        {(crSummary.length > 0 || downloadUrl) && (
          <div style={{ display: 'flex', gap: '16px', flexShrink: 0, minHeight: '160px' }}>
            {crSummary.length > 0 && (
              <div className="glass-panel" style={{ flex: 3, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <span>รายการทำงาน (ORDER BOOK: {crSummary.length})</span>
                  {isProcessing && <span style={{ color: 'var(--color-warning)' }}>กำลังซิงค์...</span>}
                </div>
                
                <div className="terminal-scroll" style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: '6px', flex: 1, overflowY: 'auto' }}>
                  {crSummary.map((item, idx) => {
                    let color = 'var(--text-muted)';
                    let prefix = '';
                    if (item.status === 'success') { color = 'var(--color-up)'; prefix = 'UPDT'; }
                    else if (item.status === 'new_append') { color = 'var(--color-primary)'; prefix = 'INSR'; }
                    else if (item.status === 'searching') { color = 'var(--color-warning)'; prefix = 'WAIT'; }

                    return (
                      <div key={idx} className={`badge-item ${item.status === 'searching' ? 'status-searching' : ''}`} style={{ borderColor: color, color: color }}>
                        <span className="badge-prefix" style={{ background: color, color: '#fff' }}>{prefix}</span>
                        <span>{item.dwgNo === 'COVER' ? 'COVER_PAGE' : item.dwgNo}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {downloadUrl && (
              <div className="glass-panel" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--color-up)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>สรุปผลการทำงาน (SUMMARY)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.9rem', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>แทนที่ใหม่ (REPLACED):</span><span style={{ color: 'var(--color-up)' }}>{stats.replaced}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>เพิ่มหน้า (APPENDED):</span><span style={{ color: 'var(--color-primary)' }}>{stats.appended}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>ลบทิ้ง (PURGED):</span><span style={{ color: 'var(--color-down)' }}>{stats.purged}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <a href={downloadUrl} download={downloadFilename} className="btn-run" style={{ flex: 2, textAlign: 'center', padding: '8px 0', textDecoration: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', background: 'var(--color-up)' }}>
                    ดาวน์โหลด PDF
                  </a>
                  <button onClick={exportLogReport} className="btn-secondary" style={{ flex: 1, padding: '8px 0', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    Export Log
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🌟 Terminal / Log Area */}
        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '3px', background: 'var(--border-color)' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.2s' }}></div>
          </div>
          
          <div className="terminal-scroll" style={{ flex: 1, padding: '16px', overflowY: 'auto', fontSize: '0.9rem', lineHeight: '1.6', background: 'var(--upload-bg)' }}>
            {logs.map((log, i) => {
              let logColor = 'var(--text-muted)'; 
              if (log.includes('[+]') || log.includes('MATCH')) logColor = 'var(--color-up)'; 
              if (log.includes('[-]') || log.includes('ERR') || log.includes('DROP') || log.includes('ABORT')) logColor = 'var(--color-down)'; 
              if (log.includes('NEW_ENTRY') || log.includes('EXEC')) logColor = 'var(--color-primary)'; 
              if (log.includes('SYS') || log.includes('IDX') || log.includes('DATA')) logColor = 'var(--text-main)'; 
              if (log.includes('LOCKED') || log.includes('PAUSE') || log.includes('FORCE')) logColor = 'var(--color-warning)'; 
              
              return <div key={i} style={{ color: logColor }}>{log}</div>;
            })}
            <div ref={logEndRef} />
            {!logs.length && <div style={{ color: 'var(--text-muted)' }}>{'>'} สถานะ: รอคำสั่ง (STANDBY)</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;