import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

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
  // "idle" | "playing" | "error"
  const [audioStatus, setAudioStatus] = useState("idle");
  // [{ text: string, risk_level: "high"|"low" }]
  const [redFlags, setRedFlags] = useState([]);

  // typing animation refs
  const typingTimerRef = useRef(null);
  const debounceRef = useRef(null);
  const targetRef = useRef("");

  // keep a stable reference to the playing Audio so it isn't GC'd mid-playback
  const audioRef = useRef(null);

  const legalExample =
    "Pursuant to the provisions herein, the undersigned hereby agrees to indemnify and hold harmless the Company from any and all claims arising therefrom.";
  const oldEnglishExample =
    "Thou art wise, and I beseech thee to lend me thine counsel, for I know not what I should do.";

  // hard words detector
  const hardWordList = useMemo(() => {
    const hardWords = [
      "hereinafter",
      "pursuant",
      "indemnify",
      "hold harmless",
      "thereof",
      "therein",
      "notwithstanding",
      "whereas",
      "heretofore",
      "beseech",
      "thou",
      "thee",
      "thine",
    ];

    const found = [];
    const lower = inputText.toLowerCase();

    for (let i = 0; i < hardWords.length; i++) {
      if (lower.includes(hardWords[i]) && !found.includes(hardWords[i])) {
        found.push(hardWords[i]);
      }
    }
    return found;
  }, [inputText]);

  // Dev-mode mock translation 
  function fakeTranslate(text, currentMode) {
    let result = text;

    if (currentMode === "legal") {
      result = result
        .replace(/hereinafter/gi, "from now on")
        .replace(/pursuant to/gi, "under")
        .replace(/undersigned/gi, "the person signing")
        .replace(/indemnify/gi, "protect")
        .replace(/hold harmless/gi, "not blame")
        .replace(/notwithstanding/gi, "even if")
        .replace(/whereas/gi, "because")
        .replace(/thereof/gi, "of it")
        .replace(/therein/gi, "in it");
    } else if (currentMode === "oldEnglish") {
      result = result
        .replace(/thou art/gi, "you are")
        .replace(/\bthou\b/gi, "you")
        .replace(/\bthee\b/gi, "you")
        .replace(/\bthine\b/gi, "your")
        .replace(/\bbeseech\b/gi, "ask")
        .replace(/\bcounsel\b/gi, "advice");
    }

    return result;
  }

  function stopTyping() {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setIsTyping(false);
  }

  // Only animate the new part if user is just appending
  function startTyping(fullText) {
    if (fullText === targetRef.current) return;
    targetRef.current = fullText;

    setCopied(false);

    if (!fullText) {
      stopTyping();
      setOutputText("");
      return;
    }

    setOutputText((currentShown) => {
      const isAppendOnly =
        fullText.length >= currentShown.length && fullText.startsWith(currentShown);

      if (!isAppendOnly) {
        stopTyping();
        return fullText;
      }

      if (typingTimerRef.current) clearInterval(typingTimerRef.current);

      setIsTyping(true);
      let i = currentShown.length;

      typingTimerRef.current = setInterval(() => {
        i++;
        setOutputText(fullText.slice(0, i));

        if (i >= fullText.length) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
          setIsTyping(false);
        }
      }, 12);

      return currentShown;
    });
  }

  async function handleTranslate() {
    setCopied(false);
    setApiError(null);
    setAudioData(null);
    setAudioStatus("idle");

    // don’t translate empty text box
    if (inputText.trim().length === 0) {
      stopTyping();
      setOutputText("");
      return;
    }

    setIsLoading(true);

    if (DEV_MODE) {
      // Dev mode: mock translation + mock red flags (animated)

      setTimeout(() => {
        const result = fakeTranslate(inputText, mode);
        startTyping(result);
        setRedFlags([
          {
            quote:      "The Company may modify these terms at any time without prior notice.",
            risk:       "The company can rewrite your contract unilaterally at any time — new fees, new restrictions, reduced rights — and you have no say.",
            severity:   "high",
            worst_case: "Fees double overnight or a key feature is removed. You only find out when you're billed or blocked, and cannot exit without a penalty.",
          },
          {
            quote:      "All disputes shall be resolved through binding arbitration, waiving the right to a jury trial.",
            risk:       "You give up the right to sue in court. Arbitration is private, typically favours larger companies, and limits your appeal options.",
            severity:   "high",
            worst_case: "The company causes you significant financial harm. You cannot join a class action or go to court — you're stuck in a costly arbitration process you're likely to lose.",
          },
          {
            quote:      "Subscription automatically renews unless cancelled 30 days before the renewal date.",
            risk:       "Easy to miss the cancellation window. You will be charged for another full term even if you stopped using the service.",
            severity:   "medium",
            worst_case: "You forget to cancel, get charged for a full year at the new (higher) renewal rate, and the refund policy says all sales are final.",
          },
          {
            quote:      "The user agrees to indemnify and hold harmless the Company against any third-party claims.",
            risk:       "You could be held financially responsible for legal costs if a third party sues the company over something related to your use.",
            severity:   "low",
            worst_case: "A third party sues the company over content you uploaded. The company passes its legal bills to you.",
          },
        ]);
        setIsLoading(false);
      }, 450);
      return;
    }

    // Production: call the real backend API
    try {
      const response = await fetch(`${API_URL}/llm_output`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, mode }), // mode optional; backend may ignore
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${response.status})`);
      }

      const data = await response.json();
      startTyping(data.text || "");
      setAudioData(data.audio ?? null);
      setRedFlags(data.red_flags ?? []);
    } catch (error) {
      setApiError(error.message);
      stopTyping();
      setOutputText("");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setInputText("");
    stopTyping();
    setOutputText("");
    setCopied(false);
    setAudioData(null);
    setApiError(null);
    setAudioStatus("idle");
    setRedFlags([]);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis.cancel();
    targetRef.current = "";
  }

  function handleExample(which) {
    if (which === "legal") {
      setMode("legal");
      setInputText(legalExample);
    } else {
      setMode("oldEnglish");
      setInputText(oldEnglishExample);
    }

    stopTyping();
    setOutputText("");
    setCopied(false);
    setAudioData(null);
    setApiError(null);
    setAudioStatus("idle");
    setRedFlags([]);
    targetRef.current = "";
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      // ignore
    }
  }

  async function handleReadAloud() {
    if (!outputText) return;

    // Stop anything already playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setAudioStatus("playing");

    if (audioData) {
      try {
        const binary = atob(audioData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setAudioStatus("idle");
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setAudioStatus("error");
        };
        await audio.play();
        return;
      } catch (e) {
        console.warn("Backend audio failed, falling back to speech synthesis:", e);
        audioRef.current = null;
        // fall through to speech synthesis
      }
    }

    // Fallback: browser speech synthesis
    try {
      const utterance = new SpeechSynthesisUtterance(outputText);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.onend = () => setAudioStatus("idle");
      utterance.onerror = () => setAudioStatus("error");
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setAudioStatus("error");
    }
  }

  // DEV_MODE: auto translate while typing (debounced) 
  useEffect(() => {
    if (!DEV_MODE) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (inputText.trim().length === 0) {
      stopTyping();
      setOutputText("");
      return;
    }

    debounceRef.current = setTimeout(() => {
      const full = fakeTranslate(inputText, mode);
      startTyping(full);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputText, mode]);

  useEffect(() => {
    return () => {
      stopTyping();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const translateDisabled =
    isLoading || isTyping || inputText.trim().length === 0;

  return (
<<<<<<< Updated upstream
    <div className={`page ${isReadingMode ? "reading-mode" : ""}`}>
      {DEV_MODE && (
        <div className="devBanner">
          ⚙️ Dev Mode — mock translation active, backend not called
        </div>
      )}

      <div className="card">
        <header className="header">
          <div className="headerTop">
            <div className="badge">Courtroom Mode</div>
            <button
              className={`btn btnToggle ${isReadingMode ? "active" : ""}`}
              type="button"
              onClick={() => setIsReadingMode(!isReadingMode)}
            >
              {isReadingMode ? "Disable Reading Mode" : "Enable Reading Mode"}
            </button>
          </div>

          <h1 className="title">SimplyLegal</h1>
          <p className="subtitle">
            Translate legalese or old English into clear, readable language.
          </p>
        </header>

        <div className="controlsTop">
          <div className="selectWrap">
            <label className="label" htmlFor="mode">
              Mode
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="legal">Legalese → Plain English</option>
              <option value="oldEnglish">Old English → Modern English</option>
            </select>
          </div>

          <div className="exampleBtns">
            <button
              className="btn btnGhost"
              type="button"
              onClick={() => handleExample("legal")}
            >
              Try Legal Example
            </button>
            <button
              className="btn btnGhost"
              type="button"
              onClick={() => handleExample("old")}
            >
              Try Old English Example
            </button>
          </div>
        </div>

        <div className="grid">
          <section className="panel">
            <div className="panelHeader">
              <h2>Original Text</h2>
              <div className="panelHint">Paste text you want simplified</div>
            </div>

            <label className="srOnly" htmlFor="inputText">
              Text to translate
            </label>
            <textarea
              id="inputText"
              placeholder="Enter text..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <div className="actions">
              <button
                className="btn btnPrimary"
                type="button"
                onClick={handleTranslate}
                disabled={translateDisabled}
=======
    <div className={`min-h-screen flex flex-col md:flex-row bg-legal-offwhite font-sans text-legal-charcoal relative overflow-hidden ${isReadingMode ? "reading-mode" : ""}`}>
      {/* Sidebar/Header */}
      <aside className="relative w-full md:w-80 bg-legal-navy text-white p-8 flex flex-col shrink-0 z-10 overflow-hidden">
        {/* Background Goddess Image for Sidebar */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none opacity-10 z-0"
          style={{ 
            backgroundImage: `url(${goddessImg})`,
            backgroundSize: 'contain',
            backgroundPosition: 'bottom center',
            backgroundRepeat: 'no-repeat',
            mixBlendMode: 'soft-light'
          }}
        />

        <div className="relative z-10 flex flex-col h-full">
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
>>>>>>> Stashed changes
              >
                {isLoading || isTyping ? "Translating..." : "Explain"}
              </button>

              <button
                className="btn btnDanger"
                type="button"
                onClick={handleClear}
              >
                Clear
              </button>
            </div>
<<<<<<< Updated upstream

            {apiError && (
              <div className="apiError" role="alert">
                ⚠️ {apiError}
=======
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
                  <button onClick={handleTranslate} disabled={translateDisabled} className="px-6 py-2 bg-legal-navy text-white text-xs font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-50">
                    {isLoading || isTyping ? "Analyzing..." : "Simplify"}
                  </button>
                  <button onClick={handleClear} className="px-6 py-2 border border-gray-200 text-gray-400 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors">
                    Clear
                  </button>
                </div>
>>>>>>> Stashed changes
              </div>
            )}

            <div className="hardWords">
              <div className="hardWordsTitle">Detected difficult terms</div>
              {hardWordList.length === 0 ? (
                <div className="hardWordsEmpty">None detected yet.</div>
              ) : (
                <div className="chipRow">
                  {hardWordList.map((w) => (
                    <span className="chip" key={w}>
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <h2>Simplified Text</h2>
              <div className="panelHint">
                {isTyping ? "Translating…" : "Your clear version appears here"}
              </div>
            </div>

            <div className="outputBox" aria-live="polite">
              {isLoading ? (
                <div className="skeleton-container">
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                  <div className="skeleton-line"></div>
                </div>
              ) : outputText.trim().length === 0 ? (
                <div className="outputPlaceholder">
                  {DEV_MODE
                    ? "Start typing on the left to see the translation appear here."
                    : "No output yet. Paste text and press Translate."}
                </div>
              ) : (
                <div className="outputText">
                  {outputText}
                  {isTyping && <span className="cursor">|</span>}
                </div>
              )}
            </div>

            <div className="actions">
              <button
                className="btn btnPrimary"
                type="button"
                onClick={handleReadAloud}
                disabled={outputText.trim().length === 0 || isTyping || audioStatus === "playing"}
              >
                {audioStatus === "playing" ? "Playing…" : "Read Aloud"}
              </button>

              <button
                className="btn btnGhost"
                type="button"
                onClick={handleCopy}
                disabled={outputText.trim().length === 0}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {audioStatus === "error" && (
              <div className="audioError" role="alert">
                ⚠️ Audio playback failed. Check your browser allows audio, or try a different browser.
              </div>
            )}
          </section>
        </div>

        {redFlags.length > 0 && (
          <section className="redFlagsSection">
            <h3 className="redFlagsTitle">
              ⚠️ Red Flags Detected ({redFlags.length})
            </h3>
            <div className="redFlagsList">
              {redFlags.map((flag, i) => (
                <div key={i} className={`redFlagCard ${flag.severity}`}>
                  <div className="redFlagHeader">
                    <span className={`riskBadge ${flag.severity}`}>
                      {flag.severity.toUpperCase()}
                    </span>
                    <blockquote className="redFlagQuote">"{flag.quote}"</blockquote>
                  </div>
                  {flag.risk && (
                    <p className="redFlagRisk">
                      <strong>Hidden risk:</strong> {flag.risk}
                    </p>
                  )}
                  {flag.worst_case && (
                    <p className="redFlagWorstCase">
                      <strong>Worst case:</strong> {flag.worst_case}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="footer">
          <div className="footerNote">
            © {new Date().getFullYear()} SimplyLegal. All rights reserved.
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;