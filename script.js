const CARTESIA_API_KEY = 'YOUR_CARTESIA_API_KEY'; // User to replace
const TRANSLATION_API_KEY = 'YOUR_TRANSLATION_API_KEY'; // User to replace

document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceSelect = document.getElementById('voice-select');

    let audioContext;
    let ws;

    // Focus input on load
    messageInput.focus();

    // Event Listeners
    sendBtn.addEventListener('click', handleSend);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    async function handleSend() {
        const text = messageInput.value.trim();
        if (!text) return;

        // Clear input
        messageInput.value = '';

        // Add User Message
        addMessage(text, 'sender');

        await processTranslation(text);
    }

    async function processTranslation(text) {
        // 1. Translate (Mock for now, replacing with real API call structure)
        const translatedText = await translateText(text, 'fr'); // Target French by default

        // 2. Display Translated Message
        addMessage(translatedText, 'receiver');

        // 3. Speak (TTS)
        await speakText(translatedText, voiceSelect.value);
    }

    // --- Core Logic ---

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
        const timeP = document.createElement('p');
        const now = new Date();
        timeP.textContent = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
        timeDiv.appendChild(timeP);

        if (isSender) {
            const tickImg = document.createElement('img');
            tickImg.src = "img/icons8-double-tick-96.png";
            timeDiv.appendChild(tickImg);
        }

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

    async function translateText(text, targetLang) {
        // Placeholder for Translation API
        // In a real app, call OpenAI or Google Translate here
        console.log(`Translating "${text}" to ${targetLang}...`);

        // Mock translation logic (simple append)
        // If we had a key, we'd fetch('https://api.openai.com/v1/...')
        return `(FR) ${text}`;
    }

    async function speakText(text, voiceId) {
        console.log(`Speaking: "${text}" with voice ${voiceId}`);

        // Initialize AudioContext if needed
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
        }

        if (!CARTESIA_API_KEY || CARTESIA_API_KEY.includes('YOUR_')) {
            console.warn("Cartesia API Key missing. Simulating audio.");
            return;
        }

        // Connect to Cartesia WebSocket
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            ws = new WebSocket(`wss://api.cartesia.ai/tts/websocket?api_key=${CARTESIA_API_KEY}&cartesia_version=2023-12-15`);

            ws.onopen = () => {
                console.log("Connected to Cartesia");
                sendTTSRequest(ws, text, voiceId);
            };

            ws.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                if (data.audio) {
                    playAudioChunk(data.audio);
                }
                if (data.done) {
                    console.log("TTS Generation Done");
                    // ws.close(); // Keep open for session?
                }
            };

            ws.onerror = (error) => console.error("WebSocket Error:", error);
        } else {
            sendTTSRequest(ws, text, voiceId);
        }
    }

    function sendTTSRequest(socket, text, voiceId) {
        // Cartesia voice IDs need to be real UUIDs. The basic constants needs to be mapped.
        // For this demo, we'll assume the select value IS the ID, but we need real IDs.
        // Sonic: 79a125e8-cd45-4c13-8a67-188112f4dd22 (Example ID)

        const message = {
            model_id: "sonic-english", // Or a specific model ID
            transcript: text,
            voice: {
                mode: "id",
                id: voiceId === 'sonic-english' ? '79a125e8-cd45-4c13-8a67-188112f4dd22' : 'a0e99878-f023-447a-9768-5f98829c4f57' // Example mapping
            },
            output_format: {
                container: "raw",
                encoding: "pcm_f32le",
                sample_rate: 44100
            }
        };
        socket.send(JSON.stringify(message));
    }

    function playAudioChunk(base64Audio) {
        if (!audioContext) return;

        // Decode base64
        const binaryString = window.atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Float32Array(len / 4);
        const view = new DataView(new ArrayBuffer(len));

        // Use DataView to parse little-endian floats if needed, 
        // but for now simpler approch (might need adjustment based on exact Cartesia format):
        // Actually, Cartesia returns raw PCM float32.

        // Simplified buffer creation for demo purposes (real implementation needs robust PCM handling)
        // This part often requires a specific audio processor or worklet for streaming.

        console.log("Received audio chunk of size:", len);
    }
});
