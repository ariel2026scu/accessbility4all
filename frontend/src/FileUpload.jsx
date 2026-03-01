import React, { useState, useRef } from 'react';

const FileUpload = ({ onTextExtracted, apiUrl, devMode }) => {
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef(null);

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ];
  const maxFileSize = 10 * 1024 * 1024; // 10 MB

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validateAndSetFile = (selectedFile) => {
    setError(null);
    setDone(false);
    if (!selectedFile) return;
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Invalid file type. Please upload a .pdf, .docx, or .txt file.');
      return;
    }
    if (selectedFile.size > maxFileSize) {
      setError('File is too large. Maximum size is 10 MB.');
      return;
    }
    setFile(selectedFile);
  };

  const handleFileChange = (e) => validateAndSetFile(e.target.files[0]);
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => { e.preventDefault(); validateAndSetFile(e.dataTransfer.files[0]); };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);

    // Dev mode: read .txt directly; fake extraction for pdf/docx
    if (devMode) {
      if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target.result;
          setIsUploading(false);
          setDone(true);
          if (onTextExtracted) onTextExtracted(text, { filename: file.name, totalChars: text.length });
        };
        reader.onerror = () => { setIsUploading(false); setError('Failed to read file.'); };
        reader.readAsText(file);
      } else {
        setTimeout(() => {
          const fakeText = `[DEV MODE — ${file.name}]\n\nThis Agreement governs the terms and conditions under which you may use our services. By using our services, you agree to these terms. The Company may modify these terms at any time without prior notice. All disputes shall be resolved through binding arbitration, waiving your right to a jury trial.`;
          setIsUploading(false);
          setDone(true);
          if (onTextExtracted) onTextExtracted(fakeText, { filename: file.name, totalChars: fakeText.length });
        }, 600);
      }
      return;
    }

    // Production: call backend
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${apiUrl}/upload`, { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${response.status})`);
      }
      const data = await response.json();
      setDone(true);
      if (onTextExtracted) onTextExtracted(data.text, { filename: data.filename, totalChars: data.char_count });
    } catch (e) {
      setError(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setError(null);
    setDone(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="w-full">
      {/* Drop zone */}
      {!file && (
        <div
          className="border-2 border-dashed border-gray-200 hover:border-legal-gold/50 transition-colors rounded-sm p-6 cursor-pointer text-center"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.docx,.txt"
            onChange={handleFileChange}
          />
          <svg className="w-6 h-6 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-[15px] text-gray-500">
            Drop a file or <span className="text-legal-gold font-medium">browse</span>
          </p>
          <p className="text-[15px] text-gray-400 mt-1">.pdf · .docx · .txt — max 10 MB</p>
        </div>
      )}

      {/* File selected */}
      {file && (
        <div className={`bg-white rounded-sm shadow-sm border p-6 ${ done ? "border-green-200" : "border-gray-200"}`}>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 shrink-0 text-legal-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
              <p className="text-[10px] text-gray-400">{formatFileSize(file.size)}</p>
            </div>
            {!isUploading && (
              <button onClick={handleClear} className="p-1 text-gray-300 hover:text-gray-500 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {!done && !isUploading && (
            <button
              onClick={handleUpload}
              className="mt-3 w-full py-2 bg-legal-navy text-white text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors"
            >
              Extract Text
            </button>
          )}

          {isUploading && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Extracting text…
            </div>
          )}

          {done && (
            <p className="mt-3 text-xs text-green-700 font-medium">
              ✓ Text extracted — translating…
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export default FileUpload;
