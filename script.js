const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const personCountSpan = document.getElementById('person-count');
const toggleBtn = document.getElementById('toggle-analysis-btn');
const exportBtn = document.getElementById('export-csv-btn');
const loadingIndicator = document.getElementById('loading-model');
const analyzingIndicator = document.getElementById('analyzing-text');
const toast = document.getElementById('toast');

let model = null;
let isAnalyzing = false;
let animationFrameId = null;
let recordedData = [];

async function initialize() {
    try {
        await tf.setBackend('webgl');
        await tf.ready();
        console.log("TensorFlow.js backend is ready.");

        model = await cocoSsd.load();
        console.log("Model loaded.");
        loadingIndicator.classList.add('hidden');

        await setupCamera();
    } catch (error) {
        console.error("Initialization failed:", error);
        alert(`初期化に失敗しました: ${error.message}\nページを再読み込みしてください。`);
        loadingIndicator.innerText = "初期化エラー";
    }
}

async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play().catch(error => console.error("Video play failed:", error));
                video.hidden = true;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                toggleBtn.disabled = false;
                exportBtn.disabled = false;
                console.log("Camera setup complete.");
                resolve();
            };
        });
    } catch (error) {
        console.error("Camera access error:", error);
        alert('カメラへのアクセスが許可されませんでした。ブラウザの設定を確認し、カメラの使用を許可してください。');
        loadingIndicator.innerText = "カメラアクセス不可";
    }
}

function toggleAnalysis() {
    isAnalyzing = !isAnalyzing;
    if (isAnalyzing) {
        startAnalysis();
    } else {
        stopAnalysis();
    }
}

function startAnalysis() {
    toggleBtn.textContent = '停止';
    toggleBtn.classList.remove('start');
    toggleBtn.classList.add('stop');
    canvas.classList.add('analyzing');
    analyzingIndicator.classList.remove('hidden');

    detectFrame(); // 60fpsモード復活
}

function stopAnalysis() {
    toggleBtn.textContent = '開始';
    toggleBtn.classList.remove('stop');
    toggleBtn.classList.add('start');
    canvas.classList.remove('analyzing');
    analyzingIndicator.classList.add('hidden');

    cancelAnimationFrame(animationFrameId);
}

async function detectFrame() {
    if (!isAnalyzing || video.paused || video.ended) return;

    const predictions = await model.detect(video);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    let personCount = 0;
    predictions.forEach(prediction => {
        if (prediction.class === 'person') {
            personCount++;
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.rect(...prediction.bbox);
            ctx.stroke();
        }
    });

    personCountSpan.textContent = personCount;

    const now = new Date();
    const timestamp = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${String(now.getHours()).padStart(2, '0')}/${String(now.getMinutes()).padStart(2, '0')}/${String(now.getSeconds()).padStart(2, '0')}`;
    recordedData.push({ timestamp, count: personCount });

    animationFrameId = requestAnimationFrame(detectFrame); // ← 60fps検出継続
}

function exportCSV() {
    if (recordedData.length === 0) {
        alert('出力するデータがありません。先に解析を開始してください。');
        return;
    }

    // BOM付きでエンコード（Excelで文字化け防止）
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "日時,人数\n";
    recordedData.forEach(row => {
        csvContent += `${row.timestamp},${row.count}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `count_log_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    recordedData = [];
    showToast();
}

function showToast() {
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

toggleBtn.addEventListener('click', toggleAnalysis);
exportBtn.addEventListener('click', exportCSV);
window.addEventListener('load', initialize);
