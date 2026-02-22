const API_KEY = "AIzaSyCnlQSRsnPv7hi6suLQWDKeRxP2ORw_ctk";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`;

const addPhotoBtn = document.getElementById('addPhotoBtn');
const fileInput = document.getElementById('fileInput');
const imageGallery = document.getElementById('imageGallery');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultSection = document.getElementById('resultSection');
const resultBody = document.getElementById('resultBody');
const totalCaloriesContainer = document.getElementById('totalCaloriesContainer');
const totalCaloriesValue = document.getElementById('totalCaloriesValue');
const addItemBtn = document.getElementById('addItemBtn');
const brandSection = document.getElementById('brandSection');
const brandContent = document.getElementById('brandContent');
const resetBtn = document.getElementById('resetBtn');

let uploadedImages = []; // Stores objects: { mimeType, data (base64) }

// Handle Photo Selection
addPhotoBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;

        const base64Data = await fileToBase64(file);
        const imageData = {
            mimeType: file.type,
            data: base64Data.split(',')[1] // clean base64 data only
        };
        uploadedImages.push(imageData);

        // Add to UI Gallery
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        galleryItem.innerHTML = `
            <img src="${base64Data}" alt="Food Preview">
            <button class="photo-delete-btn" title="사진 삭제">✕</button>
        `;
        imageGallery.insertBefore(galleryItem, addPhotoBtn);

        // Photo Delete Logic
        const deleteBtn = galleryItem.querySelector('.photo-delete-btn');
        deleteBtn.addEventListener('click', () => {
            const index = uploadedImages.indexOf(imageData);
            if (index > -1) {
                uploadedImages.splice(index, 1);
            }
            galleryItem.remove();
            if (uploadedImages.length === 0) {
                analyzeBtn.disabled = true;
            }
        });
    }

    if (uploadedImages.length > 0) {
        analyzeBtn.disabled = false;
    }
    fileInput.value = '';
});

// Analyze Button Logic
analyzeBtn.addEventListener('click', async () => {
    if (uploadedImages.length === 0) return;

    analyzeBtn.disabled = true;
    loadingIndicator.classList.remove('hidden');
    resultSection.classList.add('hidden');
    totalCaloriesContainer.classList.add('hidden');
    brandSection.classList.add('hidden');

    try {
        const results = await analyzeImages(uploadedImages);
        displayResults(results.foods);
        displayBrandInfo(results.brands);
    } catch (error) {
        console.warn('API Analysis failed, falling back to smart simulation:', error);

        console.error('Original Error:', error.message);

        setTimeout(() => {
            const fallbackResults = simulateRecognition();
            displayResults(fallbackResults);
            alert('💡 안내: 현재 API 키 또는 네트워크 설정 문제로 인해 시뮬레이션(데모) 모드로 분석 결과를 표시합니다.');
        }, 1500);
    } finally {
        loadingIndicator.classList.add('hidden');
        analyzeBtn.disabled = false;
    }
});

// Reset Logic
resetBtn.addEventListener('click', () => {
    if (confirm('모든 사진과 분석 결과를 초기화할까요?')) {
        uploadedImages = [];
        // Remove all images except the add button
        const items = imageGallery.querySelectorAll('.gallery-item');
        items.forEach(item => item.remove());

        resultBody.innerHTML = '';
        resultSection.classList.add('hidden');
        totalCaloriesContainer.classList.add('hidden');
        brandSection.classList.add('hidden');
        analyzeBtn.disabled = true;
        fileInput.value = '';
    }
});

// Manual Item Addition
addItemBtn.addEventListener('click', () => {
    const defaultItem = { name: "", weight: "100g", calories: 0 };
    addTableRow(defaultItem);
    updateTotalCalories();
});

// Gemini API Image Analysis
async function analyzeImages(images) {
    // Softened weight estimation instructions for balanced results
    const prompt = `Identify ALL food items in these images, including branded products.
    
    1. "foods" array: MUST include EVERY identified item (including those with brands).
       For each item, provide a BALANCED and REALISTIC weight estimate (in grams or ml). 
       Carefully observe the portion size. Do not over- or underestimate. 
       Use typical restaurant or home serving sizes as a reference.
       Each object: {name, weight, calories}
    2. "brands" array: ONLY include items that have a visible brand name.
       Each object: {brandName, productName, nutritionInfo}
    
    Return the results ONLY as a valid JSON object. 
    Language: Korean for food/brand names.
    `;

    const contents = [{
        parts: [
            { text: prompt },
            ...images.map(img => ({
                inline_data: {
                    mime_type: img.mimeType,
                    data: img.data
                }
            }))
        ]
    }];

    const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: {
                response_mime_type: "application/json"
            }
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await response.json();
    const resultText = data.candidates[0].content.parts[0].text;
    return JSON.parse(resultText);
}

// Display Results in Table
function displayResults(foods) {
    resultBody.innerHTML = '';
    if (!Array.isArray(foods)) return;

    foods.forEach(item => addTableRow(item));

    updateTotalCalories();
    resultSection.classList.remove('hidden');
    totalCaloriesContainer.classList.remove('hidden');
}

// Add a single row to the results table
function addTableRow(item) {
    const safeWeight = item.weight ? String(item.weight) : "0g";
    const weightValue = parseFloat(safeWeight) || 0;
    const caloriesValue = parseInt(item.calories) || 0;
    const calPerUnit = weightValue > 0 ? caloriesValue / weightValue : 0;

    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <input type="text" class="name-input" value="${item.name || ''}" placeholder="음식 이름 입력">
        </td>
        <td>
            <div class="weight-input-container">
                <input type="number" class="weight-input" value="${weightValue}" data-cal-per-unit="${calPerUnit}">
                <span class="unit-text">${safeWeight.replace(/[0-9.]/g, '') || 'g'}</span>
            </div>
        </td>
        <td class="item-calories">${caloriesValue} kcal</td>
        <td>
            <button class="delete-btn" title="삭제">✕</button>
        </td>
    `;
    resultBody.appendChild(row);

    const weightInput = row.querySelector('.weight-input');
    const nameInput = row.querySelector('.name-input');
    const deleteBtn = row.querySelector('.delete-btn');

    weightInput.addEventListener('input', () => updateItemCalories(row));
    nameInput.addEventListener('change', () => recalculateFromName(nameInput.value, row));
    deleteBtn.addEventListener('click', () => {
        row.remove();
        updateTotalCalories();
    });
}

// Display Brand Info
function displayBrandInfo(brands) {
    brandContent.innerHTML = '';

    if (!brands || brands.length === 0) {
        brandSection.classList.add('hidden');
        return;
    }

    brands.forEach(b => {
        let nutritionText = "";
        if (typeof b.nutritionInfo === 'object' && b.nutritionInfo !== null) {
            nutritionText = Object.entries(b.nutritionInfo)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
        } else {
            nutritionText = b.nutritionInfo || "정보 없음";
        }

        const searchQuery = encodeURIComponent(`${b.brandName} ${b.productName} nutrition facts 영양성분`);
        const searchLink = `https://www.google.com/search?q=${searchQuery}`;

        const div = document.createElement('div');
        div.className = 'brand-item';
        div.innerHTML = `
            <div class="brand-header">
                <span class="brand-name">[${b.brandName}] ${b.productName}</span>
                <a href="${searchLink}" target="_blank" class="search-link">🔍 상세 정보 검색</a>
            </div>
            <p class="brand-nutrition">${nutritionText}</p>
        `;
        brandContent.appendChild(div);
    });

    brandSection.classList.remove('hidden');
}

// Recalculate based on name change
async function recalculateFromName(newName, row) {
    if (!newName.trim()) return;

    const weightInput = row.querySelector('.weight-input');
    row.style.opacity = '0.5';

    try {
        const contents = [{
            parts: [{ text: `Determine the average calories for 100g of the food "${newName}". Return ONLY the number (total calories per 100g).` }]
        }];

        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        if (response.ok) {
            const data = await response.json();
            const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "0";
            const calsPer100g = parseFloat(textResult.replace(/[^0-9.]/g, '')) || 0;
            weightInput.dataset.calPerUnit = calsPer100g / 100;
            updateItemCalories(row);
        }
    } catch (e) {
        console.warn('Name-based re-estimation failed:', e);
    } finally {
        row.style.opacity = '1';
    }
}

function updateItemCalories(row) {
    const input = row.querySelector('.weight-input');
    const calorieCell = row.querySelector('.item-calories');
    const newWeight = parseFloat(input.value) || 0;
    const calPerUnit = parseFloat(input.dataset.calPerUnit) || 0;

    const newCalories = Math.round(newWeight * calPerUnit);
    calorieCell.textContent = `${newCalories} kcal`;
    updateTotalCalories();
}

function updateTotalCalories() {
    let total = 0;
    document.querySelectorAll('.item-calories').forEach(cell => {
        total += parseInt(cell.textContent) || 0;
    });
    totalCaloriesValue.textContent = `${total} kcal`;
}

// Simulating recognition for fallback
function simulateRecognition() {
    return [
        { name: "닭가슴살 샐러드", weight: "200g", calories: 250 },
        { name: "고구마", weight: "150g", calories: 130 }
    ];
}

// Utility: File to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}
