/**
 * Employee Attendance Management System
 * Core Client Application Logic - Debugiz Attendance Portal
 * Extended with Attendance Compensation & Working Hours Calculation
 */

(function () {
  'use strict';

  // --- State Variables ---
  const state = {
    employeeName: '',
    employeeId: '',
    status: '', // 'Check In' or 'Check Out'
    capturedImageBase64: null,
    mediaStream: null,
    facingMode: 'user', // 'user' (front) or 'environment' (back)
    apiUrl: 'https://script.google.com/macros/s/AKfycbyrUeDCMBX0CPwpjeJ7wuqowiIA3al3951IO1_X7wmcIejY1-YZV8VXdzMAScNfm8aK/exec',
    isDemoMode: localStorage.getItem('gas_attendance_demo_mode') === 'true',
    isSubmitting: false
  };

  const REQUIRED_SECONDS = 32400; // 9 Hours

  // --- DOM Elements ---
  const elements = {
    // Form Inputs
    employeeName: document.getElementById('employeeName'),
    employeeId: document.getElementById('employeeId'),
    attendanceStatus: document.getElementById('attendanceStatus'),
    btnCheckIn: document.getElementById('btnCheckIn'),
    btnCheckOut: document.getElementById('btnCheckOut'),

    // Camera Elements
    cameraBox: document.getElementById('cameraBox'),
    webcamVideo: document.getElementById('webcamVideo'),
    snapshotCanvas: document.getElementById('snapshotCanvas'),
    cameraOverlay: document.getElementById('cameraOverlay'),
    shutterFlash: document.getElementById('shutterFlash'),
    btnFlipCamera: document.getElementById('btnFlipCamera'),
    previewBox: document.getElementById('previewBox'),
    selfiePreview: document.getElementById('selfiePreview'),
    btnStartCamera: document.getElementById('btnStartCamera'),
    btnCaptureSelfie: document.getElementById('btnCaptureSelfie'),
    btnRetakeSelfie: document.getElementById('btnRetakeSelfie'),

    // Timestamp Elements
    displayDate: document.getElementById('displayDate'),
    displayTime: document.getElementById('displayTime'),

    // Validation Elements
    valName: document.getElementById('valName'),
    valId: document.getElementById('valId'),
    valStatus: document.getElementById('valStatus'),
    valSelfie: document.getElementById('valSelfie'),
    btnSubmitAttendance: document.getElementById('btnSubmitAttendance'),
    submitSpinner: document.getElementById('submitSpinner'),
    submitText: document.getElementById('submitText'),

    // Status Alert
    statusAlert: document.getElementById('statusAlert'),
    alertText: document.getElementById('alertText'),

    // Modals & Summary Elements
    successModal: document.getElementById('successModal'),
    btnCloseSuccessModal: document.getElementById('btnCloseSuccessModal'),
    resultBanner: document.getElementById('resultBanner'),
    resultBannerIcon: document.getElementById('resultBannerIcon'),
    resultBannerText: document.getElementById('resultBannerText'),
    sumName: document.getElementById('sumName'),
    sumId: document.getElementById('sumId'),
    sumStatus: document.getElementById('sumStatus'),
    sumTime: document.getElementById('sumTime'),

    // Check Out Metrics
    checkOutSummaryGroup: document.getElementById('checkOutSummaryGroup'),
    sumCheckInTime: document.getElementById('sumCheckInTime'),
    sumCheckOutTime: document.getElementById('sumCheckOutTime'),
    sumWorkHours: document.getElementById('sumWorkHours'),
    sumCompRow: document.getElementById('sumCompRow'),
    sumCompTime: document.getElementById('sumCompTime'),
    sumOvertimeRow: document.getElementById('sumOvertimeRow'),
    sumOvertime: document.getElementById('sumOvertime'),

    // Config Modal
    configModal: document.getElementById('configModal'),
    btnOpenConfig: document.getElementById('btnOpenConfig'),
    btnCloseConfigModal: document.getElementById('btnCloseConfigModal'),
    apiUrlInput: document.getElementById('apiUrlInput'),
    chkDemoMode: document.getElementById('chkDemoMode'),
    btnSaveConfig: document.getElementById('btnSaveConfig')
  };

  // --- Initialization ---
  function init() {
    setupEventListeners();
    startClockTimer();
    updateValidationUI();

    elements.apiUrlInput.value = state.apiUrl;
    elements.chkDemoMode.checked = state.isDemoMode;
  }

  // --- Clock & Timestamp Utilities ---
  function formatCurrentDateTime() {
    const now = new Date();

    // Format Date: DD-MMM-YYYY (e.g. 05-Aug-2026)
    const day = String(now.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const formattedDate = `${day}-${month}-${year}`;

    // Format Time: HH:MM:SS AM/PM (e.g. 09:45:23 AM)
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const formattedHours = String(hours).padStart(2, '0');
    const formattedTime = `${formattedHours}:${minutes}:${seconds} ${ampm}`;

    const timestampISO = now.toISOString();

    return { formattedDate, formattedTime, timestampISO, rawDate: now };
  }

  function startClockTimer() {
    function updateClock() {
      const dt = formatCurrentDateTime();
      elements.displayDate.textContent = dt.formattedDate;
      elements.displayTime.textContent = dt.formattedTime;
    }
    updateClock();
    setInterval(updateClock, 1000);
  }

  // --- Calculation Helpers ---
  function formatSecondsToHHMMSS(sec) {
    if (isNaN(sec) || sec < 0) sec = 0;
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = Math.floor(sec % 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function parseTimeToSeconds(timeStr) {
    if (!timeStr || timeStr === '-') return 0;
    const parts = String(timeStr).trim().split(' ');
    const timePart = parts[0];
    const ampm = parts[1] ? parts[1].toUpperCase() : '';
    const t = timePart.split(':');
    let h = parseInt(t[0], 10) || 0;
    const m = parseInt(t[1], 10) || 0;
    const s = parseInt(t[2], 10) || 0;

    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 3600 + m * 60 + s;
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Input Fields
    elements.employeeName.addEventListener('input', (e) => {
      state.employeeName = e.target.value.trim();
      updateValidationUI();
    });

    elements.employeeId.addEventListener('input', (e) => {
      state.employeeId = e.target.value.trim();
      updateValidationUI();
    });

    // Check In / Check Out Toggles
    elements.btnCheckIn.addEventListener('click', () => setAttendanceStatus('Check In'));
    elements.btnCheckOut.addEventListener('click', () => setAttendanceStatus('Check Out'));

    // Camera Controls
    elements.btnStartCamera.addEventListener('click', startCameraStream);
    elements.btnCaptureSelfie.addEventListener('click', captureSnapshot);
    elements.btnRetakeSelfie.addEventListener('click', retakePhoto);
    elements.btnFlipCamera.addEventListener('click', flipCamera);

    // Form Submission
    elements.btnSubmitAttendance.addEventListener('click', handleSubmit);

    // Modals
    elements.btnCloseSuccessModal.addEventListener('click', () => {
      hideModal(elements.successModal);
      resetForm();
    });

    elements.btnOpenConfig.addEventListener('click', () => {
      elements.apiUrlInput.value = state.apiUrl;
      elements.chkDemoMode.checked = state.isDemoMode;
      showModal(elements.configModal);
    });

    elements.btnCloseConfigModal.addEventListener('click', () => hideModal(elements.configModal));

    elements.btnSaveConfig.addEventListener('click', () => {
      state.apiUrl = elements.apiUrlInput.value.trim();
      state.isDemoMode = elements.chkDemoMode.checked;
      localStorage.setItem('gas_attendance_api_url', state.apiUrl);
      localStorage.setItem('gas_attendance_demo_mode', state.isDemoMode ? 'true' : 'false');
      hideModal(elements.configModal);
      showAlert('Configuration updated successfully!', 'success');
    });
  }

  // --- Attendance Status Toggle ---
  function setAttendanceStatus(selectedStatus) {
    state.status = selectedStatus;
    elements.attendanceStatus.value = selectedStatus;

    if (selectedStatus === 'Check In') {
      elements.btnCheckIn.classList.add('active');
      elements.btnCheckOut.classList.remove('active');
    } else {
      elements.btnCheckOut.classList.add('active');
      elements.btnCheckIn.classList.remove('active');
    }
    updateValidationUI();
  }

  // --- Live Camera Management ---
  async function startCameraStream() {
    stopCameraStream();

    try {
      const constraints = {
        video: {
          facingMode: state.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      };

      state.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      elements.webcamVideo.srcObject = state.mediaStream;

      elements.cameraBox.classList.remove('hidden');
      elements.previewBox.classList.add('hidden');
      elements.btnStartCamera.classList.add('hidden');
      elements.btnCaptureSelfie.classList.remove('hidden');
      elements.btnRetakeSelfie.classList.add('hidden');
      hideAlert();

    } catch (err) {
      console.error('Camera access error:', err);
      showAlert('Could not access camera. Please allow camera permissions in your browser.', 'error');
    }
  }

  function stopCameraStream() {
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
    }
  }

  function flipCamera() {
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    startCameraStream();
  }

  function captureSnapshot() {
    if (!state.mediaStream) return;

    const video = elements.webcamVideo;
    const canvas = elements.snapshotCanvas;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');

    if (state.facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    elements.shutterFlash.classList.add('flash');
    setTimeout(() => elements.shutterFlash.classList.remove('flash'), 200);

    const base64Data = canvas.toDataURL('image/jpeg', 0.85);
    state.capturedImageBase64 = base64Data;

    elements.selfiePreview.src = base64Data;
    elements.cameraBox.classList.add('hidden');
    elements.previewBox.classList.remove('hidden');
    elements.btnCaptureSelfie.classList.add('hidden');
    elements.btnRetakeSelfie.classList.remove('hidden');

    stopCameraStream();
    updateValidationUI();
  }

  function retakePhoto() {
    state.capturedImageBase64 = null;
    elements.previewBox.classList.add('hidden');
    elements.btnRetakeSelfie.classList.add('hidden');
    updateValidationUI();
    startCameraStream();
  }

  // --- Form Validation Engine ---
  function updateValidationUI() {
    const isNameValid = state.employeeName.length >= 2;
    const isIdValid = state.employeeId.length >= 2;
    const isStatusValid = state.status === 'Check In' || state.status === 'Check Out';
    const isSelfieValid = !!state.capturedImageBase64;

    updateValItem(elements.valName, isNameValid);
    updateValItem(elements.valId, isIdValid);
    updateValItem(elements.valStatus, isStatusValid);
    updateValItem(elements.valSelfie, isSelfieValid);

    const isFormValid = isNameValid && isIdValid && isStatusValid && isSelfieValid;
    elements.btnSubmitAttendance.disabled = !isFormValid || state.isSubmitting;
  }

  function updateValItem(element, isValid) {
    if (isValid) {
      element.classList.add('valid');
      element.querySelector('.val-icon').textContent = '✅';
    } else {
      element.classList.remove('valid');
      element.querySelector('.val-icon').textContent = '❌';
    }
  }

  // --- Submission Handler ---
  async function handleSubmit() {
    if (elements.btnSubmitAttendance.disabled || state.isSubmitting) return;

    state.isSubmitting = true;
    setLoadingState(true);

    const dt = formatCurrentDateTime();
    const submissionId = 'ATT-' + Date.now().toString(36).toUpperCase();

    // Local Storage check-in tracking key
    const checkInStoreKey = `checkin_${state.employeeId}_${dt.formattedDate}`;

    if (state.status === 'Check In') {
      localStorage.setItem(checkInStoreKey, JSON.stringify({
        time: dt.formattedTime,
        timestamp: dt.timestampISO
      }));
    }

    const payload = {
      submissionId: submissionId,
      employeeName: state.employeeName,
      employeeId: state.employeeId,
      status: state.status,
      date: dt.formattedDate,
      time: dt.formattedTime,
      timestamp: dt.timestampISO,
      selfieBase64: state.capturedImageBase64
    };

    try {
      if (state.isDemoMode) {
        await new Promise((res) => setTimeout(res, 1000));
        console.log('[DEMO MODE] Attendance Submitted Payload:', payload);
        
        // Calculate metrics locally for demo mode
        const demoData = calculateLocalMetrics(payload, checkInStoreKey);
        showSuccessModal(demoData);
      } else {
        const jsonString = JSON.stringify(payload);
        

        // Method 1: sendBeacon
        
await fetch(state.apiUrl, {
  method: "POST",
  headers: {
    "Content-Type": "text/plain;charset=utf-8"
  },
  body: jsonString
});

        // Calculate client-side fallback summary
        const responseData = calculateLocalMetrics(payload, checkInStoreKey);
        showSuccessModal(responseData);
      }
    } catch (err) {
      console.error('Submission error:', err);
      showAlert('Submission failed: ' + (err.message || 'Network error'), 'error');
    } finally {
      state.isSubmitting = false;
      setLoadingState(false);
    }
  }

  // --- Local Metrics Calculator (Fallback / Demo Mode) ---
  function calculateLocalMetrics(payload, checkInStoreKey) {
    const data = { ...payload };

    if (payload.status === 'Check Out') {
      const storedCheckInRaw = localStorage.getItem(checkInStoreKey);
      let checkInTime = '-';
      let diffSec = 0;

      if (storedCheckInRaw) {
        try {
          const stored = JSON.parse(storedCheckInRaw);
          checkInTime = stored.time;
          const t1 = new Date(stored.timestamp).getTime();
          const t2 = new Date(payload.timestamp).getTime();
          if (!isNaN(t1) && !isNaN(t2) && t2 > t1) {
            diffSec = Math.floor((t2 - t1) / 1000);
          } else {
            diffSec = Math.max(0, parseTimeToSeconds(payload.time) - parseTimeToSeconds(checkInTime));
          }
        } catch (e) {
          diffSec = 0;
        }
      }

      data.checkInTime = checkInTime;
      data.checkOutTime = payload.time;

      if (diffSec > 0) {
        data.workingHours = formatSecondsToHHMMSS(diffSec);

        if (diffSec < REQUIRED_SECONDS) {
          const compSec = REQUIRED_SECONDS - diffSec;
          data.compensationTime = formatSecondsToHHMMSS(compSec);
          data.overtime = '00:00:00';
          data.resultMessage = `Today's working hours are less than the required 9 hours. You need to compensate ${data.compensationTime}.`;
          data.resultType = 'warning';
        } else if (diffSec === REQUIRED_SECONDS) {
          data.compensationTime = '00:00:00';
          data.overtime = '00:00:00';
          data.resultMessage = 'Congratulations! You have completed today\'s required working hours.';
          data.resultType = 'success';
        } else {
          const overtimeSec = diffSec - REQUIRED_SECONDS;
          data.compensationTime = '00:00:00';
          data.overtime = formatSecondsToHHMMSS(overtimeSec);
          data.resultMessage = `Great job! You have completed today's work and earned ${data.overtime} overtime.`;
          data.resultType = 'success';
        }
      } else {
        data.workingHours = 'N/A';
        data.compensationTime = 'N/A';
        data.overtime = 'N/A';
        data.resultMessage = 'Check Out recorded. (Pair with today\'s Check In to view total duration).';
        data.resultType = 'info';
      }
    } else {
      data.resultMessage = 'Check In recorded successfully.';
      data.resultType = 'info';
    }

    return data;
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      elements.submitSpinner.classList.remove('hidden');
      elements.submitText.textContent = 'Submitting Record...';
      elements.btnSubmitAttendance.disabled = true;
    } else {
      elements.submitSpinner.classList.add('hidden');
      elements.submitText.textContent = 'Submit Attendance';
      updateValidationUI();
    }
  }

  // --- Success Modal & Form Reset ---
  function showSuccessModal(data) {
    elements.sumName.textContent = data.employeeName;
    elements.sumId.textContent = data.employeeId;
    elements.sumStatus.textContent = data.status;
    elements.sumStatus.className = `badge-status ${data.status.replace(' ', '-')}`;
    elements.sumTime.textContent = `${data.date} at ${data.time}`;

    // Result Banner
    if (data.resultMessage) {
      elements.resultBannerText.textContent = data.resultMessage;
      elements.resultBanner.className = `result-banner ${data.resultType || 'info'}`;
      if (data.resultType === 'warning') {
        elements.resultBannerIcon.textContent = '⚠️';
      } else if (data.resultType === 'success') {
        elements.resultBannerIcon.textContent = '🎉';
      } else {
        elements.resultBannerIcon.textContent = '✅';
      }
      elements.resultBanner.classList.remove('hidden');
    } else {
      elements.resultBanner.classList.add('hidden');
    }

    // Check Out Metrics Section
    if (data.status === 'Check Out') {
      elements.sumCheckInTime.textContent = data.checkInTime || '-';
      elements.sumCheckOutTime.textContent = data.checkOutTime || data.time || '-';
      elements.sumWorkHours.textContent = data.workingHours || '-';

      if (data.compensationTime && data.compensationTime !== '00:00:00' && data.compensationTime !== 'N/A' && data.compensationTime !== '-') {
        elements.sumCompTime.textContent = data.compensationTime;
        elements.sumCompRow.classList.remove('hidden');
      } else {
        elements.sumCompRow.classList.add('hidden');
      }

      if (data.overtime && data.overtime !== '00:00:00' && data.overtime !== 'N/A' && data.overtime !== '-') {
        elements.sumOvertime.textContent = data.overtime;
        elements.sumOvertimeRow.classList.remove('hidden');
      } else {
        elements.sumOvertimeRow.classList.add('hidden');
      }

      elements.checkOutSummaryGroup.classList.remove('hidden');
    } else {
      elements.checkOutSummaryGroup.classList.add('hidden');
    }

    showModal(elements.successModal);
  }

  function resetForm() {
    state.employeeName = '';
    state.employeeId = '';
    state.status = '';
    state.capturedImageBase64 = null;

    elements.employeeName.value = '';
    elements.employeeId.value = '';
    elements.attendanceStatus.value = '';
    elements.btnCheckIn.classList.remove('active');
    elements.btnCheckOut.classList.remove('active');

    elements.previewBox.classList.add('hidden');
    elements.cameraBox.classList.add('hidden');
    elements.btnStartCamera.classList.remove('hidden');
    elements.btnCaptureSelfie.classList.add('hidden');
    elements.btnRetakeSelfie.classList.add('hidden');

    hideAlert();
    updateValidationUI();
  }

  // --- UI Helpers ---
  function showAlert(msg, type) {
    elements.alertText.textContent = msg;
    elements.statusAlert.className = `alert ${type}`;
  }

  function hideAlert() {
    elements.statusAlert.className = 'alert hidden';
  }

  function showModal(modal) {
    modal.classList.remove('hidden');
  }

  function hideModal(modal) {
    modal.classList.add('hidden');
  }

  // --- Run on DOM Ready ---
  document.addEventListener('DOMContentLoaded', init);

})();
