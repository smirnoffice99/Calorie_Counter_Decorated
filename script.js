// Cloudflare Functions Proxy Endpoints
const API_ENDPOINTS = {
    ANALYZE: "/api/analyze",
    RECALCULATE: "/api/recalculate"
};

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
let lastBrands = []; // Stores the last analyzed brands for bilingual toggling

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
            <button class="photo-delete-btn" title="${i18n[currentLang].deletePhoto}">✕</button>
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

        // Merge brand items into foods if they have calorie/nutrition info
        const allFoods = [...(results.foods || [])];
        if (results.brands && Array.isArray(results.brands)) {
            results.brands.forEach(brand => {
                // Only add if not already in foods (simple name match check)
                const brandItemNameKo = `[${brand.brandNameKo || brand.brandName}] ${brand.productNameKo || brand.productName}`;
                const brandItemNameEn = `[${brand.brandNameEn || brand.brandName}] ${brand.productNameEn || brand.productName}`;
                if (!allFoods.some(f => f.nameKo === brandItemNameKo || f.name === brandItemNameKo)) {
                    allFoods.push({
                        nameKo: brandItemNameKo,
                        nameEn: brandItemNameEn,
                        name: brandItemNameKo, // Fallback
                        weight: brand.weight || "100g",
                        calories: brand.calories || 0,
                        carbs: brand.carbs || 0,
                        protein: brand.protein || 0,
                        fat: brand.fat || 0
                    });
                }
            });
        }

        displayResults(allFoods);
        lastBrands = results.brands || [];
        displayBrandInfo(lastBrands);
    } catch (error) {
        console.warn('API Analysis failed, falling back to smart simulation:', error);

        console.error('Original Error:', error.message);

        setTimeout(() => {
            const fallbackResults = simulateRecognition();
            displayResults(fallbackResults);
            alert(i18n[currentLang].alertSimulate);
        }, 1500);
    } finally {
        loadingIndicator.classList.add('hidden');
        analyzeBtn.disabled = false;
    }
});

// Reset Logic
resetBtn.addEventListener('click', () => {
    if (confirm(i18n[currentLang].confirmReset)) {
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
        lastBrands = [];
    }
});

let currentLang = 'ko';

const i18n = {
    ko: {
        subtitle: "음식 사진을 찍어 영양소를 즉시 확인하세요",
        importPhoto: "사진 가져오기",
        importHint: "(카메라/갤러리)",
        analyzeBtn: "분석 및 칼로리 계산하기",
        resetBtn: "새로고침",
        analyzing: "AI가 분석 중입니다...",
        searchResults: "검색 결과",
        foodName: "음식 이름",
        estWeight: "추정 무게",
        addItemBtn: "+ 직접 항목 추가",
        brandNutrition: "브랜드 영양 정보",
        totalLabel: "총 ",
        nutritionTypes: { calories: '칼로리', carbs: '탄수화물', protein: '단백질', fat: '지방' },
        alertSimulate: "💡 안내: 현재 API 키 또는 네트워크 설정 문제로 인해 시뮬레이션(데모) 모드로 분석 결과를 표시합니다.",
        confirmReset: "모든 사진과 분석 결과를 초기화할까요?",
        namePlaceholder: "음식 이름 입력",
        searchDetail: "🔍 상세 정보 검색",
        infoNone: "정보 없음",
        promptLang: "Korean",
        deletePhoto: "사진 삭제",
        deleteItem: "삭제",
        toggleTooltip: "클릭하여 영양성분 전환",
        resetAllTooltip: "모두 초기화"
    },
    en: {
        subtitle: "Instantly check macros by taking a food photo",
        importPhoto: "Import Photo",
        importHint: "(Camera/Gallery)",
        analyzeBtn: "Analyze & Calculate Macros",
        resetBtn: "Reset",
        analyzing: "AI is analyzing...",
        searchResults: "Search Results",
        foodName: "Food Name",
        estWeight: "Est. Weight",
        addItemBtn: "+ Add Item Manually",
        brandNutrition: "Brand Nutrition Info",
        totalLabel: "Total ",
        nutritionTypes: { calories: 'Calories', carbs: 'Carbs', protein: 'Protein', fat: 'Fat' },
        alertSimulate: "💡 Note: Displaying simulated results due to API or network issues.",
        confirmReset: "Are you sure you want to reset all photos and results?",
        namePlaceholder: "Enter food name",
        searchDetail: "🔍 Search Details",
        infoNone: "No info",
        promptLang: "English",
        deletePhoto: "Delete Photo",
        deleteItem: "Delete",
        toggleTooltip: "Click to toggle nutrition",
        resetAllTooltip: "Reset All"
    }
};

// Nutritional Info Toggle State (mimicking React useState)
const NUTRITION_TYPES = [
    { label: '칼로리', unit: 'kcal', key: 'calories' },
    { label: '탄수화물', unit: 'g', key: 'carbs' },
    { label: '단백질', unit: 'g', key: 'protein' },
    { label: '지방', unit: 'g', key: 'fat' }
];
let currentNutritionIndex = 0;

function updateLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[currentLang][key]) {
            el.textContent = i18n[currentLang][key];
        }
    });

    NUTRITION_TYPES[0].label = i18n[currentLang].nutritionTypes.calories;
    NUTRITION_TYPES[1].label = i18n[currentLang].nutritionTypes.carbs;
    NUTRITION_TYPES[2].label = i18n[currentLang].nutritionTypes.protein;
    NUTRITION_TYPES[3].label = i18n[currentLang].nutritionTypes.fat;

    updateNutritionUI();

    const resetBtnEl = document.getElementById('resetBtn');
    if (resetBtnEl) resetBtnEl.title = i18n[currentLang].resetAllTooltip;

    const nutritionHeader = document.getElementById('nutritionToggleHeader');
    if (nutritionHeader) nutritionHeader.title = i18n[currentLang].toggleTooltip;

    document.querySelectorAll('.name-input').forEach(input => {
        input.placeholder = i18n[currentLang].namePlaceholder;
    });

    document.querySelectorAll('.search-link').forEach(link => {
        link.textContent = i18n[currentLang].searchDetail;
    });

    document.querySelectorAll('.photo-delete-btn').forEach(btn => {
        btn.title = i18n[currentLang].deletePhoto;
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.title = i18n[currentLang].deleteItem;
    });

    const langBtn = document.getElementById('langToggle');
    if (langBtn) {
        langBtn.textContent = currentLang === 'ko' ? 'ENG' : '한국어';
    }

    // Update dynamic food names in the table
    document.querySelectorAll('#resultBody tr').forEach(row => {
        const nameInput = row.querySelector('.name-input');
        if (nameInput) {
            nameInput.value = currentLang === 'ko' ? (row.dataset.nameKo || '') : (row.dataset.nameEn || '');
        }
    });

    // Re-render brand info if available
    if (typeof lastBrands !== 'undefined' && lastBrands.length > 0) {
        displayBrandInfo(lastBrands);
    }
}

// Add event listener to the table header label
document.addEventListener('DOMContentLoaded', () => {
    const nutritionHeader = document.querySelector('th:nth-child(3)');
    if (nutritionHeader) {
        nutritionHeader.id = 'nutritionToggleHeader';
        nutritionHeader.style.cursor = 'pointer';
        nutritionHeader.title = '클릭하여 영양성분 전환';
        nutritionHeader.addEventListener('click', toggleNutritionDisplay);
    }

    const langBtn = document.getElementById('langToggle');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            // Save any active input before switching
            if (document.activeElement && document.activeElement.classList.contains('name-input')) {
                document.activeElement.blur();
            }
            currentLang = currentLang === 'ko' ? 'en' : 'ko';
            updateLanguage();
        });
    }

    // Initialize display with default language text
    updateLanguage();
});

function toggleNutritionDisplay() {
    currentNutritionIndex = (currentNutritionIndex + 1) % NUTRITION_TYPES.length;
    updateNutritionUI();
}

function updateNutritionUI() {
    const config = NUTRITION_TYPES[currentNutritionIndex];

    // Update Header
    const header = document.getElementById('nutritionToggleHeader');
    if (header) {
        header.innerHTML = `${config.label} <span class="toggle-indicator">🔄</span>`;
        header.classList.remove('fade-in');
        void header.offsetWidth; // trigger reflow
        header.classList.add('fade-in');
    }

    // Update Table Rows
    const rows = resultBody.querySelectorAll('tr');
    rows.forEach(row => {
        const calorieCell = row.querySelector('.item-calories');
        if (calorieCell) {
            const data = JSON.parse(row.dataset.nutrition || '{}');
            const value = data[config.key] || 0;

            // Calculate adjusted value based on weight if needed
            const weightInput = row.querySelector('.weight-input');
            const currentWeight = parseFloat(weightInput.value) || 0;
            const originalWeight = parseFloat(row.dataset.originalWeight) || currentWeight || 1;

            const adjustedValue = Math.round((value / originalWeight) * currentWeight);

            calorieCell.textContent = `${adjustedValue} ${config.unit}`;
            calorieCell.classList.remove('fade-in');
            void calorieCell.offsetWidth; // trigger reflow
            calorieCell.classList.add('fade-in');
        }
    });

    // Update Total
    updateTotalCalories();
}

// Manual Item Addition
addItemBtn.addEventListener('click', () => {
    const defaultItem = { nameKo: "", nameEn: "", weight: "100g", calories: 0 };
    addTableRow(defaultItem);
    updateTotalCalories();
});

// Gemini API Image Analysis via Proxy
async function analyzeImages(images) {
    const prompt = `Identify ALL food items in these images, including branded products.
    
    1. "foods" array: MUST include EVERY identified item (including those with brands).
       For each item, provide a BALANCED and REALISTIC weight estimate (in grams or ml). 
       Carefully observe the portion size. Do not over- or underestimate. 
       Use typical restaurant or home serving sizes as a reference.
       Provide ALL nutritional values and names in BOTH Korean and English: {nameKo, nameEn, weight, calories, carbs, protein, fat}
    2. "brands" array: ONLY include items that have a visible brand name.
       Each object: {brandNameKo, brandNameEn, productNameKo, productNameEn, nutritionInfoKo, nutritionInfoEn, calories, carbs, protein, fat, weight}
    
    Return the results ONLY as a valid JSON object.
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

    const response = await fetch(API_ENDPOINTS.ANALYZE, {
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
        throw new Error(errorData.error || 'Server error occurred during analysis');
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

    updateNutritionUI(); // Initialize UI based on current index
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
    // Store all nutrition data in dataset for easy access during toggle
    row.dataset.nutrition = JSON.stringify({
        calories: parseInt(item.calories) || 0,
        carbs: parseInt(item.carbs) || 0,
        protein: parseInt(item.protein) || 0,
        fat: parseInt(item.fat) || 0
    });
    row.dataset.originalWeight = weightValue;

    // Store bilingual names
    row.dataset.nameKo = item.nameKo || item.name || '';
    row.dataset.nameEn = item.nameEn || item.name || '';

    const initialName = currentLang === 'ko' ? row.dataset.nameKo : row.dataset.nameEn;

    row.innerHTML = `
        <td>
            <input type="text" class="name-input" value="${initialName}" placeholder="${i18n[currentLang].namePlaceholder}">
        </td>
        <td>
            <div class="weight-input-container">
                <input type="number" class="weight-input" value="${weightValue}" data-cal-per-unit="${calPerUnit}">
                <span class="unit-text">${safeWeight.replace(/[0-9.]/g, '') || 'g'}</span>
            </div>
        </td>
        <td class="item-calories">${caloriesValue} kcal</td>
        <td>
            <button class="delete-btn" title="${i18n[currentLang].deleteItem}">✕</button>
        </td>
    `;
    resultBody.appendChild(row);

    const weightInput = row.querySelector('.weight-input');
    const nameInput = row.querySelector('.name-input');
    const deleteBtn = row.querySelector('.delete-btn');

    weightInput.addEventListener('input', () => updateItemCalories(row));
    nameInput.addEventListener('change', () => {
        if (currentLang === 'ko') row.dataset.nameKo = nameInput.value;
        else row.dataset.nameEn = nameInput.value;
        recalculateFromName(nameInput.value, row);
    });
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

        const nutritionObj = currentLang === 'ko' ? (b.nutritionInfoKo || b.nutritionInfo) : (b.nutritionInfoEn || b.nutritionInfo);

        if (typeof nutritionObj === 'object' && nutritionObj !== null) {
            nutritionText = Object.entries(nutritionObj)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
        } else {
            nutritionText = nutritionObj || i18n[currentLang].infoNone;
        }

        const bNameKo = b.brandNameKo || b.brandName || '';
        const bNameEn = b.brandNameEn || b.brandName || '';
        const pNameKo = b.productNameKo || b.productName || '';
        const pNameEn = b.productNameEn || b.productName || '';
        const currentBName = currentLang === 'ko' ? bNameKo : bNameEn;
        const currentPName = currentLang === 'ko' ? pNameKo : pNameEn;

        const searchQuery = encodeURIComponent(`${currentBName} ${currentPName} nutrition facts 영양성분`);
        const searchLink = `https://www.google.com/search?q=${searchQuery}`;

        const div = document.createElement('div');
        div.className = 'brand-item';
        div.innerHTML = `
            <div class="brand-header">
                <span class="brand-name">[${currentBName}] ${currentPName}</span>
                <a href="${searchLink}" target="_blank" class="search-link">${i18n[currentLang].searchDetail}</a>
            </div>
            <p class="brand-nutrition">${nutritionText}</p>
        `;
        brandContent.appendChild(div);
    });

    brandSection.classList.remove('hidden');
}

// Recalculate based on name change via Proxy
async function recalculateFromName(newName, row) {
    if (!newName.trim()) return;

    const weightInput = row.querySelector('.weight-input');
    row.style.opacity = '0.5';

    try {
        const prompt = `For the food item "${newName}", provide its common name in BOTH Korean and English, and its average calories per 100g.
        Return ONLY a valid JSON object with exactly these keys:
        {
            "nameKo": "Korean name",
            "nameEn": "English name",
            "caloriesPer100g": <number>
        }`;

        const contents = [{ parts: [{ text: prompt }] }];

        const response = await fetch(API_ENDPOINTS.RECALCULATE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents,
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (response.ok) {
            const data = await response.json();
            const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            try {
                const parsed = JSON.parse(textResult);

                // Update bilingual names
                if (parsed.nameKo) row.dataset.nameKo = parsed.nameKo;
                if (parsed.nameEn) row.dataset.nameEn = parsed.nameEn;

                // If the user's current language display does not match their input exactly, update it gracefully
                const nameInput = row.querySelector('.name-input');
                nameInput.value = currentLang === 'ko' ? row.dataset.nameKo : row.dataset.nameEn;

                const calsPer100g = parseFloat(parsed.caloriesPer100g) || 0;
                weightInput.dataset.calPerUnit = calsPer100g / 100;
                updateItemCalories(row);
            } catch (parseError) {
                console.warn('Failed to parse re-estimation JSON', parseError);
            }
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

    // Update the stored nutrition data if calories change (though usually we recalculate from name)
    const nutrition = JSON.parse(row.dataset.nutrition || '{}');
    nutrition.calories = newCalories;
    row.dataset.nutrition = JSON.stringify(nutrition);
    row.dataset.originalWeight = newWeight;

    // Refresh display based on current toggle state
    const currentConfig = NUTRITION_TYPES[currentNutritionIndex];
    if (currentNutritionIndex === 0) {
        calorieCell.textContent = `${newCalories} kcal`;
    } else {
        // Simple proportional update for macros if weight changes
        const originalValue = nutrition[currentConfig.key] || 0;
        // In a real app, we'd have precise density/info, but here we scale proportionally
        calorieCell.textContent = `${Math.round(originalValue)} ${currentConfig.unit}`;
    }

    updateTotalCalories();
}

function updateTotalCalories() {
    let total = 0;
    document.querySelectorAll('.item-calories').forEach(cell => {
        total += parseFloat(cell.textContent) || 0;
    });

    const config = NUTRITION_TYPES[currentNutritionIndex];
    totalCaloriesContainer.querySelector('.total-label').textContent = `${i18n[currentLang].totalLabel}${config.label}`;
    totalCaloriesValue.textContent = `${Math.round(total)} ${config.unit}`;
}

// Simulating recognition for fallback
function simulateRecognition() {
    return [
        { nameKo: "닭가슴살 샐러드", nameEn: "Chicken Breast Salad", name: "닭가슴살 샐러드", weight: "200g", calories: 250, carbs: 10, protein: 35, fat: 8 },
        { nameKo: "고구마", nameEn: "Sweet Potato", name: "고구마", weight: "150g", calories: 130, carbs: 32, protein: 2, fat: 0 }
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
