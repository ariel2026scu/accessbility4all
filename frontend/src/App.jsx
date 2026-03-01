import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import jsPDF from "jspdf";
import "./App.css";
import FileUpload from "./FileUpload";
import logoImg from "./assets/scu-logo.png";
import goddessImg from "./assets/legal.png";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const VITE_GOOGLE_TRANSLATE_KEY = import.meta.env.VITE_GOOGLE_TRANSLATE_KEY;
const GOOGLE_API_URL = import.meta.env.GOOGLE_API_URL || "https://translation.googleapis.com/language/translate/v2";
const UPLOAD_CHAR_LIMIT = 5000;
const MAX_WORDS = 1000;

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "pt", label: "Português" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "it", label: "Italiano" },
  { code: "ru", label: "Русский" },
];

function truncateAtBoundary(text, limit) {
  if (text.length <= limit) return { text, truncated: false };
  const slice = text.slice(0, limit);
  const lastPara = slice.lastIndexOf("\n\n");
  if (lastPara > limit * 0.7) return { text: slice.slice(0, lastPara).trim(), truncated: true };
  const lastSentence = slice.lastIndexOf(". ");
  if (lastSentence > limit * 0.7) return { text: slice.slice(0, lastSentence + 1).trim(), truncated: true };
  return { text: slice.trim() + "…", truncated: true };
}

async function googleTranslate(text, targetLang) {
  if (!text || !text.trim()) return text;
  if (!VITE_GOOGLE_TRANSLATE_KEY) {
    console.warn("VITE_GOOGLE_TRANSLATE_KEY not set — skipping translation");
    return text;
  }
  try {
    const res = await fetch(`${GOOGLE_API_URL}?key=${VITE_GOOGLE_TRANSLATE_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, target: targetLang, format: "text" }),
    });
    if (!res.ok) throw new Error(`Google Translate error ${res.status}`);
    const data = await res.json();
    return data?.data?.translations?.[0]?.translatedText ?? text;
  } catch (e) {
    console.error("Translation failed:", e);
    return text;
  }
}

function App() {
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState("legal");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [audioStatus, setAudioStatus] = useState("idle");
  const [redFlags, setRedFlags] = useState([]);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [wordLimitHit, setWordLimitHit] = useState(false);
  const [isAutoTranslating, setIsAutoTranslating] = useState(false);

  const [uiLang, setUiLang] = useState("en");
  const [isTranslatingLang, setIsTranslatingLang] = useState(false);

  const inputDebounceRef = useRef(null);
  const typingTimerRef = useRef(null);
  const debounceRef = useRef(null);
  const targetRef = useRef("");
  const audioRef = useRef(null);
  const alertsRef = useRef(null);

  const legalExample = "Pursuant to the provisions herein, the undersigned hereby agrees to indemnify and hold harmless the Company from any and all claims arising therefrom.";
  const oldEnglishExample = "Thou art wise, and I beseech thee to lend me thine counsel, for I know not what I should do.";

  const hardWordList = useMemo(() => {
    const hardWords = ["hereinafter", "pursuant", "indemnify", "hold harmless", "thereof", "therein", "notwithstanding", "whereas", "heretofore", "beseech", "thou", "thee", "thine"];
    const found = [];
    const lower = inputText.toLowerCase();
    for (let word of hardWords) {
      if (lower.includes(word) && !found.includes(word)) found.push(word);
    }
    return found;
  }, [inputText]);

  const textStats = useMemo(() => {
    const trimmed = inputText.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;

    return { words };
  }, [inputText]);

  const tooManyWords = wordLimitHit || textStats.words > MAX_WORDS;

  function fakeTranslate(text, currentMode) {
    let result = text;
    if (currentMode === "legal") {
      result = result.replace(/hereinafter/gi, "from now on").replace(/pursuant to/gi, "under").replace(/undersigned/gi, "the person signing").replace(/indemnify/gi, "protect").replace(/hold harmless/gi, "not blame").replace(/notwithstanding/gi, "even if").replace(/whereas/gi, "because").replace(/thereof/gi, "of it").replace(/therein/gi, "in it");
    } else if (currentMode === "oldEnglish") {
      result = result.replace(/thou art/gi, "you are").replace(/\bthou\b/gi, "you").replace(/\bthee\b/gi, "you").replace(/\bthine\b/gi, "your").replace(/\bbeseech\b/gi, "ask").replace(/\bcounsel\b/gi, "advice");
    }
    return result;
  }

  function stopTyping() {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setIsTyping(false);
  }

  function startTyping(fullText) {
    if (fullText === targetRef.current) return;
    targetRef.current = fullText;
    setCopied(false);
    if (!fullText) { stopTyping(); setOutputText(""); return; }

    setOutputText((currentShown) => {
      const isAppendOnly = fullText.length >= currentShown.length && fullText.startsWith(currentShown);
      if (!isAppendOnly) { stopTyping(); return fullText; }
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      setIsTyping(true);
      let i = currentShown.length;
      typingTimerRef.current = setInterval(() => {
        i++;
        setOutputText(fullText.slice(0, i));
        if (i >= fullText.length) { clearInterval(typingTimerRef.current); setIsTyping(false); }
      }, 12);
      return currentShown;
    });
  }

  function handleDownloadPDF() {
    const doc = new jsPDF({ unit: "pt", format: "letter" });

    const margin = 60;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxLineWidth = pageWidth - margin * 2;
    let y = margin;

    // ── Header ──
    doc.setFont("times", "bold");
    doc.setFontSize(20);
    doc.setTextColor(10, 30, 70);
    doc.text("SimplyLegal — Plain Interpretation", margin, y);
    y += 28;

    // Thin gold divider line
    doc.setDrawColor(180, 140, 60);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 20;

    // Date
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    if (uiLang !== "en") {
      doc.text(`Language: ${currentLangLabel}`, pageWidth - margin, y, { align: "right" });
    }
    y += 24;

    // ── Simplified text ──
    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);

    const lines = doc.splitTextToSize(outputText, maxLineWidth);
    for (const line of lines) {
      if (y + 18 > pageHeight - margin) { doc.addPage(); y = margin; }
      doc.text(line, margin, y);
      y += 18;
    }

    // ── Red Flags ──
    if (redFlags.length > 0) {
      y += 20;
      if (y + 40 > pageHeight - margin) { doc.addPage(); y = margin; }

      doc.setDrawColor(180, 140, 60);
      doc.line(margin, y, pageWidth - margin, y);
      y += 20;

      doc.setFont("times", "bold");
      doc.setFontSize(15);
      doc.setTextColor(10, 30, 70);
      doc.text(`Due Diligence Alerts (${redFlags.length})`, margin, y);
      y += 24;

      redFlags.forEach((flag, i) => {
        if (y + 80 > pageHeight - margin) { doc.addPage(); y = margin; }

        const severityColor = flag.severity === "high" ? [180, 30, 30] : flag.severity === "medium" ? [180, 100, 20] : [60, 120, 60];

        doc.setFont("times", "italic");
        doc.setFontSize(10);
        doc.setTextColor(90, 90, 90);
        const quoteLines = doc.splitTextToSize(`"${flag.quote}"`, maxLineWidth - 16);
        for (const line of quoteLines) {
          if (y + 14 > pageHeight - margin) { doc.addPage(); y = margin; }
          doc.text(line, margin + 16, y);
          y += 14;
        }
        y += 4;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        const riskLines = doc.splitTextToSize(flag.risk, maxLineWidth);
        for (const line of riskLines) {
          if (y + 14 > pageHeight - margin) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += 14;
        }
        y += 4;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(140, 50, 50);
        const wcLines = doc.splitTextToSize(`Exposure: ${flag.worst_case}`, maxLineWidth);
        for (const line of wcLines) {
          if (y + 13 > pageHeight - margin) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += 13;
        }
        y += 16;
      });
    }

    // ── Footer on every page ──
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text("SimplyLegal — SCU Digital Counsel", margin, pageHeight - 30);
      doc.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 30, { align: "right" });
    }

    doc.save("SimplyLegal-Analysis.pdf");
  }

  async function handleTranslate(overrideText) {
    setCopied(false); setApiError(null); setAudioData(null); setAudioStatus("idle");
    targetRef.current = "";
    setOutputText("");
    const text = (overrideText !== undefined ? overrideText : inputText).trim();
    if (text.length === 0) { stopTyping(); setOutputText(""); return; }
    setIsLoading(true);

    if (DEV_MODE) {
      setTimeout(() => {
        const result = fakeTranslate(text, mode);
        startTyping(result);
        setRedFlags([
          { quote: "The Company may modify these terms at any time without prior notice.", risk: "The company can rewrite your contract unilaterally at any time.", severity: "high", worst_case: "Fees double overnight without notice." },
          { quote: "All disputes shall be resolved through binding arbitration.", risk: "You give up the right to sue in court.", severity: "high", worst_case: "You lose the right to a jury trial." }
        ]);
        setIsLoading(false);
      }, 450);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/llm_output`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, mode }),
      });
      if (!response.ok) throw new Error(`Server error (${response.status})`);
      const data = await response.json();
      let translatedText = data.text || "";
      let translatedFlags = data.red_flags ?? [];

      if (uiLang !== "en") {
        setIsTranslatingLang(true);
        try {
          translatedText = await googleTranslate(translatedText, uiLang);
          translatedFlags = await Promise.all(translatedFlags.map(async (f) => ({
            ...f,
            quote: await googleTranslate(f.quote, uiLang),
            risk: await googleTranslate(f.risk, uiLang),
            worst_case: await googleTranslate(f.worst_case, uiLang),
          })));
        } finally {
          setIsTranslatingLang(false);
        }
      }

      startTyping(translatedText);
      setAudioData(data.audio ?? null);
      setRedFlags(translatedFlags);
    } catch (error) {
      setApiError(error.message); stopTyping(); setOutputText("");
    } finally { setIsLoading(false); }
  }

  const handleLanguageChange = useCallback(async (newLang) => {
    if (newLang === uiLang) return;
    setUiLang(newLang);

    const hasInput = inputText.trim().length > 0;
    const hasOutput = outputText.trim().length > 0;
    if (!hasInput && !hasOutput) return;

    setIsTranslatingLang(true);
    try {
      const [translatedInput, translatedOutput] = await Promise.all([
        hasInput ? googleTranslate(inputText, newLang) : Promise.resolve(inputText),
        hasOutput ? googleTranslate(outputText, newLang) : Promise.resolve(outputText),
      ]);

      if (hasInput) setInputText(translatedInput);

      if (hasOutput) {
        stopTyping();
        targetRef.current = translatedOutput;
        setOutputText(translatedOutput);
      }

      if (redFlags.length > 0) {
        const translatedFlags = await Promise.all(redFlags.map(async (f) => ({
          ...f,
          quote: await googleTranslate(f.quote, newLang),
          risk: await googleTranslate(f.risk, newLang),
          worst_case: await googleTranslate(f.worst_case, newLang),
        })));
        setRedFlags(translatedFlags);
      }
    } finally {
      setIsTranslatingLang(false);
    }
  }, [uiLang, inputText, outputText, redFlags]);

  function handleClear() {
    setInputText(""); stopTyping(); setOutputText(""); setCopied(false); setAudioData(null); setApiError(null); setAudioStatus("idle"); setRedFlags([]); setUploadInfo(null);
    if (audioRef.current) audioRef.current.pause();
    window.speechSynthesis.cancel();
    targetRef.current = "";
  }

  function handleScrollToAlerts() {
    if (alertsRef.current) {
      alertsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleFileTextExtracted(rawText, meta) {
    const { text, truncated } = truncateAtBoundary(rawText, UPLOAD_CHAR_LIMIT);
    setInputText(text);
    setUploadInfo(truncated ? { filename: meta.filename, shownChars: text.length, totalChars: meta.totalChars } : null);
    stopTyping(); setOutputText(""); setCopied(false); setAudioData(null); setApiError(null); setAudioStatus("idle"); setRedFlags([]);
    targetRef.current = "";
    handleTranslate(text);
  }

  function handleExample(which) {
    if (which === "legal") { setMode("legal"); setInputText(legalExample); }
    else { setMode("oldEnglish"); setInputText(oldEnglishExample); }
    stopTyping(); setOutputText(""); setCopied(false); setAudioData(null); setApiError(null); setAudioStatus("idle"); setRedFlags([]);
    targetRef.current = "";
  }

  async function handleCopy() {
    try { await navigator.clipboard.writeText(outputText); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch (e) {}
  }

  async function handleReadAloud() {
    if (!outputText) return;
    if (audioRef.current) audioRef.current.pause();
    window.speechSynthesis.cancel();
    setAudioStatus("playing");

    if (audioData) {
      try {
        const binary = atob(audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); setAudioStatus("idle"); };
        await audio.play();
        return;
      } catch (e) { setAudioStatus("error"); }
    }

    try {
      const utterance = new SpeechSynthesisUtterance(outputText);
      utterance.onend = () => setAudioStatus("idle");
      window.speechSynthesis.speak(utterance);
    } catch (e) { setAudioStatus("error"); }
  }

  useEffect(() => {
    if (!DEV_MODE) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inputText.trim().length === 0) { stopTyping(); setOutputText(""); return; }
    debounceRef.current = setTimeout(() => startTyping(fakeTranslate(inputText, mode)), 250);
    return () => clearTimeout(debounceRef.current);
  }, [inputText, mode]);

  useEffect(() => {
    if (!inputText.trim()) return;

    if (inputDebounceRef.current) clearTimeout(inputDebounceRef.current);

    const detectTimer = setTimeout(() => {
      setIsAutoTranslating(true);
    }, 300);

    inputDebounceRef.current = setTimeout(async () => {
      try {
        const translated = await googleTranslate(inputText, uiLang);
        if (translated !== inputText) {
          setInputText(translated);
        }
      } finally {
        setIsAutoTranslating(false);
      }
    }, 2500);

    return () => {
      clearTimeout(detectTimer);
      clearTimeout(inputDebounceRef.current);
      setIsAutoTranslating(false);
    };
  }, [inputText, uiLang]);

  const translateDisabled = isLoading || isTyping || inputText.trim().length === 0;
  const currentLangLabel = LANGUAGES.find(l => l.code === uiLang)?.label ?? "English";

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-legal-offwhite font-sans text-legal-charcoal relative overflow-hidden ${isReadingMode ? "reading-mode" : ""}`}>
      {/* Background Watermark Goddess Image (Seamless Right Side) */}
      <div 
        className="fixed bottom-0 right-0 md:left-80 left-0 h-screen pointer-events-none opacity-[0.04] z-0 select-none overflow-hidden"
        style={{ 
          backgroundImage: `url(${goddessImg})`,
          backgroundSize: 'contain',
          backgroundPosition: 'bottom right',
          backgroundRepeat: 'no-repeat',
          filter: 'grayscale(100%)',
          WebkitMaskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)',
          maskImage: 'radial-gradient(circle at bottom right, black 20%, transparent 80%)'
        }}
      />

      {/* Sidebar/Header */}
      <aside className="fixed left-0 top-0 h-screen w-64 sm:w-80 bg-legal-navy text-white p-8 flex flex-col z-30 shadow-2xl">
        <div className="relative z-10 flex flex-col h-full">
          <div className="mb-auto">
            <div className="mb-8 flex items-center gap-4">
              <div className="bg-white rounded-full overflow-hidden border-2 border-legal-gold/50 shadow-inner p-0">
                <img src={logoImg} alt="SCU Logo" className="w-14 h-14 object-cover" />
              </div>
              <div>
                <h1 className="text-2xl font-serif text-legal-gold tracking-tight leading-tight">SimplyLegal</h1>
                <p className="text-[10px] text-blue-200/40 uppercase tracking-[0.2em] font-bold">SCU Digital Counsel</p>
              </div>
            </div>
            
            <nav className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-blue-300/50 font-bold block">Translation Mode</label>
                <select 
                  value={mode} 
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-blue-900/30 border border-blue-800 rounded-sm p-3 text-sm focus:outline-none focus:border-legal-gold transition-colors"
                >
                  <option value="legal">Legalese → Plain Language</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-blue-300/50 font-bold block flex items-center gap-2">
                  Output Language
                  {isTranslatingLang && (
                    <span className="inline-block w-3 h-3 border-2 border-legal-gold border-t-transparent rounded-full animate-spin" />
                  )}
                </label>
                <div className="relative">
                  <select
                    value={uiLang}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    disabled={isTranslatingLang}
                    className="w-full bg-blue-900/30 border border-blue-800 rounded-sm p-3 text-sm focus:outline-none focus:border-legal-gold transition-colors appearance-none pr-8 disabled:opacity-50"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                  {/* Chevron icon */}
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {uiLang !== "en" && (
                  <p className="text-[10px] text-blue-300/40 leading-relaxed">
                    Both text boxes will display in {currentLangLabel}.
                  </p>
                )}
              </div>

              <div className="space-y-4 pt-6">
                <button onClick={() => handleExample("legal")} className="w-full text-left text-sm hover:text-legal-gold transition-colors flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-legal-gold"></span>
                  Legal Example
                </button>
                <button onClick={() => handleExample("old")} className="w-full text-left text-sm hover:text-legal-gold transition-colors flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  Old English Example
                </button>
              </div>
            </nav>
          </div>

          <div className="pt-8 mt-auto border-t border-blue-900/50 relative z-10">
            <button 
              onClick={() => setIsReadingMode(!isReadingMode)}
              className={`w-full p-3 rounded-sm border text-xs font-bold tracking-widest uppercase transition-all ${isReadingMode ? 'bg-legal-gold text-legal-navy border-legal-gold' : 'border-blue-800 text-blue-300 hover:border-legal-gold hover:text-legal-gold'}`}
            >
              {isReadingMode ? "Focus Mode: ON" : "Focus Mode: OFF"}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <img
                src={goddessImg}
                alt=""
                aria-hidden="true"
                className="pointer-events-none select-none"
                style={{
                  position: "absolute",
                  right: "120px",
                  bottom: "0px",
                  height: "420px",
                  width: "auto",
                  opacity: 0.5,
                  zIndex: 0,
                  objectFit: "contain",
                  filter: "grayscale(10%) contrast(1.3) brightness(0.95)",
                }}
              />
      <main className="flex-1 ml-64 sm:ml-80 p-6 md:p-12 lg:p-16 max-w-6xl mx-auto w-full overflow-y-auto">
        {DEV_MODE && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-widest rounded-sm">
            ⚙️ Dev Mode — mock translation active
          </div>
        )}

        <div className="space-y-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Input Section */}
            <section className="space-y-6">
              <div className="flex items-end justify-between border-b border-gray-200 pb-4">
                <h2 className="text-2xl font-serif text-legal-navy">Original Clause</h2>
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Section A-1</span>
              </div>
              
              <div className="paper-card p-0 overflow-hidden">
                {isAutoTranslating && (
                  <div className="px-8 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3 text-xs text-blue-700 font-medium">
                    <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    Auto detecting and translating language…
                  </div>
                )}
                <textarea
                  value={inputText}
                  onChange={(e) => {
                    const value = e.target.value;
                    const trimmed = value.trim();
                    const words = trimmed ? trimmed.split(/\s+/).length : 0;

                    if (words <= MAX_WORDS) {
                      setInputText(value);
                      setWordLimitHit(false);
                    } else {
                      setWordLimitHit(true);
                    }
                  }}
                  placeholder="Paste legal text here for simplification..."
                  className="w-full min-h-[300px] p-8 text-lg leading-relaxed focus:outline-none resize-none placeholder:text-gray-300"
                />
                {tooManyWords && (
                  <div className="px-8 pt-2 text-sm text-red-600">
                    Please keep the input under {MAX_WORDS.toLocaleString()} words.
                  </div>
                )}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center gap-3">
                  <button
                    onClick={() => handleTranslate()}
                    disabled={translateDisabled || tooManyWords}
                    className="flex items-center gap-2 px-6 py-2 bg-legal-navy text-white text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/>
                    </svg>
                    Simplify
                  </button>

                  <button
                    onClick={handleClear}
                    className="flex items-center gap-2 px-6 py-2 border border-gray-400 text-gray-500 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M6 7h12M9 7V4h6v3m-8 0v13h10V7"/>
                    </svg>
                    Clear
                  </button>

                  {/* Word & Character Counter */}
                  <div
                    className={`ml-auto text-sm tracking-wide ${
                      tooManyWords ? "text-red-600" : "text-gray-500"
                    }`}
                  >
                    {textStats.words.toLocaleString()} words
                  </div>
                </div>
              </div>

              {uploadInfo && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border border-amber-100 text-xs text-amber-900">
                  <svg className="w-4 h-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="flex-1">
                    <strong>{uploadInfo.filename}</strong>
                    {" · "}Showing first {uploadInfo.shownChars.toLocaleString()} of {uploadInfo.totalChars.toLocaleString()} characters
                  </span>
                  <button onClick={() => setUploadInfo(null)} className="text-amber-400 hover:text-amber-700 transition-colors">✕</button>
                </div>
              )}

              <div className="pt-4">
                <p className="text-sm uppercase tracking-widest font-bold text-gray-400 mb-4">Upload Document</p>
                <FileUpload
                  onUploadSuccess={(file) => console.log('Uploaded:', file.name)}
                  onTextExtracted={handleFileTextExtracted}
                  apiUrl={API_URL}
                  devMode={DEV_MODE}
                />
              </div>


              {hardWordList.length > 0 && (
                <div className="pt-4">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-3">Complex Terminology</h4>
                  <div className="flex flex-wrap gap-2">
                    {hardWordList.map(w => <span key={w} className="px-3 py-1 bg-white border border-gray-200 text-[11px] text-legal-navy font-medium italic">{w}</span>)}
                  </div>
                </div>
              )}
            </section>

            {/* Output Section */}
            <section className="space-y-6">
              <div className="flex items-end justify-between border-b border-gray-200 pb-4">
                <h2 className="text-2xl font-serif text-legal-navy">Plain Translation</h2>
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Revision 1.0</span>
              </div>

              <div className="paper-card p-0 overflow-hidden">
                {/* Scrollable text area */}
                <div className="p-8 min-h-[300px] max-h-[60vh] overflow-y-auto">
                  {isLoading ? (
                    <div className="space-y-4">
                      <div className="h-4 bg-gray-100 animate-pulse w-full"></div>
                      <div className="h-4 bg-gray-100 animate-pulse w-5/6"></div>
                      <div className="h-4 bg-gray-100 animate-pulse w-full"></div>
                      <div className="h-4 bg-gray-100 animate-pulse w-2/3"></div>
                    </div>
                  ) : outputText ? (
                    <div className="text-lg leading-[1.8] text-legal-charcoal whitespace-pre-wrap">
                      {outputText}
                      {isTyping && <span className="inline-block w-1.5 h-5 bg-legal-gold ml-1 animate-pulse"></span>}
                    </div>
                  ) : (
                    <p className="text-gray-300 italic text-lg">Analysis will appear here...</p>
                  )}
                </div>

                {/* Footer bar (like Simplify/Clear) */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 flex items-center gap-3">
                  <button
                    onClick={handleReadAloud}
                    disabled={!outputText}
                    className="flex items-center gap-2 px-6 py-2 border border-legal-gold text-legal-gold text-xs font-bold uppercase tracking-widest hover:bg-legal-gold hover:text-legal-navy transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
                    </svg>
                    Read
                  </button>

                  <button
                    onClick={handleCopy}
                    disabled={!outputText}
                    className="flex items-center gap-2 px-6 py-2 border border-gray-400 text-gray-500 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5h8v4H8z"/>
                    </svg>
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleDownloadPDF}
                    disabled={!outputText || isTranslatingLang}
                    className="flex items-center gap-2 px-6 py-2 border border-gray-400 text-gray-500 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    {/* PDF / download icon */}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M12 3v10m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                      />
                    </svg>
                    Export PDF
                  </button>
                </div>
              </div>

              {/* Down arrow hint: jump to Due Diligence Alerts */}
              {outputText && redFlags.length > 0 && (
                <div className="flex justify-center pt-10">
                  <button
                    onClick={handleScrollToAlerts}
                    className="bg-gray-200 text-gray-700 w-14 h-14 rounded-full shadow-md flex items-center justify-center hover:bg-gray-300 hover:scale-105 transition-all duration-200"
                    title="Jump to Due Diligence Alerts"
                    aria-label="Jump to Due Diligence Alerts"
                  >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Red Flags Section */}
          {redFlags.length > 0 && (
            <section ref={alertsRef} id="due-diligence-alerts" className="space-y-8 pt-12">
              <div className="flex items-center gap-4">
                <h3 className="text-2xl font-serif text-legal-navy underline decoration-legal-gold underline-offset-8 decoration-2">Due Diligence Alerts</h3>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-tighter rounded-full">{redFlags.length} FOUND</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {redFlags.map((flag, i) => (
                  <div key={i} className="paper-card border-l-4 border-l-red-500 p-8 space-y-4">
                    <blockquote className="text-sm font-medium text-gray-500 italic border-l-2 border-gray-100 pl-4">"{flag.quote}"</blockquote>
                    <p className="text-base font-semibold text-legal-charcoal">{flag.risk}</p>
                    <div className="pt-4 mt-4 border-t border-gray-50 flex items-start gap-3">
                      <span className="text-[10px] bg-red-50 text-red-800 px-2 py-1 font-bold uppercase shrink-0">Exposure</span>
                      <p className="text-xs text-red-900/70 leading-relaxed">{flag.worst_case}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
        
        <footer className="mt-24 pt-8 border-t border-gray-200 flex justify-between items-center text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">
          <span>Official Digital Transcript</span>
          <span>© {new Date().getFullYear()} SimplyLegal LLP</span>
        </footer>
      </main>
        {isReadingMode && (
          <button
            onClick={() => setIsReadingMode(false)}
            className="fixed bottom-6 left-8 bg-gray-200 text-gray-700 w-14 h-14 rounded-full shadow-md flex items-center justify-center hover:bg-gray-300 hover:scale-105 transition-all duration-200 z-50"
            title="Exit Focus Mode"
          >
            <span className="text-2xl font-semibold">→</span>
          </button>
        )}
    </div>
  );
}

export default App;
