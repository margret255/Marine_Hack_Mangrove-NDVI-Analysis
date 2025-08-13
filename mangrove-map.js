// Real Kenyan mangrove data from documents
const coverageData = {
    2015: { total: 60323, lamu: 30475 },
    2016: { total: 54430, lamu: 38101 }, // 70% of total
    2017: { total: 61271, lamu: 37650 },
    2018: { total: 61000, lamu: 29830 },
    2019: { total: 61279, lamu: null },
    2020: { total: 61170, lamu: 37314 }, // 61% of total
    2021: { total: 61300, lamu: 37400 }, // Estimated
    2022: { total: 61450, lamu: 37500 }, // Estimated
    2023: { total: 61600, lamu: 37600 }, // Estimated
    2024: { total: 61750, lamu: 37700 }  // Estimated
};

// Kenyan mangrove zones with real coordinates and descriptions from documents
const zones = [
    {
        id: "lamu",
        name: "Lamu Archipelago",
        status: "healthy",
        center: { lat: -2.2717, lng: 40.9020 },
        radius: 0.08,
        coverage: 37314,
        healthIndex: 8.7,
        description: "The largest mangrove forest in Kenya, covering over 60% of the country's total mangrove area. Home to diverse marine life and a crucial carbon sink. Lamu mangroves provide timber, fuelwood, and support beekeeping initiatives."
    },
    {
        id: "kilifi",
        name: "Kilifi Creek",
        status: "warning",
        center: { lat: -3.6306, lng: 39.8494 },
        radius: 0.04,
        coverage: 8536,
        healthIndex: 6.2,
        description: "Facing threats from illegal logging and salt farming. Restoration efforts ongoing through community-led initiatives like the Seatrees organization's nursery program which has created jobs while protecting against storm surges."
    },
    {
        id: "tana",
        name: "Tana Delta",
        status: "critical",
        center: { lat: -2.5833, lng: 40.3167 },
        radius: 0.03,
        coverage: 3260,
        healthIndex: 4.1,
        description: "Severely degraded due to upstream dam construction reducing freshwater flow. Urgent restoration needed to prevent complete loss. Conversion of areas for salt production has further contributed to decline."
    },
    {
        id: "mtwapa",
        name: "Mtwapa Creek",
        status: "healthy",
        center: { lat: -4.0435, lng: 39.6682 },
        radius: 0.02,
        coverage: 3771,
        healthIndex: 7.8,
        description: "Well-protected mangrove area with strong community involvement in conservation. Provides timber, tannins for leather processing, and serves as a model for sustainable use under the Forest Act's community forest associations."
    },
    {
        id: "vanga",
        name: "Vanga Bay",
        status: "healthy",
        center: { lat: -4.6667, lng: 39.2167 },
        radius: 0.02,
        coverage: 0, // Data not specified in documents
        healthIndex: 7.5,
        description: "Important mangrove site in Kwale County, though smaller than Lamu. Part of Kenya's 600km coastline mangrove distribution mentioned in the National Mangrove Plan."
    }
];

// Initialize map centered on Kenya's coast
const map = L.map('map').setView([-2.5, 40.0], 8);

// Add satellite base layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Add mangrove areas to map
const zoneLayers = {};

function updateMapForYear(year) {
    // Clear existing layers
    Object.values(zoneLayers).forEach(layer => map.removeLayer(layer));
    
    // Add new layers with appropriate styling
    zones.forEach(zone => {
        const color = getStatusColor(zone.status);
        
        const circle = L.circle([zone.center.lat, zone.center.lng], {
            radius: zone.radius * 100000, // Convert to meters
            color: color,
            fillColor: color,
            fillOpacity: 0.3,
            weight: 2
        }).addTo(map);
        
        // Store reference to layer
        zoneLayers[zone.id] = circle;
        
        // Add popup with zone info
        circle.bindPopup(`
            <h3>${zone.name}</h3>
            <p>Coverage: ${zone.coverage ? zone.coverage.toLocaleString() + ' ha' : 'Data not available'}</p>
            <p>Health index: ${zone.healthIndex}/10</p>
            <p>${zone.description}</p>
            <div class="status status-${zone.status}">${getStatusText(zone.status)}</div>
        `);
    });
}

function getStatusColor(status) {
    switch(status) {
        case 'healthy': return '#2ec4b6';
        case 'warning': return '#ff9f1c';
        case 'critical': return '#e71d36';
        default: return '#778da9';
    }
}

function getStatusText(status) {
    switch(status) {
        case 'healthy': return 'Stable';
        case 'warning': return 'Restoration needed';
        case 'critical': return 'Critical condition';
        default: return 'Unknown';
    }
}

// Tab functionality
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', function() {
        const tabId = this.getAttribute('data-tab');
        
        // Update active tab
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        
        // Show corresponding content
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Toggle sidebar
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.querySelector('.close-sidebar');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');

function toggleSidebar() {
    sidebar.classList.toggle('active');
}

closeSidebarBtn.addEventListener('click', toggleSidebar);

// For mobile, show toggle button
function checkScreenSize() {
    if (window.innerWidth <= 768) {
        toggleSidebarBtn.style.display = 'block';
        sidebar.classList.remove('active');
    } else {
        toggleSidebarBtn.style.display = 'none';
        sidebar.classList.add('active');
    }
}

window.addEventListener('resize', checkScreenSize);
checkScreenSize();

toggleSidebarBtn.addEventListener('click', toggleSidebar);

// Year selection
const yearPills = document.querySelectorAll('.year-pill');

yearPills.forEach(pill => {
    pill.addEventListener('click', function() {
        yearPills.forEach(p => p.classList.remove('active'));
        this.classList.add('active');
        
        const year = parseInt(this.textContent);
        const data = coverageData[year];
        
        // Update metrics
        document.querySelector('.metric-card:nth-child(1) .metric-value').textContent = 
            data.total.toLocaleString() + ' ha';
        document.querySelector('.metric-card:nth-child(2) .metric-value').textContent = 
            (data.lamu || Math.round(data.total * 0.61)).toLocaleString() + ' ha';
        
        // Update trend indicators
        const prevYear = year - 1;
        if (coverageData[prevYear]) {
            const totalChange = ((data.total - coverageData[prevYear].total) / coverageData[prevYear].total * 100).toFixed(1);
            const trendElement = document.querySelector('.metric-card:nth-child(1) .trend-indicator');
            
            if (totalChange >= 0) {
                trendElement.innerHTML = `<span class="trend-up">▲ ${Math.abs(totalChange)}%</span> from ${prevYear}`;
            } else {
                trendElement.innerHTML = `<span class="trend-down">▼ ${Math.abs(totalChange)}%</span> from ${prevYear}`;
            }
        }
        
        updateMapForYear(year);
    });
});

// Report button
document.getElementById('report-btn').addEventListener('click', function() {
    alert('Thank you for your concern! Please email reports to: mangrove.reports@kenya.gov\n\nUnder Article 69 of the Constitution, all citizens have a duty to protect the environment.');
});

// Add click handler for "Join Restoration" button
document.querySelector('.zone-card.critical button').addEventListener('click', function() {
    window.open('https://www.kws.go.ke/conservation-education/community-based-conservation', '_blank');
});

// Initialize with 2020 data
document.querySelector('.year-pill.active').click();