import { useMemo, useState } from "react";
import "./App.css";

function App() {
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState("legal");
  const [outputText, setOutputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReadingMode, setIsReadingMode] = useState(false);

  const legalExample =
    "Pursuant to the provisions herein, the undersigned hereby agrees to indemnify and hold harmless the Company from any and all claims arising therefrom.";
  const oldEnglishExample =
    "Thou art wise, and I beseech thee to lend me thine counsel, for I know not what I should do.";

  // super simple “hard words” detector (demo-only)
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

  function handleTranslate() {
    setCopied(false);
    setIsLoading(true);

    // mimic “real API call” delay for a nicer demo
    setTimeout(() => {
      const result = fakeTranslate(inputText, mode);
      setOutputText(result);
      setIsLoading(false);
    }, 450);
  }

  function handleClear() {
    setInputText("");
    setOutputText("");
    setCopied(false);
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
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (e) {
      // if clipboard fails, do nothing (simple)
    }
  }

  function handleReadAloud() {
    if (!outputText) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(outputText);
    utterance.rate = 0.9; // slightly slower for clarity
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
  }

  const translateDisabled = isLoading || inputText.trim().length === 0;

  return (
    <div className={`page ${isReadingMode ? "reading-mode" : ""}`}>
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
            Tip: This demo uses placeholder translation rules for now. Later you
            can replace it with a real API call.
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;