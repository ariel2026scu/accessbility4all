import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function App() {
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState("legal");

  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false); // backend / dev mock delay
  const [isTyping, setIsTyping] = useState(false);   // typing animation

  const [copied, setCopied] = useState(false);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const [apiError, setApiError] = useState(null);

  // typing animation refs
  const typingTimerRef = useRef(null);
  const debounceRef = useRef(null);
  const targetRef = useRef("");

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

  // Dev-mode mock translation (no backend required)
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

  // Only animate the "new" part if user is just appending
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

    // don’t translate empty
    if (inputText.trim().length === 0) {
      stopTyping();
      setOutputText("");
      return;
    }

    setIsLoading(true);

    if (DEV_MODE) {
      // Dev mode: mock translation (animated)
      setTimeout(() => {
        const result = fakeTranslate(inputText, mode);
        startTyping(result);
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

  function handleReadAloud() {
    if (!outputText) return;

    if (audioData) {
      const binary = atob(audioData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(outputText);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  // DEV_MODE: auto-translate while typing (debounced) like your “second” version
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, mode]);

  useEffect(() => {
    return () => {
      stopTyping();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const translateDisabled =
    isLoading || isTyping || inputText.trim().length === 0;

  return (
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
              >
                {isLoading || isTyping ? "Translating..." : "Translate"}
              </button>

              <button
                className="btn btnDanger"
                type="button"
                onClick={handleClear}
              >
                Clear
              </button>
            </div>

            {apiError && (
              <div className="apiError" role="alert">
                ⚠️ {apiError}
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
              {outputText.trim().length === 0 ? (
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
                disabled={outputText.trim().length === 0}
              >
                Read Aloud
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
          </section>
        </div>

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