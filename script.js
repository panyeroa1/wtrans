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

// Placeholder Keys - REPLACE WITH YOUR REAL KEYS IN VERCEL ENV OR LOCALLY
// GitHub blocked the previous push because these were exposed.
const KEYS = {
    OPENAI: '',
    DEEPGRAM: '',
    CARTESIA: '',
    GOOGLE_TRANSLATE: ''
};

import { LANGUAGES } from './languages.js';

// --- INITIALIZATION ---
let app;
let db;
let currentUser = null;
let currentRoom = 'succes'; // Default

try {
    if (firebase) {
        app = firebase.initializeApp(FIREBASE_CONFIG);
        db = firebase.database();
        console.log("Firebase initialized");
    }
} catch (e) {
    console.error("Firebase init failed:", e);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- UI ELEMENTS ---
    const chatContainer = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const voiceSelect = document.getElementById('voice-select');
    const languageSelect = document.getElementById('target-language-select');

    // Modal Elements
    const loginModal = document.getElementById('login-modal');
    const joinBtn = document.getElementById('join-btn');
    const usernameInput = document.getElementById('username-input');
    const roomCodeInput = document.getElementById('room-code-input');
    const modalLanguageSelect = document.getElementById('modal-language-select');
    const modalVoiceSelect = document.getElementById('modal-voice-select');
    const usersListEl = document.getElementById('users-list');

    // --- 0. INIT CALLS ---
    populateLanguages();
    fetchCartesiaVoices();
    setupExitButton();

    // --- 1. LANGUAGE POPULATION ---
    function populateLanguages() {
        const allLangSelects = [languageSelect, modalLanguageSelect];
        if (typeof LANGUAGES !== 'undefined') {
            LANGUAGES.forEach(lang => {
                allLangSelects.forEach(sel => {
                    if (sel) {
                        const option = document.createElement('option');
                        option.value = lang.code;
                        option.textContent = lang.name;
                        sel.appendChild(option);
                    }
                });
            });
            if (LANGUAGES.length > 0) {
                if (languageSelect) languageSelect.value = LANGUAGES[0].code;
                if (modalLanguageSelect) modalLanguageSelect.value = LANGUAGES[0].code;
            }
        }
    }

    // --- 1.5 FETCH VOICES (Cartesia) ---
    async function fetchCartesiaVoices() {
        // If keys are empty (sanitized), warn user
        const apiKey = KEYS.CARTESIA;
        if (!apiKey || apiKey.length < 10) {
            console.warn("Cartesia Key missing. Please add to KEYS object.");
            return;
        }

        try {
            const response = await fetch("https://api.cartesia.ai/v1/voices", {
                headers: {
                    "X-API-Key": apiKey,
                    "Cartesia-Version": "2023-12-15"
                }
            });

            if (!response.ok) throw new Error("Failed to fetch voices");
            const data = await response.json();

            // Populate Selects
            const selects = [voiceSelect, modalVoiceSelect];
            selects.forEach(sel => {
                if (!sel) return;
                sel.innerHTML = ''; // Clear loading

                data.forEach(voice => {
                    if (voice.language !== 'en' && !voice.is_public) return;

                    const opt = document.createElement('option');
                    opt.value = voice.id;
                    opt.textContent = `${voice.name} (${voice.language})`;
                    if (voice.name.toLowerCase().includes("sonic")) {
                        opt.selected = true;
                    }
                    sel.appendChild(opt);
                });
            });

        } catch (e) {
            console.error("Voice Fetch Error:", e);
        }
    }

    // --- 2. LOGOUT / EXIT BUTTON ---
    function setupExitButton() {
        const exitBtn = document.createElement('div');
        exitBtn.className = 'tool';
        exitBtn.title = "Exit Room";
        exitBtn.style.cursor = 'pointer';
        exitBtn.innerHTML = '<img src="./img/icons8-logout-50.png" alt="Exit" style="width:24px; height:24px;">';
        exitBtn.onclick = () => {
            if (confirm("Exit the room and log out?")) {
                localStorage.removeItem('maximo_uid');
                localStorage.removeItem('maximo_room');
                window.location.reload();
            }
        };
        const toolsContainer = document.querySelector('.tools');
        if (toolsContainer) toolsContainer.insertBefore(exitBtn, toolsContainer.firstChild);
    }

    // --- 3. IDENTITY CHECK (Persistence) ---
    const storedUid = localStorage.getItem('maximo_uid');
    const storedRoom = localStorage.getItem('maximo_room');

    if (storedUid) {
        // Auto-Join or Restore Session
        currentRoom = storedRoom || 'succes';

        db.ref(`rooms/${currentRoom}/users/${storedUid}`).once('value').then(snap => {
            if (snap.exists()) {
                currentUser = { uid: storedUid, ...snap.val() };
                loginModal.style.display = 'none';
                initPipeline();
                // Sync UI
                if (currentUser.language && languageSelect) languageSelect.value = currentUser.language;
                if (currentUser.voiceId && voiceSelect) voiceSelect.value = currentUser.voiceId;
            } else {
                loginModal.style.display = 'flex';
            }
        });
    } else {
        loginModal.style.display = 'flex';
    }

    // --- 4. JOIN ACTION ---
    joinBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        const room = (roomCodeInput && roomCodeInput.value.trim()) ? roomCodeInput.value.trim() : 'succes';
        const lang = modalLanguageSelect ? modalLanguageSelect.value : (languageSelect.value || 'en');
        const voice = modalVoiceSelect ? modalVoiceSelect.value : (voiceSelect.value || '');

        if (!name) return alert("Please enter a name");

        // Set Globals
        currentRoom = room;
        if (languageSelect) languageSelect.value = lang;
        if (voiceSelect) voiceSelect.value = voice;

        // Create New User
        const newUserRef = db.ref(`rooms/${currentRoom}/users`).push();
        const uid = newUserRef.key;

        const userData = {
            name: name,
            role: 'student', // Default
            online: true,
            language: lang,
            voiceId: voice,
            joinedAt: firebase.database.ServerValue.TIMESTAMP
        };

        newUserRef.set(userData).then(() => {
            // PERSIST SESSION
            localStorage.setItem('maximo_uid', uid);
            localStorage.setItem('maximo_room', currentRoom);

            currentUser = { uid, ...userData };
            loginModal.style.display = 'none';
            initPipeline();
        });
    });

    function initPipeline() {
        listenToUsers();
        listenToMessages();
        setupChatHandlers();
    }

    // --- 5. LISTENERS ---
    function listenToUsers() {
        db.ref(`rooms/${currentRoom}/users`).on('value', snap => {
            usersListEl.innerHTML = '';
            const users = snap.val() || {};

            Object.entries(users).forEach(([uid, user]) => {
                const div = document.createElement('div');
                div.className = 'user';
                const isTeacher = user.role === 'teacher';
                const badge = isTeacher ? '⭐' : '';

                div.innerHTML = `
                    <div class="pfp nopic">
                        <img src="./img/icons8-account-96.png" alt="">
                    </div>
                    <div class="userinfo">
                         <div class="name">
                            <p>${user.name} ${badge}</p>
                        </div>
                        <div class="message">
                            <p class="role-badge">${user.role}</p>
                        </div>
                    </div>
                `;
                usersListEl.appendChild(div);
            });
        });

        // Listen to MY role
        db.ref(`rooms/${currentRoom}/users/${currentUser.uid}/role`).on('value', snap => {
            currentUser.role = snap.val();
            // SHOW ADMIN LINK IF TEACHER
            const existingAdminBtn = document.getElementById('admin-link-btn');
            if (currentUser.role === 'teacher') {
                if (!existingAdminBtn) {
                    const btn = document.createElement('div');
                    btn.id = 'admin-link-btn';
                    btn.className = 'tool';
                    btn.style.cursor = 'pointer';
                    btn.innerHTML = '<img src="./img/icons8-settings-50.png" alt="Admin" style="width:30px; height:30px;">';
                    btn.title = "Admin Panel";
                    btn.onclick = () => window.open('admin.html', '_blank');

                    const toolsDiv = document.querySelector('.tools');
                    if (toolsDiv) toolsDiv.appendChild(btn);
                }
            } else {
                if (existingAdminBtn) existingAdminBtn.remove();
            }
        });
    }

    function listenToMessages() {
        chatContainer.innerHTML = '';
        db.ref(`rooms/${currentRoom}/messages`).limitToLast(50).on('child_added', snap => {
            const msg = snap.val();
            const isMe = msg.senderId === currentUser.uid;
            displayFirebaseMessage(msg, isMe);
        });
    }

    // Event Listeners (Moved to setupChatHandlers)
    function setupChatHandlers() {
        sendBtn.addEventListener('click', handleInput);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleInput();
        });
    }

    // --- MAIN HANDLER (FIREBASE) ---
    async function handleInput() {
        const text = messageInput.value.trim();

        if (text) {
            // Text Mode
            messageInput.value = '';
            await pushMessage(text);
        } else {
            // Audio Mode
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                updateMicIcon(false);
            } else {
                await startRecording();
                updateMicIcon(true);
            }
        }
    }

    async function pushMessage(text) {
        if (!currentUser) return;
        await db.ref(`rooms/${currentRoom}/messages`).push({
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }

    // Redefined to Render only (replaced old addMessage logic)
    function displayFirebaseMessage(msg, isSender) {
        // If my message, show as is.
        // If other message, TRANSLATE then show.

        if (isSender) {
            addMessageToUI(msg.text, 'sender', msg.senderName);
        } else {
            // Translate for ME
            const targetLang = languageSelect.value;
            translateText(msg.text, targetLang).then(translated => {
                addMessageToUI(translated, 'receiver', msg.senderName);
                speakText(translated, voiceSelect.value); // Auto-Play
            });
        }
    }

    function addMessageToUI(text, type, senderName) {
        const isSender = type === 'sender';
        const containerDiv = document.createElement('div');
        containerDiv.classList.add(isSender ? 'senderContainer' : 'receiverContainer', 'arrowm');

        const bubbleWrapper = document.createElement('div');
        bubbleWrapper.classList.add(isSender ? 'sender' : 'reciver', 'mepop');

        const replyDiv = document.createElement('div');
        replyDiv.classList.add('thereply');

        const p = document.createElement('p');
        p.innerHTML = `<strong>${senderName || 'Unknown'}</strong><br>${text}`; // Show Name

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

        setTimeout(() => {
            containerDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    }

    // ... STT/TTS variables ...
    let audioContext;
    let ws;
    let mediaRecorder;
    let audioChunks = [];

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

        // --- Visualizer Setup ---
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const visualizer = document.getElementById('visualizer');
        if (visualizer) {
            visualizer.style.display = 'block';
            visualizer.width = visualizer.parentElement.clientWidth;
            visualize(analyser, visualizer);
        }
        // ------------------------

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            // Stop Visualizer
            if (visualizer) visualizer.style.display = 'none';
            // Stop tracks
            stream.getTracks().forEach(track => track.stop());

            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });

            try {
                const text = await transcribeAudio(audioBlob);
                if (text) {
                    await pushMessage(text);
                }
            } catch (err) {
                console.error("STT Failed:", err);
                alert("Audio transcription failed.");
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
        // User requested specific configuration
        const selectedVoiceId = voiceId || "005af375-5aad-4c02-9551-7fc411430542"; // Use selected or default
        const selectedLang = languageSelect.value;

        const message = {
            model_id: "sonic-3-latest",
            transcript: text,
            voice: {
                mode: "id",
                id: selectedVoiceId
            },
            output_format: {
                container: "raw",
                encoding: "pcm_f32le",
                sample_rate: 44100
            },
            language: selectedLang,
            pronunciation_dict_id: "pdict_nyWBBphhMbxQmpmccYdMUy",
            generation_config: {
                speed: 1.0,
                volume: 1.0,
                emotion: ["happy", "content"] // Attempting to match requested emotion
            }
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

        // Simple distinct buffer play for verification:
        const float32 = new Float32Array(bytes.buffer);
        const buffer = audioContext.createBuffer(1, float32.length, 44100);
        buffer.getChannelData(0).set(float32);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start();
    }
});

// Helper for Visualizer (Must be outside)
function visualize(analyser, canvas) {
    const canvasCtx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if (canvas.style.display === 'none') {
            // Stop loop if hidden
            return;
        }

        requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        canvasCtx.fillStyle = "rgb(0, 0, 0)"; // or transparent?
        // Match button color roughly or transparent
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw pulsing circle or bars
        // Simple Bars for now
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2;

            // Red color to match mic
            canvasCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }
    draw();
}
