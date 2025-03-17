const recordBtn = document.getElementById('recordBtn');
const statusText = document.getElementById('statusText');


let mediaStream = null;      
let harkEvents = null;       
let isSessionActive = false; 
let isSegmentRecording = false; 
let mediaRecorder = null;   
let socket = null;           
let silenceTimer = null;     


async function initMicrophone() {
    if (!mediaStream) {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone access granted');
        } catch (err) {
            console.error('Microphone access denied', err);
            alert('Please allow microphone access to record audio.');
        }
    }
}


async function startSession() {
    await initMicrophone();
    if (!mediaStream) return;

    isSessionActive = true;
    recordBtn.textContent = 'Stop';
    statusText.textContent = 'Session started. Speak to record...';

    harkEvents = hark(mediaStream, { threshold: -50, interval: 200 });

    harkEvents.on('speaking', () => {
        console.log('[VAD] Speaking detected');
        statusText.textContent = 'Speaking...';
        if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
        }
        if (!isSegmentRecording) {
            startNewSegment();
        }
    });

   
    harkEvents.on('stopped_speaking', () => {
        console.log('[VAD] Silence detected');
        statusText.textContent = 'Silence...';

        
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
            if (isSegmentRecording) {
                console.log('[VAD] Stopping segment due to silence');
                stopSegment();
            }
        }, 1000);
    });
}


function stopSession() {
    isSessionActive = false;
    recordBtn.textContent = 'Record';
    statusText.textContent = 'Session stopped';

    
    if (harkEvents) {
        harkEvents.stop();
        harkEvents = null;
    }

    
    if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
    }

    
    if (isSegmentRecording) {
        stopSegment();
    }


}


function startNewSegment() {
    console.log('[Segment] Starting new segment...');
    isSegmentRecording = true;

    socket = new WebSocket('ws://localhost:8080');
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
        console.log('[WS] Segment WebSocket open');
        try {
            mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm;codecs=opus' });
        } catch (err) {
            console.warn('Opus not supported, fallback to default', err);
            mediaRecorder = new MediaRecorder(mediaStream);
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                socket.send(e.data);
                console.log(`[Segment] Sent ${e.data.size} bytes`);
            }
        };

        mediaRecorder.onstart = () => {
            recordBtn.classList.add('recording');
            console.log('[Segment] MediaRecorder started');
        };

        mediaRecorder.onstop = () => {
            recordBtn.classList.remove('recording');
            console.log('[Segment] MediaRecorder stopped');
        };

        mediaRecorder.start(1000);
        console.log('[Segment] Recording started');
    };

    socket.onclose = () => {
        console.log('[WS] Segment WebSocket closed');
    };
    socket.onerror = (err) => {
        console.error('[WS] error:', err);
    };
}


function stopSegment() {
    console.log('[Segment] Stopping current segment...');
    
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();  
    }
    mediaRecorder = null;

    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    socket = null;

    isSegmentRecording = false;
}


recordBtn.addEventListener('click', () => {
    if (!isSessionActive) {
        startSession();
    } else {
        stopSession();
    }
});
