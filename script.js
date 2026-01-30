// --- CONFIGURATION ---
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC93B2GgE3HzaWl5gW_mRroobQybaZNFJs",
    authDomain: "macx-5feca.firebaseapp.com",
    databaseURL: "https://macx-5feca-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "macx-5feca",
    storageBucket: "macx-5feca.firebasestorage.app",
    messagingSenderId: "331391736018",
    appId: "1:331391736018:web:8d472445f02b26aef0750b",
    measurementId: "G-YKE3356VE6"
};

// Placeholder Keys - User to Fill
const KEYS = {
    OPENAI: 'YOUR_OPENAI_API_KEY',
    DEEPGRAM: 'YOUR_DEEPGRAM_API_KEY',
    CARTESIA: 'YOUR_CARTESIA_API_KEY',
    GOOGLE_TRANSLATE: 'YOUR_GOOGLE_API_KEY' // Optional if using free generic fetch or OpenAI
};

// --- INITIALIZATION ---
let app;
let analytics;

try {
    if (firebase) {
        app = firebase.initializeApp(FIREBASE_CONFIG);
        analytics = firebase.analytics();
        console.log("Firebase initialized");
    }
} catch (e) {
    console.error("Firebase init failed:", e);
}

document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceSelect = document.getElementById('voice-select');

    let audioContext;
    let ws;
    let mediaRecorder;
    let audioChunks = [];

    // Focus input on load
    messageInput.focus();

    // Event Listeners
    sendBtn.addEventListener('click', handleInput);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleInput();
    });

    // --- MAIN HANDLER ---
    async function handleInput() {
        // Check if there is text input
        const text = messageInput.value.trim();

        if (text) {
            // Text Mode
            messageInput.value = '';
            addMessage(text, 'sender');
            await processPipeline(text);
        } else {
            // Audio Mode (Simple Toggle for now)
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                updateMicIcon(false);
            } else {
                await startRecording();
                updateMicIcon(true);
            }
        }
    }

    function updateMicIcon(isRecording) {
        const img = sendBtn.querySelector('img');
        if (isRecording) {
            sendBtn.classList.add('recording');
            img.style.filter = "sepia(1) saturate(10000%) hue-rotate(320deg)"; // Red-ish
        } else {
            sendBtn.classList.remove('recording');
            img.style.filter = "";
        }
    }

    // --- STT (Speech to Text) ---
    async function startRecording() {
        if (!navigator.mediaDevices) {
            alert("Microphone access denied or not supported.");
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' }); // or webm
            addMessage("🎤 Processing Audio...", 'sender');

            try {
                const text = await transcribeAudio(audioBlob);
                if (text) {
                    // Update the "Processing..." message or just add new one
                    // For simplicity, we just add the recognized text
                    addMessage(text, 'sender');
                    await processPipeline(text);
                }
            } catch (err) {
                console.error("STT Failed:", err);
                addMessage("⚠️ Audio transcription failed.", 'receiver');
            }
        };

        mediaRecorder.start();
    }

    async function transcribeAudio(audioBlob) {
        // Priority: OpenAI -> Deepgram

        // 1. Try Deepgram (if key exists)
        if (KEYS.DEEPGRAM && !KEYS.DEEPGRAM.includes('YOUR_')) {
            try {
                return await transcriptionDeepgram(audioBlob);
            } catch (e) {
                console.warn("Deepgram failed, trying OpenAI...", e);
            }
        }

        // 2. Try OpenAI
        if (KEYS.OPENAI && !KEYS.OPENAI.includes('YOUR_')) {
            return await transcriptionOpenAI(audioBlob);
        }

        console.warn("No valid STT keys. Returning mock text.");
        return "Hello, this is a simulated transcription.";
    }

    async function transcriptionDeepgram(audioBlob) {
        // Implementation for Deepgram API
        const form = new FormData();
        form.append('buffer', audioBlob); // Needs buffer or raw body usually

        const response = await fetch('https://api.deepgram.com/v1/listen', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${KEYS.DEEPGRAM}`,
                'Content-Type': audioBlob.type
            },
            body: audioBlob
        });

        const data = await response.json();
        return data.results?.channels[0]?.alternatives[0]?.transcript;
    }

    async function transcriptionOpenAI(audioBlob) {
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.wav");
        formData.append("model", "whisper-1");

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${KEYS.OPENAI}`
            },
            body: formData
        });

        const data = await response.json();
        return data.text;
    }


    // --- PIPELINE: TRANSLATE -> TTS ---
    async function processPipeline(text) {
        // 1. Translate
        let translatedText;
        try {
            translatedText = await translateText(text, 'es'); // Default to Spanish/English? Or Auto?
        } catch (e) {
            console.error("Translation failed", e);
            translatedText = `(Error) ${text}`;
        }

        // 2. Display with typing effect? or just append
        addMessage(translatedText, 'receiver');

        // 3. TTS
        await speakText(translatedText, voiceSelect.value);
    }

    async function translateText(text, targetLang = 'es') {
        // Logic: OpenAI -> Google

        if (KEYS.OPENAI && !KEYS.OPENAI.includes('YOUR_')) {
            try {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${KEYS.OPENAI}`
                    },
                    body: JSON.stringify({
                        model: "gpt-3.5-turbo",
                        messages: [
                            { "role": "system", "content": `You are a translator. Translate the following text to ${targetLang}. Return ONLY the translated text.` },
                            { "role": "user", "content": text }
                        ]
                    })
                });
                const data = await response.json();
                return data.choices[0].message.content.trim();
            } catch (e) {
                console.warn("OpenAI Translation failed, trying Google...", e);
            }
        }

        // Google Fallback (using a public proxy or standard API)
        // Note: Calls to 'translate.googleapis.com' often require key or behave strictly
        if (KEYS.GOOGLE_TRANSLATE && !KEYS.GOOGLE_TRANSLATE.includes('YOUR_')) {
            const url = `https://translation.googleapis.com/language/translate/v2?key=${KEYS.GOOGLE_TRANSLATE}`;
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify({ q: text, target: targetLang })
            });
            const data = await response.json();
            return data.data.translations[0].translatedText;
        }

        return `(Simulated Translation) ${text}`;
    }

    async function speakText(text, voiceId) {
        if (!KEYS.CARTESIA || KEYS.CARTESIA.includes('YOUR_')) {
            console.log("Speaking (Simulated):", text);
            return;
        }

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
        }

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            ws = new WebSocket(`wss://api.cartesia.ai/tts/websocket?api_key=${KEYS.CARTESIA}&cartesia_version=2023-12-15`);

            ws.onopen = () => {
                sendTTSRequest(ws, text, voiceId);
            };

            ws.onmessage = handleCartesiaMessage;
        } else {
            sendTTSRequest(ws, text, voiceId);
        }
    }

    function sendTTSRequest(socket, text, voiceId) {
        // Map UI values to real Cartesia IDs
        const VOICE_MAP = {
            'sonic-english': '79a125e8-cd45-4c13-8a67-188112f4dd22',
            'barbershop-man': 'a0e99878-f023-447a-9768-5f98829c4f57'
        };
        const realId = VOICE_MAP[voiceId] || VOICE_MAP['sonic-english'];

        const message = {
            model_id: "sonic-english",
            transcript: text,
            voice: { mode: "id", id: realId },
            output_format: { container: "raw", encoding: "pcm_f32le", sample_rate: 44100 }
        };
        socket.send(JSON.stringify(message));
    }

    async function handleCartesiaMessage(event) {
        const data = JSON.parse(event.data);
        if (data.audio) {
            playAudioChunk(data.audio);
        }
    }

    function playAudioChunk(base64Audio) {
        if (!audioContext) return;

        // Convert base64 to Float32Array
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Raw PCM handling is complex without a scheduler. 
        // For this demo, we can just log success or try a simple buffer play (which will gap).
        // A real impl needs an AudioWorklet or scheduled source nodes.

        // Simple distinct buffer play for verification:
        const float32 = new Float32Array(bytes.buffer);
        const buffer = audioContext.createBuffer(1, float32.length, 44100);
        buffer.getChannelData(0).set(float32);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
    }


    // --- UI HELPER ---
    function addMessage(text, type) {
        const isSender = type === 'sender';
        const containerDiv = document.createElement('div');
        containerDiv.classList.add(isSender ? 'senderContainer' : 'receiverContainer', 'arrowm');

        const bubbleWrapper = document.createElement('div');
        bubbleWrapper.classList.add(isSender ? 'sender' : 'reciver', 'mepop');

        const replyDiv = document.createElement('div');
        replyDiv.classList.add('thereply');

        const p = document.createElement('p');
        p.textContent = text;

        const timeDiv = document.createElement('div');
        timeDiv.classList.add('time');

        const arrowHover = document.createElement('div');
        arrowHover.classList.add('arrowhover', isSender ? 'arrowG' : 'arrowW');
        const arrowImg = document.createElement('img');
        arrowImg.src = "./img/icons8-expand-arrow-96.png";
        arrowHover.appendChild(arrowImg);

        replyDiv.appendChild(p);
        replyDiv.appendChild(timeDiv);
        replyDiv.appendChild(arrowHover);
        bubbleWrapper.appendChild(replyDiv);
        containerDiv.appendChild(bubbleWrapper);
        chatContainer.appendChild(containerDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
});
