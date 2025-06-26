const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const personCountSpan = document.getElementById("person-count");
const toggleBtn = document.getElementById("toggle-analysis-btn");
const exportBtn = document.getElementById("export-csv-btn");
const toggleLogBtn = document.getElementById("toggle-log-btn");
const loadingIndicator = document.getElementById("loading-model");
const analyzingIndicator = document.getElementById("analyzing-text");
const toast = document.getElementById("toast");
const logBody = document.getElementById("log-body");
const logDisplay = document.getElementById("log-display");

let model = null;
let isAnalyzing = false;
let animationFrameId = null;
let recordedData = [];
let lastLogTime = 0;

async function initialize() {
  try {
    await tf.setBackend("webgl");
    await tf.ready();
    model = await cocoSsd.load();
    loadingIndicator.classList.add("hidden");
    await setupCamera();
    drawVideoToCanvas();
  } catch (error) {
    alert(`初期化に失敗しました: ${error.message}`);
    loadingIndicator.innerText = "初期化エラー";
  }
}

async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        toggleBtn.disabled = false;
        exportBtn.disabled = false;
        resolve();
      };
    });
  } catch (error) {
    alert("カメラへのアクセスが許可されませんでした。");
    loadingIndicator.innerText = "カメラアクセス不可";
  }
}

function drawVideoToCanvas() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if (!isAnalyzing) {
    requestAnimationFrame(drawVideoToCanvas);
  }
}

function toggleAnalysis() {
  isAnalyzing = !isAnalyzing;
  if (isAnalyzing) startAnalysis();
  else stopAnalysis();
}

function startAnalysis() {
  toggleBtn.textContent = "停止";
  toggleBtn.classList.remove("start");
  toggleBtn.classList.add("stop");
  canvas.classList.add("analyzing");
  analyzingIndicator.classList.remove("hidden");
  detectFrame();
}

function stopAnalysis() {
  toggleBtn.textContent = "開始";
  toggleBtn.classList.remove("stop");
  toggleBtn.classList.add("start");
  canvas.classList.remove("analyzing");
  analyzingIndicator.classList.add("hidden");
  cancelAnimationFrame(animationFrameId);
  drawVideoToCanvas(); // 映像描画は継続
}

async function detectFrame() {
  if (!isAnalyzing || video.paused || video.ended) return;
  const predictions = await model.detect(video);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  let personCount = 0;
  predictions.forEach(prediction => {
    if (prediction.class === "person") {
      personCount++;
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(...prediction.bbox);
      ctx.stroke();
    }
  });
  personCountSpan.textContent = personCount;
  const now = new Date();
  const timestamp = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;
  if (now - lastLogTime >= 1000) {
    recordedData.push({ timestamp, count: personCount });
    updateLogDisplay();
    lastLogTime = now;
  }
  animationFrameId = requestAnimationFrame(detectFrame);
}

function updateLogDisplay() {
  logBody.innerHTML = "";
  const latestLogs = recordedData.slice(-20).reverse();
  latestLogs.forEach(log => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${log.timestamp}</td><td>${log.count}</td>`;
    logBody.appendChild(row);
  });
}

function exportCSV() {
  if (recordedData.length === 0) {
    alert("出力するデータがありません。");
    return;
  }

  const header = "日時,人数\n";
  const rows = recordedData.map(row => `"${row.timestamp}",${row.count}`);
  const csvContent = header + rows.join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `count_log_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  recordedData = [];
  showToast();
}


function showToast() {
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

function toggleLogDisplay() {
  logDisplay.classList.toggle("hidden");
}

toggleBtn.addEventListener("click", toggleAnalysis);
exportBtn.addEventListener("click", exportCSV);
toggleLogBtn.addEventListener("click", toggleLogDisplay);
window.addEventListener("load", initialize);
