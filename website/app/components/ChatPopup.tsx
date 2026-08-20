"use client";

import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Calendar, Paperclip } from "lucide-react";
import ScheduleViewer from "./ScheduleViewer";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { currentTerm, getSessionUUID, baseURL } from "../constants";

export default function ChatPopup({
    setSearchQuery,
    maxWidth,
    maxHeight,
}: {
    setSearchQuery: (query: string) => void;
    maxWidth?: number;
    maxHeight?: number;
}) {
    const chatURL = baseURL + "/chat";
    const sessionUUIDPromise = getSessionUUID();
    const errorMessage = "Something went wrong! Try again later!";
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<
        { id: number; text: string; sender: "user" | "bot" }[]
    >([
        {
            id: 1,
            text: "Hello! How can I help you?",
            sender: "bot",
        },
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [width, setWidth] = useState(350);
    const [height, setHeight] = useState(485);
    const [isResizing, setIsResizing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const currentScheduleIndex = useRef(0);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files).filter(
                (f) => f.type === "application/pdf"
            );
            setSelectedFiles((prev) => [...prev, ...files]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const compressFile = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const stream = new Response(arrayBuffer).body!.pipeThrough(
            new CompressionStream("gzip")
        );
        const compressedResponse = new Response(stream);
        const compressedBuffer = await compressedResponse.arrayBuffer();

        // Convert to base64
        let binary = "";
        const bytes = new Uint8Array(compressedBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, isOpen]);

    // Ensure chat doesn't exceed graph dimensions if they shrink
    useEffect(() => {
        if (maxWidth && width > maxWidth) {
            setWidth(Math.max(350, maxWidth));
        }
        if (maxHeight && height > maxHeight) {
            setHeight(Math.max(485, maxHeight));
        }
    }, [maxWidth, maxHeight]);

    // Resize logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            // Since it's bottom-right anchored:
            // New Width = Current width + (initialX - mouseX)
            // But we can simplify: we know the right edge is screenWidth - 24px (right-6)
            // Wait, the popup is 'absolute bottom-20 right-0' relative to the 'fixed bottom-6 right-6' wrapper.
            // So the right edge is fixed at WindowWidth - 24px.
            // Width = RightEdge - MouseX
            // Height = BottomEdge - MouseY

            const newWidth = Math.max(
                350,
                Math.min(
                    maxWidth || Infinity,
                    window.innerWidth - 24 - e.clientX
                )
            );
            const newHeight = Math.max(
                485,
                Math.min(
                    maxHeight || Infinity,
                    window.innerHeight - 24 - 80 - e.clientY
                )
            );

            setWidth(newWidth);
            setHeight(newHeight);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing]);

    const handleDeleteSchedule = (index: number) => {
        const newSchedules = [...schedules];
        newSchedules.splice(index, 1);
        setSchedules(newSchedules);
    };

    const handleSendMessage = async () => {
        if (inputValue.trim() || selectedFiles.length > 0) {
            const newMessage = {
                id: Date.now(),
                text:
                    inputValue +
                    (selectedFiles.length > 0
                        ? `\n\n[Attached: ${selectedFiles
                              .map((f) => f.name)
                              .join(", ")}]`
                        : ""),
                sender: "user" as const,
            };
            setMessages([...messages, newMessage]);
            setIsLoading(true);

            // Reset current request index for overwriting logic
            currentScheduleIndex.current = 0;

            const attachments =
                selectedFiles.length > 0
                    ? await Promise.all(
                          selectedFiles.map((f) => compressFile(f))
                      )
                    : undefined;

            sessionUUIDPromise.then((sessionUUID) => {
                fetch(chatURL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        sessionID: sessionUUID,
                        term: currentTerm,
                        query: inputValue,
                        attachments: attachments,
                    }),
                })
                    .then(async (response) => {
                        if (!response.ok || !response.body) {
                            if (response.status === 429) {
                                throw new Error(
                                    "Slow down there—allow yourself a moment to think."
                                );
                            }
                            throw new Error(errorMessage);
                        }

                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();

                        // Add initial empty bot message
                        const botMsgId = Date.now();
                        let currentText = "";

                        setMessages((prev) => [
                            ...prev,
                            {
                                id: botMsgId,
                                text: "",
                                sender: "bot",
                            },
                        ]);

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value, {
                                stream: true,
                            });
                            const lines = chunk.split("\n");

                            for (const line of lines) {
                                if (!line.trim()) continue;
                                try {
                                    const data = JSON.parse(line);
                                    if (data.type === "text") {
                                        currentText += data.content;
                                    } else if (data.type === "schedule") {
                                        const s = data.content;
                                        const idx =
                                            currentScheduleIndex.current;

                                        // Update global schedules state with overwrite logic
                                        setSchedules((prev) => {
                                            const newScheds = [...prev];
                                            if (idx < newScheds.length) {
                                                newScheds[idx] = s;
                                            } else {
                                                newScheds.push(s);
                                            }
                                            return newScheds;
                                        });

                                        currentScheduleIndex.current += 1;
                                    }

                                    setMessages((prev) => {
                                        const newMsgs = [...prev];
                                        const lastMsg =
                                            newMsgs[newMsgs.length - 1];
                                        if (lastMsg.id === botMsgId) {
                                            lastMsg.text = currentText;
                                        }
                                        return newMsgs;
                                    });
                                } catch (e) {
                                    console.error("JSON Parse error", e);
                                }
                            }
                        }
                        setIsLoading(false);
                    })
                    .catch((error: unknown) => {
                        setMessages((prevMessages) => [
                            ...prevMessages,
                            {
                                id: Date.now(),
                                text:
                                    error instanceof Error
                                        ? error.message
                                        : errorMessage,
                                sender: "bot",
                            },
                        ]);
                        setIsLoading(false);
                    });
            });

            setInputValue("");
            setSelectedFiles([]);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
            {/* Schedule Viewer */}
            <ScheduleViewer
                schedules={schedules}
                isOpen={isViewerOpen}
                onClose={() => setIsViewerOpen(false)}
                onDelete={handleDeleteSchedule}
                setSearchQuery={setSearchQuery}
            />

            {/* Chat Window */}
            <div
                style={{
                    width: isOpen ? width : 0,
                    height: isOpen ? height : 0,
                }}
                className={`absolute bottom-16 right-0 max-w-[calc(100vw-2rem)] overflow-hidden border border-black/15 bg-white shadow-[8px_8px_0_rgba(23,23,23,0.18)] flex flex-col ease-out origin-bottom-right ${
                    isOpen
                        ? "opacity-100 scale-100 pointer-events-auto"
                        : "opacity-0 scale-95 pointer-events-none"
                } ${
                    isResizing
                        ? ""
                        : "transition-[width,height,opacity,scale] duration-300"
                }`}
            >
                {/* Resize Handle - Top Left */}
                <div
                    onMouseDown={() => setIsResizing(true)}
                    className="group absolute left-0 top-0 z-[60] h-4 w-4 cursor-nwse-resize transition-colors hover:bg-[#cc0000]/10"
                >
                    <div className="absolute left-1 top-1 h-2 w-2 border-l-2 border-t-2 border-black/25 transition-colors group-hover:border-[#cc0000]" />
                </div>

                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b-4 border-[#cc0000] bg-[#171717] px-4 py-3">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-5 h-5 text-white" />
                        <h3 className="font-black uppercase tracking-wide text-white">Highlander AI</h3>
                    </div>
                    <button
                        aria-label="Close course assistant"
                        onClick={() => setIsOpen(false)}
                        className="cursor-pointer p-1 text-white transition-colors hover:bg-white/15"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Messages Container */}
                <div className="relative flex flex-1 flex-col gap-3 overflow-y-auto bg-[#f4f2ee] p-4">
                    <style>{`
                        @keyframes typing {
                            0%, 60%, 100% { opacity: 0.5; }
                            30% { opacity: 1; }
                        }
                        .typing-dot {
                            animation: typing 1.4s infinite;
                        }
                        .typing-dot:nth-child(2) {
                            animation-delay: 0.2s;
                        }
                        .typing-dot:nth-child(3) {
                            animation-delay: 0.4s;
                        }
                        .markdown-content p {
                            margin-bottom: 0.5rem;
                        }
                        .markdown-content p:last-child {
                            margin-bottom: 0;
                        }
                        .markdown-content ul, .markdown-content ol {
                            margin-bottom: 0.5rem;
                            padding-left: 1.25rem;
                        }
                        .markdown-content li {
                            margin-bottom: 0.25rem;
                        }
                        .markdown-content a {
                            color: #4f46e5;
                            text-decoration: underline;
                        }
                        .dark .markdown-content a {
                            color: #818cf8;
                        }
                        .markdown-content code {
                            background-color: #f1f5f9;
                            padding: 0.125rem 0.25rem;
                            border-radius: 0.25rem;
                            font-size: 0.8rem;
                        }
                        .dark .markdown-content code {
                            background-color: #334155;
                        }
                    `}</style>
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${
                                message.sender === "user"
                                    ? "justify-end"
                                    : "justify-start"
                            }`}
                        >
                            <div
                                className={`max-w-[70%] px-4 py-2 rounded-lg ${
                                    message.sender === "user"
                                        ? "bg-[#cc0000] text-white rounded-br-none"
                                        : "border border-black/10 bg-white text-[#171717] rounded-bl-none"
                                }`}
                            >
                                {message.sender === "user" ? (
                                    <p className="text-sm whitespace-pre-wrap break-words">
                                        {message.text
                                            .replace(/\\n/g, "\n")
                                            .replace(/\\t/g, "\t")}
                                    </p>
                                ) : (
                                    <div className="text-sm markdown-content break-words">
                                        <ReactMarkdown
                                            remarkPlugins={[
                                                remarkGfm,
                                                remarkBreaks,
                                            ]}
                                        >
                                            {message.text
                                                .replace(/\\n/g, "\n")
                                                .replace(/\\t/g, "\t")}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-none border border-slate-200 dark:border-slate-600 px-4 py-2 rounded-lg flex gap-1 items-center">
                                <span className="typing-dot inline-block w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                                <span className="typing-dot inline-block w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                                <span className="typing-dot inline-block w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* View Button */}
                {schedules.length > 0 && (
                    <div className="absolute bottom-[52px] left-0 w-full px-4 py-2 bg-gradient-to-t from-white to-transparent dark:from-slate-900 z-10 flex justify-center">
                        <button
                            onClick={() => setIsViewerOpen(true)}
                            className="flex items-center gap-1 bg-[#171717] px-3 py-1 text-xs font-bold text-white shadow-md transition hover:bg-[#cc0000]"
                        >
                            <Calendar className="w-3 h-3" />
                            View Schedules ({schedules.length})
                        </button>
                    </div>
                )}

                {/* Attachment Preview */}
                {selectedFiles.length > 0 && (
                    <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 shrink-0">
                        {selectedFiles.map((file, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-1 bg-white dark:bg-slate-700 px-2 py-1 rounded text-[10px] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                            >
                                <span className="truncate max-w-[100px]">
                                    {file.name}
                                </span>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="text-slate-400 hover:text-red-500 cursor-pointer"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900 flex gap-2 shrink-0 items-center">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf"
                        multiple
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer p-2 text-black/40 transition-colors hover:text-[#cc0000]"
                        title="Attach PDF"
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask something..."
                        className="flex-1 border border-black/20 bg-white px-3 py-2 text-sm text-[#171717] outline-none placeholder:text-black/35 focus:border-[#cc0000] focus:ring-1 focus:ring-[#cc0000]"
                    />
                    <button
                        aria-label="Send message"
                        onClick={handleSendMessage}
                        className="cursor-pointer bg-[#cc0000] p-2 text-white transition-colors hover:bg-[#990000]"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Toggle Button */}
            <button
                aria-label={isOpen ? "Close course assistant" : "Open course assistant"}
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-14 w-14 items-center justify-center bg-[#cc0000] text-white shadow-[5px_5px_0_rgba(23,23,23,0.2)] transition-all duration-300 hover:-translate-y-1 hover:bg-[#990000] active:translate-y-0"
            >
                {isOpen ? (
                    <X className="w-6 h-6" />
                ) : (
                    <MessageCircle className="w-6 h-6" />
                )}
            </button>
        </div>
    );
}
