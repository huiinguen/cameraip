const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const modesWrapper = document.querySelector('.modes-wrapper');
const modeItems = document.querySelectorAll('.mode');
const zoomOptions = document.querySelectorAll('.zoom-option');
const galleryThumbnail = document.getElementById('galleryThumbnail');
const dynamicIsland = document.getElementById('dynamicIsland');
const countdownText = document.getElementById('countdownText');
const timeDisplay = document.querySelector('.time');
const timerBtn = document.getElementById('timerBtn');
const timerMenu = document.getElementById('timerMenu');
const timerDisplay = document.getElementById('timerDisplay');
const filterMenu = document.getElementById('filterMenu');
const filterOptions = document.querySelectorAll('.filter-option');
const photoSlots = document.querySelectorAll('.photo-slot');

let stream = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let currentMode = 'photo';
let currentZoom = 1;
let currentPhotoSlotIndex = 0;
let timerValue = 0;
let photoboothTimerValue = 3;
let currentFilter = 'none';
let recordingTimer = null;
let countdownPromise = null;

// Canvas để xem trước bộ lọc
const previewCanvas = document.createElement('canvas');
const previewContext = previewCanvas.getContext('2d');
previewCanvas.style.position = 'absolute';
previewCanvas.style.top = '0';
previewCanvas.style.left = '0';
previewCanvas.style.width = '100%';
previewCanvas.style.height = '100%';
previewCanvas.style.display = 'block';
document.querySelector('.camera-view').appendChild(previewCanvas);

// Hiển thị giờ thực
function updateTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    timeDisplay.textContent = `${hours}:${minutes}`;
}
updateTime();
setInterval(updateTime, 60000);

// Khởi động camera
async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Trình duyệt của bạn không hỗ trợ truy cập camera.');
        return;
    }
    try {
        stopCamera();
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: true
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play().catch(err => {
                console.error('Lỗi khi phát video:', err);
                alert('Không thể phát video: ' + err.message);
            });
            applyZoom();
            applyFilterToVideo();
        };
    } catch (err) {
        console.error('Lỗi khi truy cập camera:', err);
        alert('Không thể truy cập camera: ' + err.message);
    }
}

// Dừng camera
function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        video.srcObject = null;
    }
}

// Áp dụng zoom
function applyZoom() {
    applyFilterToVideo();
}

// Hiệu ứng Dynamic Island
function animateDynamicIsland() {
    dynamicIsland.classList.add('active');
    setTimeout(() => dynamicIsland.classList.remove('active'), 300);
}

// Cuộn mượt cho thanh chế độ
modesWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    modesWrapper.scrollLeft += e.deltaY * 0.5;
});

// Làm mới gallery
function clearGallery() {
    photoSlots.forEach(slot => {
        const img = slot.querySelector('img');
        const videoEl = slot.querySelector('video');
        img.style.display = 'none';
        img.src = '';
        videoEl.style.display = 'none';
        videoEl.src = '';
    });
    galleryThumbnail.style.display = 'none';
    galleryThumbnail.src = '';
    currentPhotoSlotIndex = 0;
}

// Reset countdown khi chuyển chế độ
function resetCountdown() {
    if (countdownPromise) {
        countdownText.style.display = 'none';
        dynamicIsland.classList.remove('expanded');
        countdownPromise = null;
    }
}

// Chuyển chế độ
modeItems.forEach(mode => {
    mode.addEventListener('click', () => {
        modeItems.forEach(m => m.classList.remove('active'));
        mode.classList.add('active');
        currentMode = mode.dataset.mode;
        const modeRect = mode.getBoundingClientRect();
        const wrapperRect = modesWrapper.getBoundingClientRect();
        const scrollPosition = mode.offsetLeft - (wrapperRect.width / 2) + (modeRect.width / 2);
        modesWrapper.scrollTo({ left: scrollPosition, behavior: 'smooth' });

        if (isRecording) stopRecording();
        resetCountdown();
        clearGallery();

        filterMenu.style.display = 'block';
        previewCanvas.style.display = 'block';
        video.style.display = 'none';
        applyFilterToVideo();
    });
});

// Chuyển đổi zoom
zoomOptions.forEach(option => {
    option.addEventListener('click', () => {
        zoomOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        currentZoom = parseFloat(option.dataset.zoom);
        applyZoom();
    });
});

// Xử lý nút timer
timerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    timerMenu.style.display = timerMenu.style.display === 'block' ? 'none' : 'block';
});

document.querySelectorAll('.timer-option').forEach(option => {
    option.addEventListener('click', (e) => {
        e.stopPropagation();
        timerValue = parseInt(option.dataset.time);
        photoboothTimerValue = timerValue;
        timerMenu.style.display = 'none';
    });
});

document.addEventListener('click', (e) => {
    if (!timerBtn.contains(e.target) && !timerMenu.contains(e.target)) {
        timerMenu.style.display = 'none';
    }
});

// Xử lý chọn bộ lọc
filterOptions.forEach(option => {
    option.addEventListener('click', () => {
        filterOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        currentFilter = option.dataset.filter;
        applyFilterToVideo();
    });
});

// Đếm ngược (hiển thị trong Dynamic Island)
async function countdown(seconds) {
    dynamicIsland.classList.add('expanded');
    countdownText.style.display = 'block';
    countdownPromise = new Promise(resolve => {
        let i = seconds;
        const interval = setInterval(() => {
            countdownText.textContent = i;
            if (i <= 0 || currentMode !== 'photobooth') {
                clearInterval(interval);
                countdownText.style.display = 'none';
                dynamicIsland.classList.remove('expanded');
                resolve();
            }
            i--;
        }, 1000);
    });
    return countdownPromise;
}

// Đếm thời gian quay video
function startRecordingTimer() {
    let seconds = 0;
    dynamicIsland.classList.add('expanded');
    countdownText.style.display = 'block';
    recordingTimer = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        countdownText.textContent = `${minutes}:${secs}`;
    }, 1000);
}

function stopRecordingTimer() {
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    countdownText.style.display = 'none';
    dynamicIsland.classList.remove('expanded');
}

// Thuật toán cải thiện chất lượng ảnh
function sharpen(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const tempData = new Uint8ClampedArray(data);

    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
            for (let c = 0; c < 3; c++) {
                const center = tempData[i + c];
                const laplacian = center * 4 - (
                    tempData[i + c - width * 4] + // Top
                    tempData[i + c + width * 4] + // Bottom
                    tempData[i + c - 4] +         // Left
                    tempData[i + c + 4]           // Right
                );
                data[i + c] = Math.min(255, Math.max(0, center + laplacian * 0.5));
            }
        }
    }
}

function autoContrast(imageData) {
    const data = imageData.data;
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;

    for (let i = 0; i < data.length; i += 4) {
        minR = Math.min(minR, data[i]);
        maxR = Math.max(maxR, data[i]);
        minG = Math.min(minG, data[i + 1]);
        maxG = Math.max(maxG, data[i + 1]);
        minB = Math.min(minB, data[i + 2]);
        maxB = Math.max(maxB, data[i + 2]);
    }

    for (let i = 0; i < data.length; i += 4) {
        data[i] = ((data[i] - minR) * 255) / (maxR - minR);
        data[i + 1] = ((data[i + 1] - minG) * 255) / (maxG - minG);
        data[i + 2] = ((data[i + 2] - minB) * 255) / (maxB - minB);
    }
}

function reduceNoise(imageData) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const tempData = new Uint8ClampedArray(data);

    for (let i = 0; i < data.length; i += 4) {
        const x = (i / 4) % width;
        const y = Math.floor((i / 4) / width);
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
            for (let c = 0; c < 3; c++) {
                data[i + c] = (
                    tempData[i + c] * 0.4 +
                    (tempData[i + c - width * 4] + tempData[i + c + width * 4] +
                     tempData[i + c - 4] + tempData[i + c + 4]) * 0.15
                );
            }
        }
    }
}

// Áp dụng bộ lọc lên video (xem trước)
function applyFilterToVideo() {
    previewCanvas.width = video.videoWidth || 1200;
    previewCanvas.height = video.videoHeight || 900;

    function renderFrame() {
        if (!video.srcObject || video.paused) return;

        const srcWidth = previewCanvas.width / currentZoom;
        const srcHeight = previewCanvas.height / currentZoom;
        const srcX = (previewCanvas.width - srcWidth) / 2;
        const srcY = (previewCanvas.height - srcHeight) / 2;

        previewContext.drawImage(
            video,
            srcX, srcY, srcWidth, srcHeight,
            0, 0, previewCanvas.width, previewCanvas.height
        );

        if (currentFilter !== 'none') {
            const imageData = previewContext.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
            applyFilter(imageData);
            previewContext.putImageData(imageData, 0, 0);
        }
        requestAnimationFrame(renderFrame);
    }
    renderFrame();
}

// Áp dụng bộ lọc
function applyFilter(imageData) {
    reduceNoise(imageData);
    sharpen(imageData);
    autoContrast(imageData);

    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        switch (currentFilter) {
            case 'vintage-gold':
                data[i] = r * 0.9 + 40;
                data[i + 1] = g * 0.7 + 20;
                data[i + 2] = b * 0.5;
                break;
            case 'sepia':
                data[i] = r * 0.393 + g * 0.769 + b * 0.189;
                data[i + 1] = r * 0.349 + g * 0.686 + b * 0.168;
                data[i + 2] = r * 0.272 + g * 0.534 + b * 0.131;
                break;
            case 'classic-blue':
                data[i] = r * 0.5;
                data[i + 1] = g * 0.7;
                data[i + 2] = b * 0.9 + 30;
                break;
            case 'bright-clear':
                data[i] = Math.min(255, r * 1.2);
                data[i + 1] = Math.min(255, g * 1.2);
                data[i + 2] = Math.min(255, b * 1.2);
                break;
            case 'pastel':
                data[i] = Math.min(255, r * 0.9 + 50);
                data[i + 1] = Math.min(255, g * 0.9 + 50);
                data[i + 2] = Math.min(255, b * 0.9 + 50);
                break;
            case 'neon':
                data[i] = r > 128 ? 255 : r * 0.8;
                data[i + 1] = g > 128 ? 255 : g * 0.8;
                data[i + 2] = b > 128 ? 255 : b * 0.8;
                break;
            case 'cyberpunk':
                data[i] = r * 0.8;
                data[i + 1] = g * 0.5;
                data[i + 2] = b * 1.2 + 50;
                break;
            case 'dreamy-purple':
                data[i] = r * 0.7 + 30;
                data[i + 1] = g * 0.6;
                data[i + 2] = b * 1.1 + 40;
                break;
            case 'retro-wave':
                data[i] = r * 1.1 + 20;
                data[i + 1] = g * 0.6;
                data[i + 2] = b * 0.9 + 30;
                break;
            case 'sunset-glow':
                data[i] = Math.min(255, r * 1.2 + 40);
                data[i + 1] = g * 0.8 + 20;
                data[i + 2] = b * 0.6;
                break;
            case 'mono-chrome':
                const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
                data[i] = gray;
                data[i + 1] = gray;
                data[i + 2] = gray;
                break;
            case 'pop-art':
                data[i] = r > 128 ? 255 : 0;
                data[i + 1] = g > 128 ? 255 : 0;
                data[i + 2] = b > 128 ? 255 : 0;
                break;
        }
    }
}

// Xử lý photo slots (nhấn để lưu, nút X để xóa)
photoSlots.forEach(slot => {
    const deleteBtn = slot.querySelector('.delete-btn');
    const img = slot.querySelector('img');
    const videoEl = slot.querySelector('video');

    slot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target === deleteBtn) return;

        if (currentMode === 'photobooth') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const images = Array.from(photoSlots).map(s => s.querySelector('img'));

            canvas.width = 1920;
            canvas.height = 1080;

            ctx.fillStyle = '#FFC1CC';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#000000';
            ctx.font = 'bold 60px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const text = 'Nào hãy xõa đi thoii các bẹn🤩';
            const textX = 1200 + (720 / 2);
            const textY = canvas.height / 2;
            ctx.fillText(text, textX, textY);

            let loadedImages = 0;
            images.forEach((img, index) => {
                if (img.src) {
                    const image = new Image();
                    image.src = img.src;
                    image.onload = () => {
                        const x = (index % 2) * 600;
                        const y = Math.floor(index / 2) * 600;
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(x, y, 600, 600);
                        ctx.drawImage(image, x + 5, y + 5, 590, 590);
                        loadedImages++;
                        if (loadedImages === images.filter(i => i.src).length) {
                            const link = document.createElement('a');
                            link.href = canvas.toDataURL('image/png');
                            link.download = `photobooth_${Date.now()}.png`;
                            link.click();
                        }
                    };
                    image.onerror = () => {
                        console.error('Error loading image for slot:', index);
                        loadedImages++;
                        if (loadedImages === images.filter(i => i.src).length) {
                            const link = document.createElement('a');
                            link.href = canvas.toDataURL('image/png');
                            link.download = `photobooth_${Date.now()}.png`;
                            link.click();
                        }
                    };
                } else {
                    loadedImages++;
                    if (loadedImages === images.filter(i => i.src).length) {
                        const link = document.createElement('a');
                        link.href = canvas.toDataURL('image/png');
                        link.download = `photobooth_${Date.now()}.png`;
                        link.click();
                    }
                }
            });
        } else if (img.src && img.style.display === 'block') {
            const link = document.createElement('a');
            link.href = img.src;
            link.download = `photo_${Date.now()}.png`;
            link.click();
        } else if (videoEl.src && videoEl.style.display === 'block') {
            const link = document.createElement('a');
            link.href = videoEl.src;
            link.download = `video_${Date.now()}.webm`;
            link.click();
        }
    });

    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        img.style.display = 'none';
        img.src = '';
        videoEl.style.display = 'none';
        videoEl.src = '';
        const lastVisibleSlot = Array.from(photoSlots).reverse().find(s => s.querySelector('img').style.display === 'block');
        if (lastVisibleSlot) {
            galleryThumbnail.src = lastVisibleSlot.querySelector('img').src;
            galleryThumbnail.style.display = 'block';
        } else {
            galleryThumbnail.style.display = 'none';
            galleryThumbnail.src = '';
        }
    });
});

// Chụp ảnh hoặc quay video
captureBtn.addEventListener('click', async () => {
    if (!stream) {
        alert('Camera không hoạt động. Vui lòng kiểm tra quyền truy cập.');
        return;
    }
    if (currentMode === 'photo') {
        if (timerValue > 0) await countdown(timerValue);
        capturePhoto();
    } else if (currentMode === 'video') {
        if (!isRecording) {
            if (timerValue > 0) await countdown(timerValue);
            startRecording();
        } else {
            stopRecording();
        }
    } else if (currentMode === 'photobooth') {
        capturePhotobooth();
    }
});

// Chụp ảnh
function capturePhoto() {
    animateDynamicIsland();
    const context = canvas.getContext('2d');
    canvas.width = 1920;
    canvas.height = 1080;

    const srcWidth = video.videoWidth / currentZoom;
    const srcHeight = video.videoHeight / currentZoom;
    const srcX = (video.videoWidth - srcWidth) / 2;
    const srcY = (video.videoHeight - srcHeight) / 2;

    context.drawImage(
        video,
        srcX, srcY, srcWidth, srcHeight,
        0, 0, canvas.width, canvas.height
    );

    if (currentFilter !== 'none') {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        applyFilter(imageData);
        context.putImageData(imageData, 0, 0);
    }
    const imageData = canvas.toDataURL('image/png');
    updateGallery(imageData, 'photo');
}

// Chụp Photobooth
async function capturePhotobooth() {
    for (let i = 0; i < 4; i++) {
        if (currentMode !== 'photobooth') break;
        await countdown(photoboothTimerValue);
        if (currentMode !== 'photobooth') break;
        animateDynamicIsland();
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const srcWidth = video.videoWidth / currentZoom;
        const srcHeight = video.videoHeight / currentZoom;
        const srcX = (video.videoWidth - srcWidth) / 2;
        const srcY = (video.videoHeight - srcHeight) / 2;

        context.drawImage(
            video,
            srcX, srcY, srcWidth, srcHeight,
            0, 0, canvas.width, canvas.height
        );

        if (currentFilter !== 'none') {
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            applyFilter(imageData);
            context.putImageData(imageData, 0, 0);
        }
        const imageData = canvas.toDataURL('image/png');
        updateGallery(imageData, 'photo', i);
    }
    currentPhotoSlotIndex = 0;
}

// Bắt đầu quay video (ghi từ canvas)
async function startRecording() {
    const canvasStream = previewCanvas.captureStream(30); // 30 FPS
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
        const audioStream = new MediaStream(audioTracks);
        const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioStream.getAudioTracks()]);
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(combinedStream);
    } else {
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(canvasStream);
    }

    mediaRecorder.ondataavailable = (event) => recordedChunks.push(event.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const videoURL = URL.createObjectURL(blob);
        updateGallery(videoURL, 'video');
    };
    mediaRecorder.start();
    isRecording = true;
    captureBtn.classList.add('recording');
    animateDynamicIsland();
    startRecordingTimer();
}

// Dừng quay video
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        captureBtn.classList.remove('recording');
        animateDynamicIsland();
        stopRecordingTimer();
    }
}

// Cập nhật gallery
function updateGallery(data, type, slotIndex = null) {
    const index = slotIndex !== null ? slotIndex : currentPhotoSlotIndex;
    const slot = photoSlots[index];
    const img = slot.querySelector('img');
    const videoEl = slot.querySelector('video');
    if (type === 'photo') {
        img.src = data;
        img.style.display = 'block';
        videoEl.style.display = 'none';
        videoEl.src = '';
        galleryThumbnail.src = data;
        galleryThumbnail.style.display = 'block';
    } else if (type === 'video') {
        videoEl.src = data;
        videoEl.style.display = 'block';
        img.style.display = 'none';
        img.src = '';
        galleryThumbnail.style.display = 'none';
    }
    if (slotIndex === null) currentPhotoSlotIndex = (currentPhotoSlotIndex + 1) % 4;
}

// Khởi động ứng dụng
window.addEventListener('load', () => {
    startCamera();
    timerBtn.style.display = 'flex';
});

window.addEventListener('unload', stopCamera);
