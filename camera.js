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

// Canvas để xem trước bộ lọc
const previewCanvas = document.createElement('canvas');
const previewContext = previewCanvas.getContext('2d');
previewCanvas.style.position = 'absolute';
previewCanvas.style.top = '0';
previewCanvas.style.left = '0';
previewCanvas.style.width = '100%';
previewCanvas.style.height = '100%';
previewCanvas.style.display = 'none';
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
    video.style.transform = `scale(${currentZoom})`;
    previewCanvas.style.transform = `scale(${currentZoom})`;
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
        clearGallery();

        filterMenu.style.display = currentMode === 'photobooth' ? 'block' : 'none';
        previewCanvas.style.display = currentMode === 'photobooth' ? 'block' : 'none';
        video.style.display = currentMode === 'photobooth' ? 'none' : 'block';
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
    for (let i = seconds; i >= 0; i--) {
        countdownText.textContent = i;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    countdownText.style.display = 'none';
    dynamicIsland.classList.remove('expanded');
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

// Áp dụng bộ lọc lên video (xem trước)
function applyFilterToVideo() {
    if (currentMode !== 'photobooth') return;

    previewCanvas.width = video.videoWidth || 1200;
    previewCanvas.height = video.videoHeight || 900;

    function renderFrame() {
        if (!video.srcObject || video.paused) return;
        previewContext.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);
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
        }
    }
}

// Xử lý photo slots (nhấn để lưu, nút X để xóa)
photoSlots.forEach(slot => {
    const deleteBtn = slot.querySelector('.delete-btn');
    const img = slot.querySelector('img');
    const videoEl = slot.querySelector('video');

    // Nhấn vào photo-slot để lưu
    slot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target === deleteBtn) return; // Không lưu nếu nhấn vào nút X

        if (currentMode === 'photobooth') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const images = Array.from(photoSlots).map(s => s.querySelector('img'));
        
            canvas.width = 1920;
            canvas.height = 1080;
        
            // Vẽ nền hồng nhạt cho toàn bộ ảnh
            ctx.fillStyle = '#FFC1CC';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        
            // Thêm chữ vào phần thừa bên phải
            ctx.fillStyle = '#000000'; // Màu chữ: đen
            ctx.font = 'bold 60px Arial'; // Font chữ: Arial, kích thước 60px, đậm
            ctx.textAlign = 'center'; // Căn giữa theo chiều ngang
            ctx.textBaseline = 'middle'; // Căn giữa theo chiều dọc
            const text = 'Nào hãy xõa đi thoii các bẹn🤩'; // Nội dung chữ
            const textX = 1200 + (720 / 2); // Vị trí x: giữa phần thừa (1200 + 720/2 = 1560)
            const textY = canvas.height / 2; // Vị trí y: giữa chiều cao (1080/2 = 540)
            ctx.fillText(text, textX, textY); // Vẽ chữ
        
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
                            link.download = `photbooth_${Date.now()}.png`;
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
        }
        else if (img.src && img.style.display === 'block') {
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

    // Nhấn nút X để xóa
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        img.style.display = 'none';
        img.src = '';
        videoEl.style.display = 'none';
        videoEl.src = '';
        // Cập nhật gallery thumbnail
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
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
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
        await countdown(photoboothTimerValue);
        animateDynamicIsland();
        const context = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
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

// Bắt đầu quay video
async function startRecording() {
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
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