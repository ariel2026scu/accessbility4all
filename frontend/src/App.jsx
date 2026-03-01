import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import FileUpload from "./FileUpload";
import logoImg from "./assets/scu-logo.png";
import goddessImg from "./assets/legal.png";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const UPLOAD_CHAR_LIMIT = 5000;

function truncateAtBoundary(text, limit) {
  if (text.length <= limit) return { text, truncated: false };
  const slice = text.slice(0, limit);
  const lastPara = slice.lastIndexOf("\n\n");
  if (lastPara > limit * 0.7) return { text: slice.slice(0, lastPara).trim(), truncated: true };
  const lastSentence = slice.lastIndexOf(". ");
  if (lastSentence > limit * 0.7) return { text: slice.slice(0, lastSentence + 1).trim(), truncated: true };
  return { text: slice.trim() + "…", truncated: true };
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

  const typingTimerRef = useRef(null);
  const debounceRef = useRef(null);
  const targetRef = useRef("");
  const audioRef = useRef(null);

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

  async function handleTranslate(overrideText) {
    setCopied(false); setApiError(null); setAudioData(null); setAudioStatus("idle");
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
      startTyping(data.text || "");
      setAudioData(data.audio ?? null);
      setRedFlags(data.red_flags ?? []);
    } catch (error) {
      setApiError(error.message); stopTyping(); setOutputText("");
    } finally { setIsLoading(false); }
  }

  function handleClear() {
    setInputText(""); stopTyping(); setOutputText(""); setCopied(false); setAudioData(null); setApiError(null); setAudioStatus("idle"); setRedFlags([]); setUploadInfo(null);
    if (audioRef.current) audioRef.current.pause();
    window.speechSynthesis.cancel();
    targetRef.current = "";
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

  const translateDisabled = isLoading || isTyping || inputText.trim().length === 0;

  return (
    <div className={`min-h-screen flex flex-col md:flex-row bg-legal-offwhite font-sans text-legal-charcoal relative overflow-hidden ${isReadingMode ? "reading-mode" : ""}`}>
      {/* Background Goddess Image */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{ 
          backgroundImage: `url(${goddessImg})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />

      {/* Sidebar/Header */}
      <aside className="w-full md:w-80 bg-legal-navy text-white p-8 flex flex-col shrink-0 z-10">
        <div className="mb-auto">
          <div className="mb-8 flex items-center gap-4">
            <div className="bg-white p-1 rounded-sm">
              <img src={logoImg} alt="SCU Logo" className="w-12 h-12 object-contain" />
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
                <option value="legal">Legalese → Plain English</option>
                <option value="oldEnglish">Old English → Modern English</option>
              </select>
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

        <div className="pt-8 mt-auto border-t border-blue-900/50">
          <button 
            onClick={() => setIsReadingMode(!isReadingMode)}
            className={`w-full p-3 rounded-sm border text-xs font-bold tracking-widest uppercase transition-all ${isReadingMode ? 'bg-legal-gold text-legal-navy border-legal-gold' : 'border-blue-800 text-blue-300 hover:border-legal-gold hover:text-legal-gold'}`}
          >
            {isReadingMode ? "Focus Mode: ON" : "Focus Mode: OFF"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 lg:p-16 max-w-6xl mx-auto w-full overflow-y-auto">
        <div className="space-y-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Input Section */}
            <section className="space-y-6">
              <div className="flex items-end justify-between border-b border-gray-200 pb-4">
                <h2 className="text-2xl font-serif text-legal-navy">Original Clause</h2>
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Section A-1</span>
              </div>
              
              <div className="paper-card p-0 overflow-hidden">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste legal text here for simplification..."
                  className="w-full min-h-[300px] p-8 text-lg leading-relaxed focus:outline-none resize-none placeholder:text-gray-300"
                />
                <div className="bg-gray-50 p-4 border-t border-gray-100 flex gap-3">
                  <button onClick={() => handleTranslate()} disabled={translateDisabled} className="px-6 py-2 bg-legal-navy text-white text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50">
                    {isLoading || isTyping ? "Analyzing..." : "Simplify"}
                  </button>
                  <button onClick={handleClear} className="px-6 py-2 border border-gray-200 text-gray-400 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors">
                    Clear
                  </button>
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

              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-3">Upload Document</p>
                <FileUpload
                  apiUrl={API_URL}
                  devMode={DEV_MODE}
                  onTextExtracted={handleFileTextExtracted}
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
                <h2 className="text-2xl font-serif text-legal-navy">Plain Interpretation</h2>
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Revision 1.0</span>
              </div>

              <div className="paper-card p-8 min-h-[300px] relative">
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

                <div className="absolute bottom-6 right-8 flex gap-4">
                  <button onClick={handleReadAloud} disabled={!outputText} className="text-legal-gold hover:text-legal-navy transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                  </button>
                  <button onClick={handleCopy} disabled={!outputText} className="text-legal-gold hover:text-legal-navy transition-colors">
                    {copied ? "✓" : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>}
                  </button>
                </div>
              </div>

            </section>
          </div>

          {/* Red Flags Section */}
          {redFlags.length > 0 && (
            <section className="space-y-8 pt-12">
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
    </div>
  );
}

export default App;
