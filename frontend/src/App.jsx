import { useMemo, useState } from "react";
import "./App.css";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function App() {
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState("legal");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [audioData, setAudioData] = useState(null);
  const [apiError, setApiError] = useState(null);

  const legalExample =
    "Pursuant to the provisions herein, the undersigned hereby agrees to indemnify and hold harmless the Company from any and all claims arising therefrom.";
  const oldEnglishExample =
    "Thou art wise, and I beseech thee to lend me thine counsel, for I know not what I should do.";

  // super simple "hard words" detector (demo-only)
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

  async function handleTranslate() {
    setCopied(false);
    setApiError(null);
    setAudioData(null);
    setIsLoading(true);

    if (DEV_MODE) {
      // Dev mode: use mock translation without calling the backend
      setTimeout(() => {
        const result = fakeTranslate(inputText, mode);
        setOutputText(result);
        setIsLoading(false);
      }, 450);
      return;
    }

    // Production: call the real backend API
    try {
      const response = await fetch(`${API_URL}/llm_output`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `Server error (${response.status})`);
      }

      const data = await response.json();
      setOutputText(data.text);
      setAudioData(data.audio ?? null);
    } catch (error) {
      setApiError(error.message);
      setOutputText("");
    } finally {
      setIsLoading(false);
    }
  }

  function handleClear() {
    setInputText("");
    setOutputText("");
    setCopied(false);
    setAudioData(null);
    setApiError(null);
  }

  function handleExample(which) {
    if (which === "legal") {
      setMode("legal");
      setInputText(legalExample);
      setOutputText("");
    } else {
      setMode("oldEnglish");
      setInputText(oldEnglishExample);
      setOutputText("");
    }
    setCopied(false);
    setAudioData(null);
    setApiError(null);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      // clipboard unavailable — silently ignore
    }
  }

  function handleReadAloud() {
    if (!outputText) return;

    // Use backend-generated WAV audio when available
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

    // Fallback: browser speech synthesis (dev mode or no backend audio)
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(outputText);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  const translateDisabled = isLoading || inputText.trim().length === 0;

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
              onClick={() => setIsReadingMode(!isReadingMode)}
            >
              {isReadingMode ? "Disable Reading Mode" : "Enable Reading Mode"}
            </button>
          </div>
          <h1 className="title">PlainSpeak</h1>
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
                {isLoading ? "Translating..." : "Translate"}
              </button>

              <button
                className="btn btnDanger"
                type="button"
                onClick={handleClear}
                disabled={isLoading && inputText.trim().length === 0}
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
              <div className="panelHint">Your clear version appears here</div>
            </div>

            <div className="outputBox" aria-live="polite">
              {outputText.trim().length === 0 ? (
                <div className="outputPlaceholder">
                  No output yet. Paste text and press Translate.
                </div>
              ) : (
                <div className="outputText">{outputText}</div>
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
            {DEV_MODE
              ? "Dev Mode: using mock translation. Set VITE_DEV_MODE=false to call the real backend."
              : `Connected to backend at ${API_URL}`}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
