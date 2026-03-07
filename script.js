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
const updateBrandsBtn = document.getElementById('updateBrandsBtn');
const saveRecordBtn = document.getElementById('saveRecordBtn');

let uploadedImages = []; // Stores objects: { mimeType, data (base64) }
let lastBrands = []; // Stores the last analyzed brands for bilingual toggling
let lastFoods = []; // Stores the original foods for merging after brand updates

// Helper for extracting macros robustly if AI nests them or omits them
function getMacroValue(brand, key) {
    if (brand[key] !== undefined && brand[key] !== null && brand[key] !== "") {
        return parseFloat(brand[key]) || 0;
    }
    // Fallbacks if AI nested them inside nutritionInfoKo or nutritionInfoEn
    const tryExtract = (info) => {
        if (typeof info === 'object' && info !== null) {
            if (info[key] !== undefined) return parseFloat(info[key]);
            // Fuzzy match (e.g., 'Calories' or 'calories (kcal)')
            for (const [k, v] of Object.entries(info)) {
                if (k.toLowerCase().includes(key.toLowerCase())) {
                    return parseFloat(v);
                }
            }
        }
        return null;
    };

    let val = tryExtract(brand.nutritionInfoKo);
    if (val !== null && !isNaN(val)) return val || 0;
    val = tryExtract(brand.nutritionInfoEn);
    if (val !== null && !isNaN(val)) return val || 0;

    return 0;
}

// View camera.js for photo selection and camera logic

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
        lastFoods = results.foods || [];
        const allFoods = [...lastFoods];
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
                        calories: getMacroValue(brand, 'calories'),
                        carbs: getMacroValue(brand, 'carbs'),
                        protein: getMacroValue(brand, 'protein'),
                        fat: getMacroValue(brand, 'fat')
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
        lastFoods = [];
    }
});

// Update Brands Button Logic
if (updateBrandsBtn) {
    updateBrandsBtn.addEventListener('click', async () => {
        if (uploadedImages.length === 0) return;

        updateBrandsBtn.disabled = true;
        updateBrandsBtn.textContent = '...';

        try {
            const brands = await analyzeBrandsOnly(uploadedImages);
            lastBrands = brands || [];

            const allFoods = [...lastFoods];
            if (lastBrands && Array.isArray(lastBrands)) {
                lastBrands.forEach(brand => {
                    const brandItemNameKo = `[${brand.brandNameKo || brand.brandName}] ${brand.productNameKo || brand.productName}`;
                    const brandItemNameEn = `[${brand.brandNameEn || brand.brandName}] ${brand.productNameEn || brand.productName}`;
                    if (!allFoods.some(f => f.nameKo === brandItemNameKo || f.name === brandItemNameKo)) {
                        allFoods.push({
                            nameKo: brandItemNameKo,
                            nameEn: brandItemNameEn,
                            name: brandItemNameKo, // Fallback
                            weight: brand.weight || "100g",
                            calories: getMacroValue(brand, 'calories'),
                            carbs: getMacroValue(brand, 'carbs'),
                            protein: getMacroValue(brand, 'protein'),
                            fat: getMacroValue(brand, 'fat')
                        });
                    }
                });
            }

            displayResults(allFoods);
            displayBrandInfo(lastBrands);
        } catch (error) {
            console.error('Brand update failed:', error);
            alert(currentLang === 'ko' ? '브랜드 정보 업데이트에 실패했습니다.' : 'Failed to update brand info.');
        } finally {
            updateBrandsBtn.disabled = false;
            updateBrandsBtn.textContent = i18n[currentLang].updateBrandsBtn;
        }
    });
}

// Gemini API Image Analysis via Proxy for Brands Only
async function analyzeBrandsOnly(images) {
    const prompt = `Identify ALL branded products in these images.
    
    1. "brands" array: ONLY include items that have a visible or identifiable brand name.
       Each object MUST include at the top level: {brandNameKo, brandNameEn, productNameKo, productNameEn, nutritionInfoKo, nutritionInfoEn, calories, carbs, protein, fat, weight}.
       If the nutritional info is NOT visible on the packaging, you MUST estimate "calories", "carbs", "protein", and "fat" based on your knowledge of the commercial product, and place them as NUMBERS at the top level of the object.
    2. "foods" array: leave this empty.
    
    Do NOT include general foods. Analyze and extract the brand and nutrition information accurately.
    Return the results ONLY as a valid JSON object.`;

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
        throw new Error('Server error occurred during analysis');
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts?.[0]) {
        throw new Error('No content returned from API');
    }

    let resultText = candidate.content.parts[0].text;
    resultText = resultText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
        const parsed = JSON.parse(resultText);
        return parsed.brands || [];
    } catch (parseError) {
        console.error("Failed to parse JSON from AI response:", resultText);
        throw new Error("AI returned invalid JSON structure.");
    }
}

let currentLang = 'ko';

const i18n = {
    ko: {
        subtitle: "음식 사진을 찍어 영양소를 즉시 확인하세요",
        importPhoto: "사진 가져오기",
        importHint: "(카메라/갤러리)",
        selectPhotoSource: "사진 가져오기 방법 선택",
        takePhoto: "카메라로 촬영",
        chooseFromGallery: "갤러리에서 선택",
        closeBtn: "닫기",
        analyzeBtn: "분석 및 영양소 계산하기",
        resetBtn: "새로고침",
        analyzing: "AI가 분석 중입니다...",
        searchResults: "검색 결과",
        foodName: "음식 이름",
        estWeight: "추정 무게",
        addItemBtn: "+ 직접 항목 추가",
        brandNutrition: "브랜드 영양 정보",
        updateBrandsBtn: "업데이트",
        totalLabel: "총 ",
        nutritionTypes: { calories: '칼로리', carbs: '탄수화물', protein: '단백질', fat: '지방' },
        alertSimulate: "앗! 스캐너 AI가 깜빡 한눈팔고 엉뚱한 대답을 했어요! 다시 분석해 주세요 🤪",
        confirmReset: "모든 사진과 분석 결과를 초기화할까요?",
        namePlaceholder: "음식 이름 입력",
        searchDetail: "🔍 상세 정보 검색",
        infoNone: "정보 없음",
        promptLang: "Korean",
        deletePhoto: "사진 삭제",
        deleteItem: "삭제",
        toggleTooltip: "클릭하여 영양성분 전환",
        resetAllTooltip: "모두 초기화",
        saveRecordBtn: "영양소 기록 저장",
        saveSuccess: "성공적으로 저장되었습니다!",
        saveError: "저장에 실패했습니다.",
        loginRequired: "로그인이 필요합니다."
    },
    en: {
        subtitle: "Instantly check macros by taking a food photo",
        importPhoto: "Import Photo",
        importHint: "(Camera/Gallery)",
        selectPhotoSource: "Select Photo Source",
        takePhoto: "Take a Photo",
        chooseFromGallery: "Choose from Gallery",
        closeBtn: "Close",
        analyzeBtn: "Analyze & Calculate Macros",
        resetBtn: "Reset",
        analyzing: "AI is analyzing...",
        searchResults: "Search Results",
        foodName: "Food Name",
        estWeight: "Est. Weight",
        addItemBtn: "+ Add Item Manually",
        brandNutrition: "Brand Nutrition Info",
        updateBrandsBtn: "Update",
        totalLabel: "Total ",
        nutritionTypes: { calories: 'Calories', carbs: 'Carbs', protein: 'Protein', fat: 'Fat' },
        alertSimulate: "Oops! The Scanner AI got distracted and gave a quirky answer! 🤪 Please try analyzing again.",
        confirmReset: "Are you sure you want to reset all photos and results?",
        namePlaceholder: "Enter food name",
        searchDetail: "🔍 Search Details",
        infoNone: "No info",
        promptLang: "English",
        deletePhoto: "Delete Photo",
        deleteItem: "Delete",
        toggleTooltip: "Click to toggle nutrition",
        resetAllTooltip: "Reset All",
        saveRecordBtn: "Save Nutrient Record",
        saveSuccess: "Successfully saved!",
        saveError: "Failed to save.",
        loginRequired: "Login is required."
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

// View auth.js for authentication state management

// DOMContentLoaded 이벤트에 초기화 로직 추가
document.addEventListener('DOMContentLoaded', () => {

    // 각종 버튼 이벤트 리스너 설정
    // const analyzeBtn = document.getElementById('analyzeBtn'); // Already defined globally

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
    const defaultItem = { nameKo: "", nameEn: "", weight: "100g", calories: 0, carbs: 0, protein: 0, fat: 0 };
    addTableRow(defaultItem);
    updateTotalCalories();
});

// Gemini API Image Analysis via Proxy
async function analyzeImages(images) {
    const prompt = `Identify ALL food items in these images.
    
    1. "brands" array: ONLY include items that have a visible or identifiable brand name.
       Each object MUST include at the top level: {brandNameKo, brandNameEn, productNameKo, productNameEn, nutritionInfoKo, nutritionInfoEn, calories, carbs, protein, fat, weight}.
       If the nutritional info is NOT visible on the packaging, you MUST estimate "calories", "carbs", "protein", and "fat" based on your knowledge of the commercial product, and place them as NUMBERS at the top level of the object.
    2. "foods" array: Include general food items that do NOT have a brand.
       CRITICAL REQUIRMENT: If an item is listed in the "brands" array, DO NOT include it in the "foods" array (No duplicates).
       For each item, provide a BALANCED and REALISTIC weight estimate (in grams or ml). 
       Carefully observe the portion size. Do not over- or underestimate. 
       Use typical restaurant or home serving sizes as a reference.
       Provide ALL nutritional values and names in BOTH Korean and English: {nameKo, nameEn, weight, calories, carbs, protein, fat}
    
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

    if (!data.candidates || data.candidates.length === 0) {
        if (data.promptFeedback && data.promptFeedback.blockReason) {
            throw new Error(`Image blocked by safety filter: ${data.promptFeedback.blockReason}`);
        }
        throw new Error('No candidates returned from API.');
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
        throw new Error(`API returned no content. Finish reason: ${candidate.finishReason}`);
    }

    let resultText = candidate.content.parts[0].text;

    // Clean up markdown formatting if Gemini returns it despite JSON mime type
    resultText = resultText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
        return JSON.parse(resultText);
    } catch (parseError) {
        console.error("Failed to parse JSON from AI response:", resultText);
        throw new Error("AI returned invalid JSON structure.");
    }
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

    // Store per-unit values in dataset for weight changes
    row.dataset.calPerUnit = calPerUnit;
    row.dataset.carbsPerUnit = (parseInt(item.carbs) || 0) / (weightValue || 1);
    row.dataset.proteinPerUnit = (parseInt(item.protein) || 0) / (weightValue || 1);
    row.dataset.fatPerUnit = (parseInt(item.fat) || 0) / (weightValue || 1);

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
                <input type="number" class="weight-input" value="${weightValue}">
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
        const prompt = `For the food item "${newName}", provide its common name in BOTH Korean and English, and its average nutritional info per 100g.
        Return ONLY a valid JSON object with exactly these keys:
        {
            "nameKo": "Korean name",
            "nameEn": "English name",
            "caloriesPer100g": <number>,
            "carbsPer100g": <number>,
            "proteinPer100g": <number>,
            "fatPer100g": <number>
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
                const carbsPer100g = parseFloat(parsed.carbsPer100g) || 0;
                const proteinPer100g = parseFloat(parsed.proteinPer100g) || 0;
                const fatPer100g = parseFloat(parsed.fatPer100g) || 0;

                row.dataset.calPerUnit = calsPer100g / 100;
                row.dataset.carbsPerUnit = carbsPer100g / 100;
                row.dataset.proteinPerUnit = proteinPer100g / 100;
                row.dataset.fatPerUnit = fatPer100g / 100;

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

    const calPerUnit = parseFloat(row.dataset.calPerUnit) || 0;
    const carbsPerUnit = parseFloat(row.dataset.carbsPerUnit) || 0;
    const proteinPerUnit = parseFloat(row.dataset.proteinPerUnit) || 0;
    const fatPerUnit = parseFloat(row.dataset.fatPerUnit) || 0;

    const newCalories = Math.round(newWeight * calPerUnit);
    const newCarbs = Math.round(newWeight * carbsPerUnit);
    const newProtein = Math.round(newWeight * proteinPerUnit);
    const newFat = Math.round(newWeight * fatPerUnit);

    // Update the stored nutrition data
    const nutrition = {
        calories: newCalories,
        carbs: newCarbs,
        protein: newProtein,
        fat: newFat
    };
    row.dataset.nutrition = JSON.stringify(nutrition);
    row.dataset.originalWeight = newWeight;

    // Refresh display based on current toggle state
    const currentConfig = NUTRITION_TYPES[currentNutritionIndex];
    const displayValue = nutrition[currentConfig.key] || 0;
    calorieCell.textContent = `${displayValue} ${currentConfig.unit}`;

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

// Save Nutrient Record Logic
if (saveRecordBtn) {
    saveRecordBtn.addEventListener('click', async () => {
        const rows = document.querySelectorAll('#resultBody tr');
        if (rows.length === 0) return;

        let totalCalories = 0, totalCarbs = 0, totalProtein = 0, totalFat = 0;

        rows.forEach(row => {
            const data = JSON.parse(row.dataset.nutrition || '{}');
            totalCalories += (data.calories || 0);
            totalCarbs += (data.carbs || 0);
            totalProtein += (data.protein || 0);
            totalFat += (data.fat || 0);
        });

        // Get current Date (YYYY-MM-DD) and Time (HH:MM)
        const now = new Date();
        // Adjust for local timezone offset to get local date string properly
        const tzOffset = now.getTimezoneOffset() * 60000; // offset in milliseconds
        const localISOTime = (new Date(now - tzOffset)).toISOString();
        const currentDate = localISOTime.split('T')[0];
        const currentTime = localISOTime.split('T')[1].substring(0, 5); // HH:MM

        const payload = {
            date: currentDate,
            time: currentTime,
            calories: totalCalories,
            carbs: totalCarbs,
            protein: totalProtein,
            fat: totalFat
        };

        const originalText = saveRecordBtn.textContent;
        saveRecordBtn.textContent = '...';
        saveRecordBtn.disabled = true;

        try {
            const response = await fetch('/api/diet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 401) {
                alert(i18n[currentLang].loginRequired);
            } else if (response.ok) {
                alert(i18n[currentLang].saveSuccess);
            } else {
                alert(i18n[currentLang].saveError);
            }
        } catch (error) {
            console.error('Save error:', error);
            alert(i18n[currentLang].saveError);
        } finally {
            saveRecordBtn.textContent = originalText;
            saveRecordBtn.disabled = false;
        }
    });
}

// Simulating recognition for fallback
function simulateRecognition() {
    return [
        { nameKo: "닭가슴살 샐러드", nameEn: "Chicken Breast Salad", name: "닭가슴살 샐러드", weight: "200g", calories: 250, carbs: 10, protein: 35, fat: 8 },
        { nameKo: "고구마", nameEn: "Sweet Potato", name: "고구마", weight: "150g", calories: 130, carbs: 32, protein: 2, fat: 0 }
    ];
}

// View camera.js for fileToBase64 utility function
