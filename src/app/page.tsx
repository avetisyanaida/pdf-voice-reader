"use client";

import {ChangeEvent, useEffect, useMemo, useRef, useState} from "react";
import {User} from "@supabase/supabase-js";
import "./globals.css";
import {supabase} from "../../lib/supabaseClient";
import {AuthCard} from "../../components/AuthCard";
import {initializePaddle, Paddle} from "@paddle/paddle-js";

type ReaderStatus =
    | "idle"
    | "loading"
    | "ready"
    | "playing"
    | "paused"
    | "error";

type LanguageOption = {
    label: string;
    code: string;
};

type DocumentRow = {
    id: string;
    user_id: string;
    file_name: string;
    content: string;
    language: string;
    voice_uri: string;
    rate: number;
    current_position: number;
};

type ProfileRow = {
    user_id: string;
    email: string | null;
    plan: "free" | "paid";
    subscription_status: string;
};

const LANGUAGES: LanguageOption[] = [
    {label: "English", code: "en-US"},
    {label: "Russian", code: "ru-RU"},
];

const CHUNK_SIZE = 900;

export default function Home() {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<ProfileRow | null>(null);
    const [documentCount, setDocumentCount] = useState(0);
    const [status, setStatus] = useState<ReaderStatus>("idle");
    const [fileName, setFileName] = useState("");
    const [text, setText] = useState("");
    const [error, setError] = useState("");
    const [language, setLanguage] = useState("ru-RU");
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
    const [rate, setRate] = useState(1);
    const [currentPosition, setCurrentPosition] = useState(0);
    const [activeEndPosition, setActiveEndPosition] = useState(0);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const [cloudSaving, setCloudSaving] = useState(false);
    const [cloudMessage, setCloudMessage] = useState("");
    const [upgradePopupOpen, setUpgradePopupOpen] = useState(false);
    const [paddle, setPaddle] = useState<Paddle | null>(null);
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    const textRef = useRef("");
    const cursorRef = useRef(0);
    const chunkStartRef = useRef(0);
    const stoppedRef = useRef(false);
    const pausedRef = useRef(false);
    const runIdRef = useRef(0);
    const rateRef = useRef(1);
    const activeTextRef = useRef<HTMLSpanElement | null>(null);
    const readerTextRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

        if (!token) {
            console.warn("Missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
            return;
        }

        initializePaddle({
            token,
            environment: "sandbox",
        }).then((paddleInstance) => {
            if (paddleInstance) {
                setPaddle(paddleInstance);
            }
        });
    }, []);

    useEffect(() => {
        if (!user) return;

        void loadProfile(user);
        void loadDocumentCount(user);
        void loadLastDocumentFromAccount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    useEffect(() => {
        supabase.auth.getUser().then(({data}) => {
            setUser(data.user);
        });

        const {data: listener} = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
            }
        );

        return () => {
            listener.subscription.unsubscribe();
        };
    }, []);


    useEffect(() => {
        textRef.current = text;
    }, [text]);

    useEffect(() => {
        rateRef.current = rate;
    }, [rate]);

    useEffect(() => {
        if (status !== "playing") return;

        const container = readerTextRef.current;
        const active = activeTextRef.current;

        if (!container || !active) return;

        const containerRect = container.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();

        const activeIsVisible =
            activeRect.top >= containerRect.top + 80 &&
            activeRect.bottom <= containerRect.bottom - 80;

        if (activeIsVisible) return;

        const nextScrollTop =
            container.scrollTop +
            activeRect.top -
            containerRect.top -
            container.clientHeight / 2 +
            active.clientHeight / 2;

        container.scrollTo({
            top: Math.max(0, nextScrollTop),
            behavior: "smooth",
        });
    }, [currentPosition, activeEndPosition, status]);

    useEffect(() => {
        if (!user || !selectedDocumentId || !text.trim()) return;

        const timer = window.setTimeout(() => {
           void updateCurrentDocument();
        }, 1500);

        return () => {
            window.clearTimeout(timer);
        };
    }, [
        user,
        selectedDocumentId,
        text,
        fileName,
        language,
        selectedVoiceURI,
        rate,
        currentPosition,
    ]);

    useEffect(() => {
        const loadVoices = () => {
            const availableVoices = window.speechSynthesis.getVoices();
            setVoices(availableVoices);

            const langPrefix = language.slice(0, 2).toLowerCase();

            const langVoice = availableVoices.find((voice) =>
                voice.lang.toLowerCase().startsWith(langPrefix)
            );

            if (langVoice) {
                setSelectedVoiceURI(langVoice.voiceURI);
            }
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        return () => {
            window.speechSynthesis.onvoiceschanged = null;
        };
    }, [language]);

    const filteredVoices = useMemo(() => {
        const langPrefix = language.slice(0, 2).toLowerCase();

        const matched = voices.filter((voice) =>
            voice.lang.toLowerCase().startsWith(langPrefix)
        );

        return matched.length > 0 ? matched : voices;
    }, [voices, language]);

    const selectedVoice = useMemo(() => {
        return (
            voices.find((voice) => voice.voiceURI === selectedVoiceURI) ||
            null
        );
    }, [voices, selectedVoiceURI]);

    async function loadProfile(currentUser: User) {
        const {data, error} = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", currentUser.id)
            .maybeSingle();

        if (error) {
            console.error(error);
            setCloudMessage("Could not load account plan.");
            return;
        }

        if (!data) {
            const {data: createdProfile, error: createError} = await supabase
                .from("profiles")
                .insert({
                    user_id: currentUser.id,
                    email: currentUser.email,
                    plan: "free",
                    subscription_status: "none",
                })
                .select("*")
                .single();

            if (createError) {
                console.error(createError);
                setCloudMessage("Could not create account plan.");
                return;
            }

            setProfile(createdProfile as ProfileRow);
            return;
        }

        setProfile(data as ProfileRow);
    }

    async function loadDocumentCount(currentUser: User) {
        const {count, error} = await supabase
            .from("documents")
            .select("id", {count: "exact", head: true})
            .eq("user_id", currentUser.id);

        if (error) {
            console.error(error);
            return;
        }

        setDocumentCount(count ?? 0);
    }


    async function loadLastDocumentFromAccount() {
        if (!user) return;

        const {data, error} = await supabase
            .from("documents")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", {ascending: false})
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error("Supabase update error full:", JSON.stringify(error, null, 2));
            console.error("Supabase update error raw:", error);

            setCloudMessage(
                error.message || "Could not save document changes."
            );

            return;
        }

        if (!data) return;

        const doc = data as DocumentRow;

        runIdRef.current += 1;
        stoppedRef.current = true;
        pausedRef.current = false;

        if (typeof window !== "undefined") {
            window.speechSynthesis.cancel();
        }

        setSelectedDocumentId(doc.id);
        setFileName(doc.file_name);
        setText(doc.content);
        textRef.current = doc.content;

        setLanguage(doc.language || "ru-RU");
        setSelectedVoiceURI(doc.voice_uri || "");
        setRate(Number(doc.rate) || 1);
        rateRef.current = Number(doc.rate) || 1;

        const safePosition = Math.min(
            Number(doc.current_position) || 0,
            doc.content.length
        );

        cursorRef.current = safePosition;
        setCurrentPosition(safePosition);
        setActiveEndPosition(
            Math.min(doc.content.length, safePosition + CHUNK_SIZE)
        );

        setStatus("ready");
        setCloudMessage("Loaded from account.");
    }

    function isPaidUser() {
        return (
            profile?.plan === "paid" &&
            profile?.subscription_status === "active"
        );
    }

    function canUploadNewPdf() {
        if (!user) {
            setCloudMessage("Login required to save PDF.");
            return false;
        }

        if (!isPaidUser() && documentCount >= 1) {
            setCloudMessage("Free plan allows only 1 saved PDF. Upgrade to save more.");
            setUpgradePopupOpen(true);
            return false;
        }

        return true;
    }

    async function openPaddleCheckout() {
        if (!user) {
            setCloudMessage("Login required before upgrading.");
            return;
        }

        const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID;

        if (!priceId) {
            setCloudMessage("Missing Paddle price ID.");
            return;
        }

        if (!paddle) {
            setCloudMessage("Payment checkout is still loading. Try again.");
            return;
        }

        setCheckoutLoading(true);

        try {
            paddle.Checkout.open({
                items: [
                    {
                        priceId,
                        quantity: 1,
                    },
                ],
                customer: {
                    email: user.email || "",
                },
                customData: {
                    user_id: user.id,
                    email: user.email || "",
                },
                settings: {
                    theme: "dark",
                    displayMode: "overlay",
                },
            });
        } catch (err) {
            console.error("Paddle checkout open error:", err);
            setCloudMessage("Could not open payment checkout.");
        } finally {
            setCheckoutLoading(false);
        }
    }

    async function saveNewDocumentToAccount(fileNameValue: string, contentValue: string) {
        if (!user) {
            setCloudMessage("Login required to save PDF.");
            return;
        }

        setCloudSaving(true);
        setCloudMessage("");

        const {data, error} = await supabase
            .from("documents")
            .insert({
                user_id: user.id,
                file_name: fileNameValue || "Untitled PDF",
                content: contentValue,
                language,
                voice_uri: selectedVoiceURI,
                rate,
                current_position: 0,
            })
            .select()
            .single();

        setCloudSaving(false);

        if (error) {
            setCloudMessage(error.message);
            return;
        }

        const savedDoc = data as DocumentRow;

        setSelectedDocumentId(savedDoc.id);
        setDocumentCount((current) => current + 1);
        setCloudMessage("Saved to account.");
    }

    async function updateCurrentDocument() {
        if (!user || !selectedDocumentId || !text.trim()) return;

        setCloudSaving(true);

        const {error} = await supabase
            .from("documents")
            .update({
                file_name: fileName || "Untitled PDF",
                content: text,
                language,
                voice_uri: selectedVoiceURI,
                rate,
                current_position: currentPosition,
            })
            .eq("id", selectedDocumentId);

        setCloudSaving(false);

        if (error) {
            console.error("Supabase update error:", error);
            setCloudMessage(error.message);
            return;
        }

        setCloudMessage("Saved.");
    }

    function cleanPdfText(input: string) {
        return input
            // line-break hyphenation: коли - чество -> количество
            .replace(/([A-Za-zА-Яа-яЁё])\s*-\s+([A-Za-zА-Яа-яЁё])/g, "$1$2")

            // extra spaces before punctuation
            .replace(/\s+([,.!?;:])/g, "$1")

            // normalize many spaces
            .replace(/[ \t]+/g, " ")

            // normalize too many new lines
            .replace(/\n{3,}/g, "\n\n")

            .trim();
    }

    async function handlePdfUpload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];

        if (!file) return;

        event.target.value = "";

        const isPdf =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        if (!isPdf) {
            setStatus("error");
            setError("Please upload a PDF file.");
            return;
        }

        if (!canUploadNewPdf()) {
            return;
        }

        stopReading();
        setSelectedDocumentId(null);

        setFileName(file.name);
        setText("");
        setError("");
        setStatus("loading");
        setCurrentPosition(0);
        setActiveEndPosition(0);
        cursorRef.current = 0;

        try {
            const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

            pdfjsLib.GlobalWorkerOptions.workerSrc =
                `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;

            const arrayBuffer = await file.arrayBuffer();

            const pdf = await pdfjsLib.getDocument({
                data: arrayBuffer,
            }).promise;

            let extractedText = "";

            for (
                let pageNumber = 1;
                pageNumber <= pdf.numPages;
                pageNumber++
            ) {
                const page = await pdf.getPage(pageNumber);
                const content = await page.getTextContent();

                const pageText = content.items
                    .map((item: unknown) => {
                        if (
                            typeof item === "object" &&
                            item !== null &&
                            "str" in item
                        ) {
                            return String(item.str);
                        }

                        return "";
                    })
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim();

                extractedText += `\n\n--- Page ${pageNumber} ---\n\n${pageText}`;
            }

            const cleanText = cleanPdfText(extractedText);

            if (!cleanText) {
                setStatus("error");
                setError(
                    "No selectable text found in this PDF. It may be a scanned image PDF."
                );
                return;
            }

            setText(cleanText);
            textRef.current = cleanText;
            setStatus("ready");
            await saveNewDocumentToAccount(file.name, cleanText);
        } catch (err) {
            console.error("PDF read error:", err);

            const message =
                err instanceof Error
                    ? err.message
                    : "Unknown PDF processing error";

            setStatus("error");
            setError(`Could not read this PDF on this device. ${message}`);
        }
    }

    function getNextChunk(start: number) {
        const fullText = textRef.current;

        if (start >= fullText.length) {
            return {
                chunk: "",
                start,
                nextStart: fullText.length,
            };
        }

        let end = Math.min(start + CHUNK_SIZE, fullText.length);

        const slice = fullText.slice(start, end);

        const sentenceMarks = [".", "!", "?", "։", "\n"];
        let lastSentenceEnd = -1;

        for (const mark of sentenceMarks) {
            lastSentenceEnd = Math.max(lastSentenceEnd, slice.lastIndexOf(mark));
        }

        if (end < fullText.length) {
            if (lastSentenceEnd > CHUNK_SIZE * 0.55) {
                end = start + lastSentenceEnd + 1;
            } else {
                const lastSpace = slice.lastIndexOf(" ");

                if (lastSpace > CHUNK_SIZE * 0.55) {
                    end = start + lastSpace + 1;
                }
            }
        }

        const rawChunk = fullText.slice(start, end);
        const leadingSpaces = rawChunk.length - rawChunk.trimStart().length;
        const cleanStart = start + leadingSpaces;
        const chunk = rawChunk.trim();

        return {
            chunk,
            start: cleanStart,
            nextStart: end,
        };
    }

    function speakFrom(position: number) {
        const fullText = textRef.current;

        if (!fullText.trim()) return;

        if (position >= fullText.length) {
            setStatus("ready");
            cursorRef.current = 0;
            setCurrentPosition(0);
            setActiveEndPosition(0);
            return;
        }

        const currentRunId = runIdRef.current;
        const result = getNextChunk(position);

        if (!result.chunk) {
            setStatus("ready");
            cursorRef.current = 0;
            setCurrentPosition(0);
            setActiveEndPosition(0);
            return;
        }

        chunkStartRef.current = result.start;
        cursorRef.current = result.start;

        setCurrentPosition(result.start);
        setActiveEndPosition(result.nextStart);

        const utterance = new SpeechSynthesisUtterance(result.chunk);

        utterance.lang = language;
        utterance.rate = rateRef.current;
        utterance.pitch = 1;
        utterance.volume = 1;

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
            if (currentRunId !== runIdRef.current) return;

            setError("");
            setStatus("playing");
        };

        utterance.onboundary = (event) => {
            if (currentRunId !== runIdRef.current) return;

            const absolutePosition =
                chunkStartRef.current + event.charIndex;

            cursorRef.current = absolutePosition;
            setCurrentPosition(absolutePosition);
        };

        utterance.onend = () => {
            if (currentRunId !== runIdRef.current) return;
            if (stoppedRef.current) return;
            if (pausedRef.current) return;

            cursorRef.current = result.nextStart;
            setCurrentPosition(result.nextStart);
            setActiveEndPosition(result.nextStart);

            window.setTimeout(() => {
                speakFrom(result.nextStart);
            }, 20);
        };

        utterance.onerror = (event) => {
            if (currentRunId !== runIdRef.current) return;

            if (
                event.error === "interrupted" ||
                event.error === "canceled"
            ) {
                return;
            }

            console.log("Speech error:", event.error);

            setStatus("error");
            setError(
                `Speech playback failed: ${event.error}. Try another voice or lower speed.`
            );
        };

        window.speechSynthesis.speak(utterance);
    }

    function startReading() {
        if (!text.trim()) return;

        runIdRef.current += 1;
        stoppedRef.current = true;
        pausedRef.current = false;
        window.speechSynthesis.cancel();

        window.setTimeout(() => {
            runIdRef.current += 1;
            stoppedRef.current = false;
            pausedRef.current = false;
            cursorRef.current = 0;
            setCurrentPosition(0);
            setActiveEndPosition(0);
            setError("");
            setIsEditMode(false);

            speakFrom(0);
        }, 250);
    }

    function pauseReading() {
        if (status !== "playing") return;

        pausedRef.current = true;
        stoppedRef.current = false;
        runIdRef.current += 1;

        window.speechSynthesis.cancel();

        setStatus("paused");
        setCurrentPosition(cursorRef.current);
    }

    function resumeReading() {
        if (status !== "paused") return;

        const resumePosition = cursorRef.current;

        runIdRef.current += 1;
        stoppedRef.current = false;
        pausedRef.current = false;
        setError("");
        setIsEditMode(false);

        window.speechSynthesis.cancel();

        window.setTimeout(() => {
            speakFrom(resumePosition);
        }, 150);
    }

    function changeSpeed(newRate: number) {
        rateRef.current = newRate;
        setRate(newRate);
    }

    function stopReading() {
        runIdRef.current += 1;
        stoppedRef.current = true;
        pausedRef.current = false;

        if (typeof window !== "undefined") {
            window.speechSynthesis.cancel();
        }

        setActiveEndPosition(0);

        if (textRef.current.trim()) {
            setStatus("ready");
        } else {
            setStatus("idle");
        }
    }

    function handleSignOutDone() {
        stopReading();

        setUser(null);
        setFileName("");
        setText("");
        textRef.current = "";
        setError("");
        setCurrentPosition(0);
        setActiveEndPosition(0);
        cursorRef.current = 0;
        setStatus("idle");

    }


    function toggleEditMode() {
        if (status === "playing" || status === "paused") {
            stopReading();
        }

        setIsEditMode((prev) => !prev);
    }

    function handleTextEdit(newText: string) {
        setText(newText);
        textRef.current = newText;

        cursorRef.current = 0;
        setCurrentPosition(0);
        setActiveEndPosition(0);

        if (!newText.trim()) {
            setStatus("idle");
        } else {
            setStatus("ready");
        }
    }

    const progress =
        text.length > 0
            ? Math.min(100, Math.round((currentPosition / text.length) * 100))
            : 0;

    const highlightStart = Math.max(0, currentPosition);

    const highlightEnd = Math.min(
        text.length,
        activeEndPosition > currentPosition
            ? activeEndPosition
            : currentPosition + CHUNK_SIZE
    );

    const beforeText = text.slice(0, highlightStart);
    const activeText = text.slice(highlightStart, highlightEnd);
    const afterText = text.slice(highlightEnd);

    return (
        <main className="page">
            <header className="topBar">
                <AuthCard user={user} onSignOutDoneAction={handleSignOutDone}/>
            </header>

            <section className="hero">

                <div className="heroText">
                    <p className="eyebrow">PDF Voice Reader</p>

                    <h1>
                        Upload a PDF and listen to it in English or Russian.
                    </h1>

                    <p className="subtitle">
                        The PDF is processed inside your browser. It is not
                        uploaded to a server.
                    </p>
                </div>
            </section>

            <section className="card">
                <label className="uploadBox">
                    <input
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handlePdfUpload}
                    />

                    <span className="uploadTitle">Choose PDF</span>

                    <span className="uploadText">
                        {fileName
                            ? fileName
                            : "Click here and select a PDF file"}
                    </span>
                </label>

                <div className="controlsGrid">
                    <label className="field">
                        <span>Language</span>

                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span>Voice</span>

                        <select
                            value={selectedVoiceURI}
                            onChange={(e) =>
                                setSelectedVoiceURI(e.target.value)
                            }
                        >
                            {filteredVoices.length === 0 && (
                                <option value="">No voices found</option>
                            )}

                            {filteredVoices.map((voice) => (
                                <option
                                    key={voice.voiceURI}
                                    value={voice.voiceURI}
                                >
                                    {voice.name} — {voice.lang}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span>Speed: {rate.toFixed(1)}x</span>

                        <input
                            type="range"
                            min="0.6"
                            max="1.8"
                            step="0.1"
                            value={rate}
                            onChange={(e) =>
                                changeSpeed(Number(e.target.value))
                            }
                        />
                    </label>
                </div>

                <div className="buttons">
                    <button
                        disabled={!text || status === "loading"}
                        onClick={startReading}
                    >
                        Play
                    </button>

                    <button
                        disabled={!text || status === "loading"}
                        onClick={() => {
                            runIdRef.current += 1;
                            stoppedRef.current = false;
                            pausedRef.current = false;
                            setError("");
                            setIsEditMode(false);

                            window.speechSynthesis.cancel();

                            window.setTimeout(() => {
                                const positionToContinue =
                                    cursorRef.current > 0 ? cursorRef.current : currentPosition;

                                speakFrom(positionToContinue);
                            }, 150);
                        }}
                    >
                        Continue
                    </button>

                    <button
                        disabled={status !== "playing"}
                        onClick={pauseReading}
                    >
                        Pause
                    </button>

                    <button
                        disabled={status !== "paused"}
                        onClick={resumeReading}
                    >
                        Resume
                    </button>

                    <button
                        disabled={status === "idle" || status === "loading"}
                        onClick={stopReading}
                    >
                        Stop
                    </button>
                </div>

                <div className="statusLine">
                    <span>Status: {status}</span>
                    <span>Progress: {progress}%</span>
                    <span>
                        Plan:{" "}
                        {profile?.plan === "paid" && profile?.subscription_status === "active"
                            ? "Paid"
                            : "Free"}
                    </span>
                    <span>
              Position: {currentPosition.toLocaleString()} /{" "}
                        {text.length.toLocaleString()}
            </span>
                    {cloudSaving && <span>Saving...</span>}
                    {cloudMessage && <span>{cloudMessage}</span>}
                </div>

                {error && <div className="error">{error}</div>}
            </section>

            <section className="previewCard">
                <div className="previewHeader">
                    <div>
                        <h2>Extracted text</h2>
                        <span>
                            {text
                                ? `${text.length.toLocaleString()} characters`
                                : "No PDF loaded"}
                        </span>
                    </div>

                    <button
                        className="secondaryButton"
                        disabled={!text || status === "loading"}
                        onClick={toggleEditMode}
                    >
                        {isEditMode ? "Reader Mode" : "Edit Text"}
                    </button>
                </div>

                {isEditMode ? (
                    <textarea
                        className="editTextArea"
                        value={text}
                        onChange={(e) => handleTextEdit(e.target.value)}
                        placeholder="Edit extracted PDF text here..."
                    />
                ) : (
                    <div ref={readerTextRef} className="readerText">
                        {!text && (
                            <span className="placeholderText">
                                PDF text will appear here...
                            </span>
                        )}

                        {text && (
                            <>
                                <span className="readText">{beforeText}</span>
                                <span ref={activeTextRef} className="activeText">
                                    {activeText}
                                </span>
                                <span>{afterText}</span>
                            </>
                        )}
                    </div>
                )}
            </section>

            <footer className="siteFooter">
                <a href="/pricing">Pricing</a>
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
                <a href="/refund">Refund</a>
                <a href="/contact">Contact</a>
            </footer>

            {upgradePopupOpen && (
                <div className="modalOverlay" onClick={() => setUpgradePopupOpen(false)}>
                    <div className="upgradeModal" onClick={(e) => e.stopPropagation()}>
                        <div className="modalBadge">Free limit reached</div>

                        <h3>Upgrade to Pro</h3>

                        <p>
                            Free plan allows only 1 saved PDF. Upgrade to Pro to save more
                            PDFs and keep your reading history.
                        </p>

                        <div className="planCompare">
                            <div>
                                <strong>Free</strong>
                                <span>1 saved PDF</span>
                                <span>Basic reader</span>
                            </div>

                            <div className="proPlan">
                                <strong>Pro</strong>
                                <span>Unlimited PDFs</span>
                                <span>Cloud history</span>
                                <span>Continue reading</span>
                            </div>
                        </div>

                        <div className="modalActions">
                            <button
                                className="secondaryButton"
                                onClick={() => setUpgradePopupOpen(false)}
                            >
                                Not now
                            </button>

                            <button
                                disabled={checkoutLoading}
                                onClick={() => {
                                    void openPaddleCheckout();
                                }}
                            >
                                {checkoutLoading ? "Opening..." : "Upgrade to Pro"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}