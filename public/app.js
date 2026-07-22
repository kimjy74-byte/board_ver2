/**
 * Weekly Event Scheduler - Frontend Logic
 * Supports: Standalone client-side execution, Local Storage Auto-save, 
 *           Tesseract.js OCR, Gemini AI Vision API Parsing, CSV Import/Export.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. State Management & Variables
  // ==========================================
  let events = [];
  let currentDate = new Date(); // Represents the reference date for the current week
  let geminiApiKey = '';
  let isWidgetMode = false;
  let ocrProcessedItems = []; // Temporarily holds items scanned by OCR/AI before applying

  // ==========================================
  // 2. DOM Elements
  // ==========================================
  const appContainer = document.getElementById('appContainer');
  const btnToggleMode = document.getElementById('btnToggleMode');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const settingsModal = document.getElementById('settingsModal');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const btnResetSettings = document.getElementById('btnResetSettings');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  
  const currentWeekTitle = document.getElementById('currentWeekTitle');
  const btnPrevWeek = document.getElementById('btnPrevWeek');
  const btnNextWeek = document.getElementById('btnNextWeek');
  const btnToday = document.getElementById('btnToday');
  
  const scheduleTableBody = document.getElementById('scheduleTableBody');
  const emptySchedule = document.getElementById('emptySchedule');
  const scheduleTable = document.getElementById('scheduleTable');
  const btnAddRow = document.getElementById('btnAddRow');
  const btnClearWeek = document.getElementById('btnClearWeek');
  const btnCreateFirstEvent = document.getElementById('btnCreateFirstEvent');
  
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnImportCsv = document.getElementById('btnImportCsv');
  const csvFileInput = document.getElementById('csvFileInput');
  
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const btnSelectImage = document.getElementById('btnSelectImage');
  
  const statusCard = document.getElementById('statusCard');
  const progressBar = document.getElementById('progressBar');
  const statusLabel = document.getElementById('statusLabel');
  const progressText = document.getElementById('progressText');
  const ocrPreviewBox = document.getElementById('ocrPreviewBox');
  const rawOcrText = document.getElementById('rawOcrText');
  const btnCancelProcessing = document.getElementById('btnCancelProcessing');

  const ocrResultModal = document.getElementById('ocrResultModal');
  const btnCloseOcrModal = document.getElementById('btnCloseOcrModal');
  const btnRejectOcr = document.getElementById('btnRejectOcr');
  const btnAcceptOcr = document.getElementById('btnAcceptOcr');
  const ocrSourceImg = document.getElementById('ocrSourceImg');
  const parsedItemsCount = document.getElementById('parsedItemsCount');
  const parsedRowsContainer = document.getElementById('parsedRowsContainer');
  
  const toastContainer = document.getElementById('toastContainer');

  // ==========================================
  // 3. Init / Load Settings & Data
  // ==========================================
  function init() {
    // Load events from local storage
    const storedEvents = localStorage.getItem('weekly_events');
    if (storedEvents) {
      try {
        events = JSON.parse(storedEvents);
      } catch (e) {
        events = [];
      }
    } else {
      // Add default mock event if empty
      events = getMockData();
      saveEvents();
    }

    // Load API Key
    geminiApiKey = localStorage.getItem('gemini_api_key') || '';
    geminiApiKeyInput.value = geminiApiKey;

    // Load widget mode setting
    const savedWidgetMode = localStorage.getItem('widget_mode') === 'true';
    if (savedWidgetMode) {
      enableWidgetMode(true);
    } else {
      enableWidgetMode(false);
    }

    // Set up week representation
    renderSchedule();
  }

  // ==========================================
  // 4. Utility Date Helper Functions
  // ==========================================
  
  // Get date range of Monday to Sunday for the week of selected date
  function getWeekRange(date) {
    const d = new Date(date);
    const day = d.getDay();
    // In Korea, standard weeks usually start on Monday. Adjust day: Mon=1...Sun=7
    const diff = d.getDate() - (day === 0 ? 6 : day - 1); 
    
    const monday = new Date(d.setDate(diff));
    monday.setHours(0,0,0,0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);
    
    return { monday, sunday };
  }

  // Format date to YYYY-MM-DD
  function formatDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Get localized Day Name (Mon, Tue, etc.)
  function getDayKoreanName(dateStr) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date(dateStr);
    return days[d.getDay()];
  }

  // Get week title string e.g. "2026년 07월 4주차 (07.20 ~ 07.26)"
  function getWeekTitleText(monday, sunday) {
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    
    // Calculate week of the month
    const firstDayOfMonth = new Date(monday.getFullYear(), monday.getMonth(), 1);
    const firstMonDiff = firstDayOfMonth.getDay() === 0 ? 1 : 8 - firstDayOfMonth.getDay();
    const firstMonday = new Date(monday.getFullYear(), monday.getMonth(), firstMonDiff);
    
    let weekNum = 1;
    if (monday >= firstMonday) {
      weekNum = Math.ceil(((monday - firstMonday) / (24 * 3600 * 1000) + 1) / 7) + 1;
    }
    
    const mStr = String(monday.getMonth() + 1).padStart(2, '0');
    const mDate = String(monday.getDate()).padStart(2, '0');
    const sStr = String(sunday.getMonth() + 1).padStart(2, '0');
    const sDate = String(sunday.getDate()).padStart(2, '0');
    
    return `${year}년 ${month}월 ${weekNum}주차 <span class="week-range-text">(${mStr}.${mDate} ~ ${sStr}.${sDate})</span>`;
  }

  // Mock data for fresh experience
  function getMockData() {
    const today = new Date();
    const { monday } = getWeekRange(today);
    
    const mon = new Date(monday);
    const wed = new Date(monday); wed.setDate(monday.getDate() + 2);
    const fri = new Date(monday); fri.setDate(monday.getDate() + 4);
    
    return [
      {
        id: 'mock-1',
        date: formatDateString(mon),
        time: '09:00',
        title: '주간 경영회의',
        location: '대회의실 (5F)',
        vip: '대표이사, 본부장단',
        dept: '기획조정실',
        memo: '업무 보고자료 사전 취합 요망',
        completed: false
      },
      {
        id: 'mock-2',
        date: formatDateString(wed),
        time: '14:00',
        title: '신규 프로젝트 디자인 검토회',
        location: '크리에이티브룸',
        vip: 'UIUX 디자인팀 전원',
        dept: '프론트엔드개발본부',
        memo: '피그마 시안 프로토타입 준비',
        completed: true
      },
      {
        id: 'mock-3',
        date: formatDateString(fri),
        time: '16:30',
        title: '파트너사 제휴 MOU 체결식',
        location: '중회의실',
        vip: '부사장, 파트너사 임원진',
        dept: '대외협력팀',
        memo: '다과 및 명패 세팅 체크',
        completed: false
      }
    ];
  }

  // Save events to local storage
  function saveEvents() {
    localStorage.setItem('weekly_events', JSON.stringify(events));
  }

  // ==========================================
  // 5. Rendering Operations
  // ==========================================
  function renderSchedule() {
    const { monday, sunday } = getWeekRange(currentDate);
    currentWeekTitle.innerHTML = getWeekTitleText(monday, sunday);

    // Filter events belonging to current week
    const monStr = formatDateString(monday);
    const sunStr = formatDateString(sunday);
    
    const weekEvents = events.filter(e => e.date >= monStr && e.date <= sunStr);
    
    // Sort by Date, then by Time
    weekEvents.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

    scheduleTableBody.innerHTML = '';

    if (weekEvents.length === 0) {
      emptySchedule.style.display = 'flex';
      scheduleTable.style.display = 'none';
      return;
    }

    emptySchedule.style.display = 'none';
    scheduleTable.style.display = 'table';

    // Generates dropdown options for dates of this week
    let dateOptionsHtml = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const val = formatDateString(d);
      const label = `${d.getMonth() + 1}/${d.getDate()} (${getDayKoreanName(val)})`;
      dateOptionsHtml += `<option value="${val}">${label}</option>`;
    }

    weekEvents.forEach(item => {
      const tr = document.createElement('tr');
      tr.id = `row-${item.id}`;
      if (item.completed) {
        tr.classList.add('row-completed');
      }

      tr.innerHTML = `
        <td>
          <div class="day-select-wrapper">
            <select class="field-date" data-id="${item.id}">
              ${dateOptionsHtml}
            </select>
          </div>
        </td>
        <td>
          <input type="time" class="field-time" value="${item.time || '09:00'}" data-id="${item.id}">
        </td>
        <td>
          <input type="text" class="field-title" value="${escapeHtml(item.title)}" placeholder="행사명 입력" data-id="${item.id}">
        </td>
        <td>
          <input type="text" class="field-location" value="${escapeHtml(item.location)}" placeholder="장소" data-id="${item.id}">
        </td>
        <td>
          <input type="text" class="field-vip" value="${escapeHtml(item.vip)}" placeholder="참석자" data-id="${item.id}">
        </td>
        <td>
          <input type="text" class="field-dept" value="${escapeHtml(item.dept)}" placeholder="주관팀" data-id="${item.id}">
        </td>
        <td>
          <div class="memo-cell">
            <input type="checkbox" class="field-completed" ${item.completed ? 'checked' : ''} data-id="${item.id}">
            <input type="text" class="field-memo" value="${escapeHtml(item.memo)}" placeholder="메모 입력" data-id="${item.id}">
            <button class="btn-delete-row" data-id="${item.id}" title="삭제"><i class="fa-regular fa-trash-can"></i></button>
          </div>
        </td>
      `;

      // Set the select element to correct date value
      const selectEl = tr.querySelector('.field-date');
      selectEl.value = item.date;

      // Event Listeners for inline updates
      tr.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', (e) => {
          updateEventField(item.id, e.target);
        });
      });

      // Special check for checkbox to apply cross-out styling instantly
      const chk = tr.querySelector('.field-completed');
      chk.addEventListener('change', (e) => {
        const row = document.getElementById(`row-${item.id}`);
        if (e.target.checked) {
          row.classList.add('row-completed');
        } else {
          row.classList.remove('row-completed');
        }
      });

      // Delete Row Button
      tr.querySelector('.btn-delete-row').addEventListener('click', () => {
        deleteEvent(item.id);
      });

      scheduleTableBody.appendChild(tr);
    });
  }

  // Update specific field in local state and save
  function updateEventField(id, target) {
    const idx = events.findIndex(e => e.id === id);
    if (idx === -1) return;

    if (target.classList.contains('field-date')) {
      events[idx].date = target.value;
    } else if (target.classList.contains('field-time')) {
      events[idx].time = target.value;
    } else if (target.classList.contains('field-title')) {
      events[idx].title = target.value;
    } else if (target.classList.contains('field-location')) {
      events[idx].location = target.value;
    } else if (target.classList.contains('field-vip')) {
      events[idx].vip = target.value;
    } else if (target.classList.contains('field-dept')) {
      events[idx].dept = target.value;
    } else if (target.classList.contains('field-memo')) {
      events[idx].memo = target.value;
    } else if (target.classList.contains('field-completed')) {
      events[idx].completed = target.checked;
    }

    saveEvents();
  }

  // Add row
  function addNewRow() {
    const { monday } = getWeekRange(currentDate);
    const defaultDate = formatDateString(monday); // Default to Monday of current week

    const newEvent = {
      id: 'evt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: defaultDate,
      time: '09:00',
      title: '',
      location: '',
      vip: '',
      dept: '',
      memo: '',
      completed: false
    };

    events.push(newEvent);
    saveEvents();
    renderSchedule();
    
    // Highlight and focus the new title input
    setTimeout(() => {
      const row = document.getElementById(`row-${newEvent.id}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const input = row.querySelector('.field-title');
        if (input) input.focus();
      }
    }, 50);

    showToast('새 일정 행이 추가되었습니다.', 'success');
  }

  // Delete event
  function deleteEvent(id) {
    events = events.filter(e => e.id !== id);
    saveEvents();
    renderSchedule();
    showToast('일정이 삭제되었습니다.', 'info');
  }

  // Clear this week's events
  function clearCurrentWeek() {
    if (confirm('이번 주에 등록된 모든 일정을 정말 삭제하시겠습니까?')) {
      const { monday, sunday } = getWeekRange(currentDate);
      const monStr = formatDateString(monday);
      const sunStr = formatDateString(sunday);
      
      events = events.filter(e => e.date < monStr || e.date > sunStr);
      saveEvents();
      renderSchedule();
      showToast('이번 주 일정이 초기화되었습니다.', 'info');
    }
  }

  // Escape HTML utility to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ==========================================
  // 6. Navigation Actions
  // ==========================================
  btnPrevWeek.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 7);
    renderSchedule();
  });

  btnNextWeek.addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 7);
    renderSchedule();
  });

  btnToday.addEventListener('click', () => {
    currentDate = new Date();
    renderSchedule();
  });

  btnAddRow.addEventListener('click', addNewRow);
  btnCreateFirstEvent.addEventListener('click', addNewRow);
  btnClearWeek.addEventListener('click', clearCurrentWeek);

  // ==========================================
  // 7. Widget Mode Toggle
  // ==========================================
  function enableWidgetMode(enable) {
    isWidgetMode = enable;
    if (isWidgetMode) {
      document.body.className = 'widget-mode';
      btnToggleMode.innerHTML = '<i class="fa-solid fa-desktop"></i> <span class="btn-text">대시보드 모드</span>';
      localStorage.setItem('widget_mode', 'true');
    } else {
      document.body.className = 'dashboard-mode';
      btnToggleMode.innerHTML = '<i class="fa-solid fa-table-cells-large"></i> <span class="btn-text">위젯 모드</span>';
      localStorage.setItem('widget_mode', 'false');
    }
    // Rerender layout
    renderSchedule();
  }

  btnToggleMode.addEventListener('click', () => {
    enableWidgetMode(!isWidgetMode);
    showToast(`화면을 ${isWidgetMode ? '위젯 모드' : '대시보드 모드'}로 전환했습니다.`, 'success');
  });

  // ==========================================
  // 8. Settings Modal Operations
  // ==========================================
  btnOpenSettings.addEventListener('click', () => {
    geminiApiKeyInput.value = localStorage.getItem('gemini_api_key') || '';
    settingsModal.classList.add('active');
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  btnSaveSettings.addEventListener('click', () => {
    const key = geminiApiKeyInput.value.trim();
    geminiApiKey = key;
    localStorage.setItem('gemini_api_key', key);
    settingsModal.classList.remove('active');
    showToast('설정이 안전하게 저장되었습니다.', 'success');
  });

  btnResetSettings.addEventListener('click', () => {
    if (confirm('모든 설정(API Key 포함)을 초기화하시겠습니까?')) {
      localStorage.removeItem('gemini_api_key');
      geminiApiKey = '';
      geminiApiKeyInput.value = '';
      showToast('설정이 초기화되었습니다.', 'info');
    }
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('active');
    }
  });

  // ==========================================
  // 9. OCR / AI Image Parse Engine
  // ==========================================
  
  // Drag & drop events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      handleUploadedImage(files[0]);
    }
  });

  btnSelectImage.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleUploadedImage(e.target.files[0]);
    }
  });

  let activeWorker = null;

  btnCancelProcessing.addEventListener('click', () => {
    if (activeWorker) {
      activeWorker.terminate();
      activeWorker = null;
    }
    statusCard.style.display = 'none';
    showToast('파싱 작업이 취소되었습니다.', 'info');
  });

  function handleUploadedImage(file) {
    if (!file.type.startsWith('image/')) {
      showToast('이미지 파일(PNG, JPG)만 등록할 수 있습니다.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      
      // Update OCR Preview Image in Modal
      ocrSourceImg.src = base64Data;
      
      statusCard.style.display = 'block';
      progressBar.style.width = '0%';
      progressText.textContent = '0%';
      ocrPreviewBox.style.display = 'none';
      rawOcrText.value = '';

      if (geminiApiKey) {
        // Run advanced AI parsing via Gemini API
        statusLabel.textContent = 'Gemini AI 분석 기동 중...';
        await runGeminiVisionParse(base64Data);
      } else {
        // Run fallback local Tesseract OCR
        statusLabel.textContent = '로컬 OCR 엔진 초기화 중...';
        await runLocalTesseractOcr(file);
      }
    };
    reader.readAsDataURL(file);
  }

  // Call Gemini Vision API
  async function runGeminiVisionParse(base64ImageUri) {
    try {
      progressBar.style.width = '30%';
      progressText.textContent = '30%';
      statusLabel.textContent = '이미지를 분석하는 중 (Gemini)...';

      const base64Clean = base64ImageUri.split(',')[1];
      const mimeType = base64ImageUri.split(',')[0].split(':')[1].split(';')[0];
      
      const { monday } = getWeekRange(currentDate);
      const currentYearStr = currentDate.getFullYear();
      
      const promptText = `
이 이미지 속 주간 일정표/행사표 문서에서 일정을 정밀 추출하여 유효한 JSON 배열 형식으로만 응답해줘. 
각 항목에 대해 아래 JSON 스키마를 엄격히 준수할 것.

스키마:
[
  {
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "title": "행사명",
    "location": "행사장소",
    "vip": "참석자/VIP",
    "dept": "주관부서/팀",
    "memo": "메모"
  }
]

참고사항:
1. 올해 년도는 ${currentYearStr}년이다. 날짜 추출 시 연도와 월을 참고해 반드시 YYYY-MM-DD 형식으로 매칭해라.
2. 시간은 24시간 표기법(HH:MM)을 지킬 것. 예: "오후 2시" -> "14:00". 시간 정보가 없다면 "09:00"으로 채워라.
3. 정보가 부족한 필드는 빈 문자열("")로 설정해라.
4. 마크다운 백틱(\`\`\`)을 포함하지 않는 순수한 JSON 배열 포맷 문자열로 답변해라.
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Clean
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      progressBar.style.width = '80%';
      progressText.textContent = '80%';

      if (!response.ok) {
        throw new Error(`Gemini API Error: Status ${response.status}`);
      }

      const resJson = await response.json();
      const contentText = resJson.contents[0].parts[0].text;
      
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      statusCard.style.display = 'none';

      // Parse AI output
      try {
        const parsed = JSON.parse(contentText);
        if (Array.isArray(parsed)) {
          openOcrResultReview(parsed);
        } else {
          throw new Error('Gemini did not return an array');
        }
      } catch (err) {
        console.error('JSON Parse error from Gemini:', contentText, err);
        showToast('AI가 보낸 데이터를 파싱하는 데 실패했습니다. 원본 글을 분석합니다.', 'error');
        // Fallback to text area showing
        statusCard.style.display = 'block';
        ocrPreviewBox.style.display = 'block';
        rawOcrText.value = contentText;
      }

    } catch (e) {
      console.error(e);
      showToast('Gemini API 호출에 실패했습니다. API 키나 인터넷 연결을 확인하세요.', 'error');
      statusCard.style.display = 'none';
    }
  }

  // Call local Tesseract.js
  async function runLocalTesseractOcr(imageFile) {
    try {
      // Initialize worker with Korean and English support
      const worker = await Tesseract.createWorker('kor+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            const percent = Math.round(m.progress * 100);
            progressBar.style.width = percent + '%';
            progressText.textContent = percent + '%';
            statusLabel.textContent = '한글/영문 텍스트 인식 중...';
          }
        }
      });
      
      activeWorker = worker;

      const ret = await worker.recognize(imageFile);
      const text = ret.data.text;
      
      rawOcrText.value = text;
      ocrPreviewBox.style.display = 'block';
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      statusLabel.textContent = '텍스트 추출 완료!';
      
      await worker.terminate();
      activeWorker = null;

      // Match Regex to parse
      const parsedItems = runRegexSmartParser(text);
      
      setTimeout(() => {
        statusCard.style.display = 'none';
        if (parsedItems.length > 0) {
          openOcrResultReview(parsedItems);
        } else {
          showToast('텍스트는 추출되었으나, 유효한 일정을 자동 매칭하지 못했습니다. 원본 텍스트를 복사해 사용해 주세요.', 'warning');
        }
      }, 800);

    } catch (err) {
      console.error(err);
      showToast('로컬 OCR 분석 중 오류가 발생했습니다.', 'error');
      statusCard.style.display = 'none';
      activeWorker = null;
    }
  }

  // Simple RegEx parsing rules for local OCR fallback
  function runRegexSmartParser(rawText) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedList = [];
    const { monday } = getWeekRange(currentDate);

    // RegEx patterns
    // Matches: 7/23, 7.23, 7월 23일, 23일
    const datePattern = /(?:(\d{1,2})[/\-.월]\s*)?(\d{1,2})(?:일)?/;
    // Matches: 14:00, 14시 30분, 오후 2시, 오전 9:30
    const timePattern = /(?:(오전|오후)\s*)?(\d{1,2})(?:\s*[:시]\s*(\d{2})?)/;

    lines.forEach(line => {
      // We try to match date and time in each line
      let matchedDateStr = formatDateString(monday); // default to Mon
      let matchedTimeStr = '09:00';
      
      // Look for date indicators in the line
      const dateMatch = line.match(datePattern);
      if (dateMatch) {
        let month = dateMatch[1] ? parseInt(dateMatch[1]) : (monday.getMonth() + 1);
        let dateVal = parseInt(dateMatch[2]);
        
        // Safety range checks
        if (dateVal >= 1 && dateVal <= 31 && month >= 1 && month <= 12) {
          const tempDate = new Date(currentDate.getFullYear(), month - 1, dateVal);
          matchedDateStr = formatDateString(tempDate);
        }
      }

      // Look for time
      const timeMatch = line.match(timePattern);
      if (timeMatch) {
        let hour = parseInt(timeMatch[2]);
        let min = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
        const isPm = timeMatch[1] === '오후';
        
        if (isPm && hour < 12) hour += 12;
        if (!isPm && hour === 12) hour = 0;
        
        if (hour >= 0 && hour < 24 && min >= 0 && min < 60) {
          matchedTimeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        }
      }

      // Cleanup parsed text to deduce Title & Location
      let cleaned = line
        .replace(datePattern, '')
        .replace(timePattern, '')
        .replace(/^[주간행사일정표\-:|★✦✦■●]/g, '')
        .trim();

      if (cleaned.length > 3) {
        // Split by typical separators like spaces, tabs, slashes
        const parts = cleaned.split(/\s{2,}|\t|\s*\|\s*/);
        
        let title = parts[0] || '행사 일정';
        let location = parts[1] || '';
        let vip = parts[2] || '';
        let dept = parts[3] || '';
        let memo = parts[4] || '';

        // Add items if we have a reasonable title
        if (title.trim().length > 1) {
          parsedList.push({
            date: matchedDateStr,
            time: matchedTimeStr,
            title: title.trim(),
            location: location.trim(),
            vip: vip.trim(),
            dept: dept.trim(),
            memo: memo.trim()
          });
        }
      }
    });

    return parsedList;
  }

  // Open review editor modal
  function openOcrResultReview(parsedItems) {
    ocrProcessedItems = parsedItems.map((item, idx) => ({
      ...item,
      id: 'ocr-' + idx + '-' + Date.now()
    }));

    parsedItemsCount.textContent = ocrProcessedItems.length;
    parsedRowsContainer.innerHTML = '';

    // Set up dropdown date choices for the week
    const { monday } = getWeekRange(currentDate);
    let dateOptions = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const val = formatDateString(d);
      const label = `${d.getMonth() + 1}/${d.getDate()} (${getDayKoreanName(val)})`;
      dateOptions += `<option value="${val}">${label}</option>`;
    }

    ocrProcessedItems.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'parsed-item-card';
      card.id = `parsed-card-${item.id}`;

      card.innerHTML = `
        <button class="btn-remove-parsed" data-id="${item.id}" title="제거"><i class="fa-solid fa-xmark"></i></button>
        <div class="card-row-top">
          <select class="p-date" data-id="${item.id}">
            ${dateOptions}
          </select>
          <input type="time" class="p-time" value="${item.time || '09:00'}" data-id="${item.id}">
        </div>
        <div class="card-row-mid">
          <input type="text" class="p-title" value="${escapeHtml(item.title)}" placeholder="행사명" data-id="${item.id}">
          <input type="text" class="p-location" value="${escapeHtml(item.location)}" placeholder="행사장소" data-id="${item.id}">
        </div>
        <div class="card-row-bottom">
          <input type="text" class="p-vip" value="${escapeHtml(item.vip)}" placeholder="VIP (참석자)" data-id="${item.id}">
          <input type="text" class="p-dept" value="${escapeHtml(item.dept)}" placeholder="주관팀" data-id="${item.id}">
        </div>
        <input type="text" class="p-memo" value="${escapeHtml(item.memo)}" placeholder="메모" data-id="${item.id}">
      `;

      // Pre-select dates in the dropdown (if matched date is inside current week, else default to Mon)
      const selectDate = card.querySelector('.p-date');
      // If the parsed date string is inside the dropdown values, pre-select it
      const optionExists = Array.from(selectDate.options).some(opt => opt.value === item.date);
      if (optionExists) {
        selectDate.value = item.date;
      } else {
        // If date is outside current week, append it as a temporary option so data isn't lost
        const dObj = new Date(item.date);
        if (!isNaN(dObj.getTime())) {
          const opt = document.createElement('option');
          opt.value = item.date;
          opt.textContent = `${dObj.getMonth()+1}/${dObj.getDate()} (${getDayKoreanName(item.date)}*)`;
          selectDate.appendChild(opt);
          selectDate.value = item.date;
        } else {
          selectDate.value = formatDateString(monday);
        }
      }

      // Add inline edit listeners for parsed cards
      card.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', (e) => {
          const itemIdx = ocrProcessedItems.findIndex(x => x.id === item.id);
          if (itemIdx === -1) return;
          
          const val = e.target.value;
          if (e.target.classList.contains('p-date')) ocrProcessedItems[itemIdx].date = val;
          if (e.target.classList.contains('p-time')) ocrProcessedItems[itemIdx].time = val;
          if (e.target.classList.contains('p-title')) ocrProcessedItems[itemIdx].title = val;
          if (e.target.classList.contains('p-location')) ocrProcessedItems[itemIdx].location = val;
          if (e.target.classList.contains('p-vip')) ocrProcessedItems[itemIdx].vip = val;
          if (e.target.classList.contains('p-dept')) ocrProcessedItems[itemIdx].dept = val;
          if (e.target.classList.contains('p-memo')) ocrProcessedItems[itemIdx].memo = val;
        });
      });

      // Remove single card button
      card.querySelector('.btn-remove-parsed').addEventListener('click', () => {
        ocrProcessedItems = ocrProcessedItems.filter(x => x.id !== item.id);
        card.remove();
        parsedItemsCount.textContent = ocrProcessedItems.length;
        if (ocrProcessedItems.length === 0) {
          ocrResultModal.classList.remove('active');
          showToast('추출 목록이 비어 작업을 종료합니다.', 'info');
        }
      });

      parsedRowsContainer.appendChild(card);
    });

    ocrResultModal.classList.add('active');
  }

  // Modal Actions
  btnCloseOcrModal.addEventListener('click', () => {
    ocrResultModal.classList.remove('active');
  });

  btnRejectOcr.addEventListener('click', () => {
    ocrResultModal.classList.remove('active');
    showToast('AI 일정이 반려되었습니다.', 'info');
  });

  btnAcceptOcr.addEventListener('click', () => {
    if (ocrProcessedItems.length > 0) {
      // Merge items into global schedule
      ocrProcessedItems.forEach(item => {
        events.push({
          id: 'evt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          date: item.date,
          time: item.time || '09:00',
          title: item.title || '새 일정',
          location: item.location || '',
          vip: item.vip || '',
          dept: item.dept || '',
          memo: item.memo || '',
          completed: false
        });
      });

      saveEvents();
      renderSchedule();
      ocrResultModal.classList.remove('active');
      showToast(`총 ${ocrProcessedItems.length}건의 일정이 추가되었습니다.`, 'success');
    }
  });

  // ==========================================
  // 10. CSV Export & Import Features
  // ==========================================
  
  // Export CSV (Excel compatible with UTF-8 BOM)
  btnExportCsv.addEventListener('click', () => {
    const { monday, sunday } = getWeekRange(currentDate);
    const monStr = formatDateString(monday);
    const sunStr = formatDateString(sunday);
    
    // Select events of current week
    const weekEvents = events.filter(e => e.date >= monStr && e.date <= sunStr);
    
    if (weekEvents.length === 0) {
      showToast('내보낼 일정이 이번 주에 없습니다.', 'warning');
      return;
    }

    weekEvents.sort((a,b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

    // Headers
    const headers = ['일자(요일)', '시간', '행사명', '행사장소', 'VIP(참석자)', '주관팀', '메모', '완료여부'];
    
    // Rows mapping
    const rows = weekEvents.map(e => [
      `${e.date} (${getDayKoreanName(e.date)})`,
      e.time,
      e.title,
      e.location,
      e.vip,
      e.dept,
      e.memo,
      e.completed ? '완료' : '대기'
    ]);

    // Build CSV string with quotes to handle commas safely
    let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';
    rows.forEach(r => {
      csvContent += r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',') + '\n';
    });

    // UTF-8 BOM
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    // Calculate week of month for filename
    const firstMon = new Date(monday.getFullYear(), monday.getMonth(), 1);
    const weekNum = Math.ceil((monday.getDate() + (firstMon.getDay() === 0 ? 6 : firstMon.getDay() - 1)) / 7);
    
    link.download = `주간일정_${year}년_${month}월_${weekNum}주차.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('일정 엑셀 백업(CSV) 파일이 다운로드되었습니다.', 'success');
  });

  // Import CSV Trigger
  btnImportCsv.addEventListener('click', () => {
    csvFileInput.click();
  });

  csvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importCsvFile(e.target.files[0]);
    }
  });

  function importCsvFile(file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      
      try {
        const parsedEvents = parseCsvText(text);
        if (parsedEvents.length === 0) {
          showToast('불러온 CSV 파일에 유효한 일정 데이터가 없습니다.', 'error');
          return;
        }

        // Merge imported events
        let count = 0;
        parsedEvents.forEach(p => {
          // If identical date/time/title already exists, skip to prevent duplicates
          const exists = events.some(e => e.date === p.date && e.time === p.time && e.title === p.title);
          if (!exists) {
            events.push({
              id: 'evt-csv-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
              ...p
            });
            count++;
          }
        });

        if (count > 0) {
          saveEvents();
          renderSchedule();
          showToast(`CSV로부터 ${count}개의 새 일정이 추가되었습니다.`, 'success');
        } else {
          showToast('중복되거나 유효하지 않은 일정을 제외하여 가져온 데이터가 없습니다.', 'info');
        }
      } catch (err) {
        console.error(err);
        showToast('CSV 파일을 읽는 중 오류가 발생했습니다. 규격을 확인하세요.', 'error');
      }
      
      csvFileInput.value = ''; // clear input
    };
    reader.readAsText(file, 'utf-8');
  }

  // Parse CSV Line by Line (Supporting Escaped Quotes)
  function parseCsvText(text) {
    // Remove BOM if present
    if (text.startsWith('\uFEFF')) {
      text = text.substring(1);
    }

    const lines = [];
    let row = [""];
    let inQuotes = false;

    // Custom robust CSV tokenizer
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i+1];
      
      if (inQuotes) {
        if (c === '"') {
          if (next === '"') {
            row[row.length - 1] += '"'; // escaped quote
            i++;
          } else {
            inQuotes = false; // end of quoted block
          }
        } else {
          row[row.length - 1] += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          row.push("");
        } else if (c === '\n' || c === '\r') {
          if (c === '\r' && next === '\n') {
            i++;
          }
          lines.push(row);
          row = [""];
        } else {
          row[row.length - 1] += c;
        }
      }
    }
    
    // push last row if exists
    if (row.length > 1 || row[0] !== "") {
      lines.push(row);
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map(h => h.trim());
    const parsedData = [];

    // Map headers to properties
    for (let i = 1; i < lines.length; i++) {
      const dataRow = lines[i];
      if (dataRow.length < 2) continue; // Skip blank lines

      let rawDate = dataRow[0] || '';
      let time = dataRow[1] || '09:00';
      let title = dataRow[2] || '';
      let location = dataRow[3] || '';
      let vip = dataRow[4] || '';
      let dept = dataRow[5] || '';
      let memo = dataRow[6] || '';
      let completedStr = dataRow[7] || '대기';

      if (!title) continue; // title is mandatory

      // Clean date (remove weekday string like (월) or (Mon))
      let cleanDate = rawDate.replace(/\s*\(.+?\)\s*/, '').trim();
      // Ensure date matches YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(cleanDate)) {
        // Fallback default date
        cleanDate = formatDateString(new Date());
      }

      parsedData.push({
        date: cleanDate,
        time: time.trim() || '09:00',
        title: title.trim(),
        location: location.trim(),
        vip: vip.trim(),
        dept: dept.trim(),
        memo: memo.trim(),
        completed: completedStr.trim() === '완료'
      });
    }

    return parsedData;
  }

  // ==========================================
  // 11. Toast System
  // ==========================================
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Boot UI
  init();
});
