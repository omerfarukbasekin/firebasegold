// Real-time Gold Price Dashboard Logic
let db;
let currentGoldType = 'GA'; // Default: Gram Altın
let currentRange = '24h'; // Default: 24 Hours
let chartInstance = null;
let goldPricesMap = {}; // Cache of latest prices keyed by code
let unsubscribeLatest = null;
let unsubscribeHistory = null;

// DOM Elements
const goldListContainer = document.getElementById('goldListContainer');
const totalInstruments = document.getElementById('totalInstruments');
const instrumentSearch = document.getElementById('instrumentSearch');
const selectedCode = document.getElementById('selectedCode');
const selectedName = document.getElementById('selectedName');
const lastUpdatedStr = document.getElementById('lastUpdatedStr');
const heroBuy = document.getElementById('heroBuy');
const heroSell = document.getElementById('heroSell');
const heroChange = document.getElementById('heroChange');
const tickerContainer = document.getElementById('tickerContainer');

let previousGoldPricesMap = {}; // Cache to determine price movements (up/down) from Firestore

// Stats DOM Elements
const statSpread = document.getElementById('statSpread');
const statSpreadPercent = document.getElementById('statSpreadPercent');
const statLow = document.getElementById('statLow');
const statHigh = document.getElementById('statHigh');
const statAvg = document.getElementById('statAvg');

// Loader
const chartLoader = document.getElementById('chartLoader');

// Wait for Firebase to initialize
document.addEventListener('DOMContentLoaded', () => {
    // Poll for firebase initialization from /__/firebase/init.js
    const checkInterval = setInterval(() => {
        if (typeof firebase !== 'undefined') {
            clearInterval(checkInterval);
            initApp();
        }
    }, 100);
});

function initApp() {
    try {
        // Initialize Firestore instance
        const app = firebase.app();
        db = firebase.firestore();
        console.log("Firebase initialized successfully inside app.js");
        
        // Start listening to the gold_prices collection in real-time
        listenToLatestPrices();
        
        // Setup Event Listeners
        setupEventListeners();
    } catch (e) {
        console.error("Firebase initialization failed:", e);
    }
}

// Listen to latest gold prices
function listenToLatestPrices() {
    if (unsubscribeLatest) unsubscribeLatest();

    unsubscribeLatest = db.collection('gold_prices').onSnapshot((snapshot) => {
        const listItems = [];
        let updatedCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const code = doc.id;
            
            // Check if this is a fresh update to populate previous prices
            const currentCached = goldPricesMap[code];
            let isNewUpdate = false;
            
            if (currentCached) {
                const oldTime = currentCached.source_updated_at ? currentCached.source_updated_at.toMillis() : 0;
                const newTime = data.source_updated_at ? data.source_updated_at.toMillis() : 0;
                if (newTime > oldTime) {
                    previousGoldPricesMap[code] = currentCached;
                    isNewUpdate = true;
                }
            }

            const prevData = previousGoldPricesMap[code];

            // Determine if price ticked up/down for the sidebar list
            let tickClass = '';
            if (prevData && isNewUpdate) {
                if (data.price_buy > prevData.price_buy) {
                    tickClass = 'tick-up';
                } else if (data.price_buy < prevData.price_buy) {
                    tickClass = 'tick-down';
                }
            }

            goldPricesMap[code] = {
                ...data,
                tickClass: tickClass
            };
            
            // Sayfa ilk yüklendiğinde "önceki" veriyi bulup renkleri anında göstermek için Firestore history altından çekiyoruz
            if (!prevData && !isNewUpdate) {
                db.collection('gold_prices').doc(code).collection('history')
                    .orderBy('created_at', 'desc').limit(2).get()
                    .then(histSnap => {
                        if (histSnap.docs.length === 2) {
                            // En son 2. kayıt aslında bir önceki fiyattır
                            previousGoldPricesMap[code] = histSnap.docs[1].data();
                            renderLiveTicker(); // Veri geldiğinde ticker'ı tekrar renklendir
                        }
                    }).catch(e => console.error(e));
            }
            
            listItems.push(goldPricesMap[code]);
            updatedCount++;
        });

        totalInstruments.textContent = `${updatedCount} Enstrüman`;
        renderGoldList(listItems);
        
        // Update the active hero panel with fresh live data
        updateHeroPanel();
        
        // Update the scrolling ticker
        renderLiveTicker();
    }, (error) => {
        console.error("Firestore listening error: ", error);
    });
}

// Render the gold list in the sidebar
function renderGoldList(items) {
    const searchVal = instrumentSearch.value.trim().toLowerCase();
    
    // Filter items based on search input
    const filteredItems = items.filter(item => {
        const code = (item.code || '').toLowerCase();
        const desc = (item.description || '').toLowerCase();
        return code.includes(searchVal) || desc.includes(searchVal);
    });

    // Sort by GA first, then alphabetically
    filteredItems.sort((a, b) => {
        if (a.code === 'GA') return -1;
        if (b.code === 'GA') return 1;
        return a.code.localeCompare(b.code);
    });

    goldListContainer.innerHTML = '';

    if (filteredItems.length === 0) {
        goldListContainer.innerHTML = `
            <div class="text-center py-8 text-slate-500 text-sm">
                <i class="fa-solid fa-face-frown text-xl block mb-2"></i>
                Aramayla eşleşen sonuç bulunamadı.
            </div>
        `;
        return;
    }

    filteredItems.forEach(item => {
        const isActive = item.code === currentGoldType;
        const spread = Math.abs(item.price_sell - item.price_buy).toFixed(2);
        
        const itemEl = document.createElement('div');
        itemEl.className = `p-3.5 rounded-xl transition cursor-pointer flex items-center justify-between border ${
            isActive 
            ? 'bg-gold-500/10 border-gold-500/40 text-white' 
            : 'bg-slate-900/40 hover:bg-slate-900/80 border-white/5 text-slate-300'
        } ${item.tickClass || ''}`;

        itemEl.onclick = () => {
            selectGoldType(item.code);
        };

        // Format update time
        let timeStr = '--:--';
        if (item.source_updated_at) {
            const date = item.source_updated_at.toDate ? item.source_updated_at.toDate() : new Date(item.source_updated_at);
            timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        itemEl.innerHTML = `
            <div class="min-w-0 flex-grow pr-2">
                <div class="flex items-center gap-1.5">
                    <span class="font-display font-black text-sm tracking-wide">${item.code}</span>
                    <span class="text-[10px] text-slate-500 truncate font-medium max-w-[120px]">${item.description || ''}</span>
                </div>
                <div class="text-[10px] text-slate-500 mt-0.5">Makas: ${spread} TL</div>
            </div>
            <div class="text-right flex-shrink-0">
                <div class="font-display font-bold text-sm text-slate-200">${item.price_sell ? item.price_sell.toFixed(2) : '--'} TL</div>
                <span class="text-[9px] text-slate-500 font-medium block mt-0.5"><i class="fa-regular fa-clock mr-1"></i>${timeStr}</span>
            </div>
        `;

        goldListContainer.appendChild(itemEl);
    });
}

// Select active gold type
function selectGoldType(code) {
    if (currentGoldType === code) return;
    currentGoldType = code;
    
    // Rerender list to show new selection status
    renderGoldList(Object.values(goldPricesMap));
    updateHeroPanel();
    fetchHistoryData();
}

// Update Hero Panel elements with latest cached price
function updateHeroPanel() {
    const data = goldPricesMap[currentGoldType];
    if (!data) return;

    selectedCode.textContent = data.code || currentGoldType;
    selectedName.textContent = data.description || 'Altın Enstrümanı';

    if (data.source_updated_at) {
        const date = data.source_updated_at.toDate ? data.source_updated_at.toDate() : new Date(data.source_updated_at);
        lastUpdatedStr.textContent = `Son Güncelleme: ${date.toLocaleString()}`;
    }

    heroBuy.textContent = data.price_buy ? `${data.price_buy.toFixed(2)} TL` : '-- TL';
    heroSell.textContent = data.price_sell ? `${data.price_sell.toFixed(2)} TL` : '-- TL';

    // Calculate spread
    if (data.price_buy && data.price_sell) {
        const spreadVal = Math.abs(data.price_sell - data.price_buy);
        const spreadPercentVal = (spreadVal / data.price_buy) * 100;
        statSpread.textContent = `${spreadVal.toFixed(2)} TL`;
        statSpreadPercent.textContent = `Makas Oranı: %${spreadPercentVal.toFixed(3)}`;
    }
}

// Fetch historical data for active gold type based on range
function fetchHistoryData() {
    showChartLoader(true);
    
    if (unsubscribeHistory) unsubscribeHistory();

    const latestRef = db.collection('gold_prices').document(currentGoldType);
    let query = latestRef.collection('history').orderBy('source_updated_at', 'asc');

    // Filter by timestamp range
    unsubscribeHistory = query.onSnapshot((snapshot) => {
        const labels = [];
        const buyPrices = [];
        const sellPrices = [];

        snapshot.forEach((doc) => {
            const hData = doc.data();
            let timestamp;
            if (hData.source_updated_at) {
                timestamp = hData.source_updated_at.toDate ? hData.source_updated_at.toDate() : new Date(hData.source_updated_at);
            } else if (hData.created_at) {
                timestamp = hData.created_at.toDate ? hData.created_at.toDate() : new Date(hData.created_at);
            } else {
                timestamp = new Date();
            }

            labels.push(timestamp.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
            buyPrices.push(hData.price_buy);
            sellPrices.push(hData.price_sell);
        });

        // Eğer grafikte çizilecek hiç veri yoksa FALLBACK devreye girer:
        if (labels.length === 0 && currentRange !== 'all') {
            console.log("Grafik verisi boş geldi, Fallback (son 50 veri) çekiliyor...");
            latestRef.collection('history')
                .orderBy('source_updated_at', 'desc')
                .limit(50)
                .get()
                .then(fallbackSnap => {
                    const fbLabels = [];
                    const fbBuy = [];
                    const fbSell = [];
                    
                    const reversedDocs = [...fallbackSnap.docs].reverse();
                    reversedDocs.forEach(d => {
                        const fd = d.data();
                        let ts = fd.source_updated_at ? (fd.source_updated_at.toDate ? fd.source_updated_at.toDate() : new Date(fd.source_updated_at)) : new Date();
                        fbLabels.push(ts.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
                        fbBuy.push(fd.price_buy);
                        fbSell.push(fd.price_sell);
                    });
                    
                    updateStats(fbBuy, fbSell);
                    updateChangePercent(fbBuy);
                    renderChart(fbLabels, fbBuy, fbSell);
                    showChartLoader(false);
                }).catch(e => {
                    console.error("Fallback hatası:", e);
                    showChartLoader(false);
                });
            return;
        }

        // Normal grafiği çiz
        updateStats(buyPrices, sellPrices);
        updateChangePercent(buyPrices);
        renderChart(labels, buyPrices, sellPrices);
        showChartLoader(false);

    }, (error) => {
        console.error("Historical fetch error:", error);
        showChartLoader(false);
    });
}


function updateChangePercent(buyPrices) {
    if (buyPrices.length < 2) {
        heroChange.innerHTML = `<span class="text-slate-400 font-semibold">%0.00</span>`;
        return;
    }
    const initialPrice = buyPrices[0];
    const finalPrice = buyPrices[buyPrices.length - 1];
    const percentChange = ((finalPrice - initialPrice) / initialPrice) * 100;
    const isPositive = percentChange >= 0;

    heroChange.className = `font-display font-extrabold text-2xl flex items-center gap-1.5 justify-end ${
        isPositive ? 'text-emerald-400 green-glow' : 'text-red-400 red-glow'
    }`;

    heroChange.innerHTML = `
        <i class="fa-solid ${isPositive ? 'fa-caret-up' : 'fa-caret-down'} text-lg"></i>
        <span>%${(isPositive ? '+' : '')}${percentChange.toFixed(2)}</span>
    `;
}

function updateStats(buyPrices, sellPrices) {
    if (buyPrices.length === 0) {
        statLow.textContent = '--';
        statHigh.textContent = '--';
        statAvg.textContent = '--';
        return;
    }

    const minBuy = Math.min(...buyPrices);
    const maxSell = Math.max(...sellPrices);
    const sumBuy = buyPrices.reduce((a, b) => a + b, 0);
    const avgBuy = sumBuy / buyPrices.length;

    statLow.textContent = `${minBuy.toFixed(2)} TL`;
    statHigh.textContent = `${maxSell.toFixed(2)} TL`;
    statAvg.textContent = `${avgBuy.toFixed(2)} TL`;
}

function renderChart(labels, buyData, sellData) {
    const ctx = document.getElementById('liveGoldChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Set chart styling gradients
    const buyGradient = ctx.createLinearGradient(0, 0, 0, 400);
    buyGradient.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
    buyGradient.addColorStop(1, 'rgba(16, 185, 129, 0.01)');

    const sellGradient = ctx.createLinearGradient(0, 0, 0, 400);
    sellGradient.addColorStop(0, 'rgba(239, 68, 68, 0.16)');
    sellGradient.addColorStop(1, 'rgba(239, 68, 68, 0.01)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Alış Fiyatı (Buy)',
                    data: buyData,
                    borderColor: '#10b981', // emerald-500
                    borderWidth: 2.5,
                    backgroundColor: buyGradient,
                    fill: true,
                    tension: 0.3,
                    pointRadius: buyData.length < 50 ? 3 : 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#0b0f17',
                    pointBorderWidth: 1.5,
                },
                {
                    label: 'Satış Fiyatı (Sell)',
                    data: sellData,
                    borderColor: '#ef4444', // red-500
                    borderWidth: 2.5,
                    backgroundColor: sellGradient,
                    fill: true,
                    tension: 0.3,
                    pointRadius: sellData.length < 50 ? 3 : 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#ef4444',
                    pointBorderColor: '#0b0f17',
                    pointBorderWidth: 1.5,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: {
                            family: 'Plus Jakarta Sans',
                            weight: '500',
                            size: 11
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#f1f5f9',
                    titleFont: { family: 'Plus Jakarta Sans', weight: '600' },
                    bodyFont: { family: 'Plus Jakarta Sans' },
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    boxPadding: 4,
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.03)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            family: 'Plus Jakarta Sans',
                            size: 10
                        },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 8
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            family: 'Plus Jakarta Sans',
                            size: 10
                        }
                    }
                }
            }
        }
    });
}

function setupEventListeners() {
    // Search filter input
    instrumentSearch.addEventListener('input', () => {
        renderGoldList(Object.values(goldPricesMap));
    });

    // Time range buttons
    const rangeBtns = document.querySelectorAll('#rangeButtons button');
    rangeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            rangeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentRange = btn.getAttribute('data-range');
            fetchHistoryData();
        });
    });
}

function showChartLoader(show) {
    if (show) {
        chartLoader.classList.remove('opacity-0', 'pointer-events-none');
        chartLoader.classList.add('opacity-100');
    } else {
        chartLoader.classList.remove('opacity-100');
        chartLoader.classList.add('opacity-0', 'pointer-events-none');
    }
}


// -------- TICKER RENDER (USING FIRESTORE) --------

function renderLiveTicker() {
    if (!tickerContainer) return;

    const items = Object.values(goldPricesMap);
    if (items.length === 0) {
        tickerContainer.innerHTML = `<span class="text-xs text-slate-500">Piyasa verileri bekleniyor...</span>`;
        return;
    }

    // Sort by code alphabetically
    items.sort((a, b) => a.code.localeCompare(b.code));

    let tickerHtml = "";
    
    // Sonsuz dönme efekti için diziyi kopyalıyoruz
    const renderItems = [...items, ...items];

    renderItems.forEach(item => {
        const prevItem = previousGoldPricesMap[item.code];
        
        let buyColor = "text-slate-300"; // nötr
        let sellColor = "text-slate-300"; // nötr
        let iconHtml = "";

        if (prevItem) {
            // Alış Fiyatı Karşılaştırması
            if (item.price_buy > prevItem.price_buy) {
                buyColor = "text-emerald-400 font-bold";
                iconHtml = `<i class="fa-solid fa-caret-up mr-1 text-emerald-400"></i>`;
            } else if (item.price_buy < prevItem.price_buy) {
                buyColor = "text-red-400 font-bold";
                iconHtml = `<i class="fa-solid fa-caret-down mr-1 text-red-400"></i>`;
            }
            
            // Satış Fiyatı Karşılaştırması
            if (item.price_sell > prevItem.price_sell) {
                sellColor = "text-emerald-400 font-bold";
            } else if (item.price_sell < prevItem.price_sell) {
                sellColor = "text-red-400 font-bold";
            }
        }

        tickerHtml += `
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/60 border border-white/5">
                <span class="font-display font-black text-xs text-white tracking-wide">${item.code}</span>
                <span class="text-[10px] text-slate-500 font-semibold uppercase">${item.description || ""}</span>
                <div class="flex items-center text-xs">
                    ${iconHtml}
                    <span class="mr-1">A: <span class="${buyColor}">${item.price_buy ? item.price_buy.toFixed(2) : "--"}</span></span>
                    <span>S: <span class="${sellColor}">${item.price_sell ? item.price_sell.toFixed(2) : "--"}</span></span>
                </div>
            </div>
        `;
    });

    tickerContainer.innerHTML = tickerHtml;
}
