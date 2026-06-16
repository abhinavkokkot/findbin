// =========================================================================
// 1. DATABASE CONFIGURATION
// =========================================================================
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = "https://lwqtexufasfycscwzfqd.supabase.co"; 
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3cXRleHVmYXNmeWNzY3d6ZnFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTMxNDYsImV4cCI6MjA5NzE4OTE0Nn0.aGDIvn5CHlgeD9_rQkvAl4VKe_tTvqK4VOeDyX_HZEg";


const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================================================
// 2. INITIALIZE THE MAP CONTAINER
// =========================================================================
const map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Global Variables State Management
let selectedTypeToAdd = null; 
let allMarkers = []; 
let userCoordinates = null; 

// Dynamic Emoji Marker Injectors
const createEmojiIcon = (emoji) => L.divIcon({
    html: emoji,
    className: 'custom-emoji-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

const icons = {
    toilet: createEmojiIcon('🚻'),
    dustbin: createEmojiIcon('🗑️'),
    autostand: createEmojiIcon('🛺')
};

// =========================================================================
// 3. GEOLOCATION MANAGEMENT & TRIGGER PERMISSIONS
// =========================================================================
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(position => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        
        // Save globally for recentering behavior later
        userCoordinates = [userLat, userLon]; 
        
        map.setView(userCoordinates, 15);
        L.marker(userCoordinates).addTo(map).bindPopup('<b>📍 You are here</b>').openPopup();
        
        loadPinsFromDatabase();
    }, () => {
        alert("Location permission denied. Map starting on default views.");
        loadPinsFromDatabase();
    });
} else {
    loadPinsFromDatabase();
}

// =========================================================================
// 4. DATABASE INTEGRATION SYNC (READING FROM 'BIN')
// =========================================================================
async function loadPinsFromDatabase() {
    const { data: items, error } = await _supabase.from('bin').select('*');
    if (error) {
        console.error("Database query failed:", error);
        return;
    }

    // Flush old UI state assets
    allMarkers.forEach(m => map.removeLayer(m.layer));
    allMarkers = [];

    items.forEach(item => {
        if (!item.lat || !item.log) return;

        const type = item.type || 'toilet'; 
        const markerIcon = icons[type] || icons.toilet;

        const marker = L.marker([item.lat, item.log], { icon: markerIcon }).addTo(map)
            .bindPopup(`<b>${type.toUpperCase()}</b><br>${item.title || "Utility Spot"}`);

        // Register tracking details
        allMarkers.push({ layer: marker, type: type });
    });
    
    filterMarkersVisible(); // Check checkbox display states
}

// =========================================================================
// 5. FILTER TOGGLE CHECKBOX LOGIC
// =========================================================================
const filters = {
    toilet: document.getElementById('filter-toilet'),
    dustbin: document.getElementById('filter-dustbin'),
    autostand: document.getElementById('filter-autostand')
};

Object.keys(filters).forEach(type => {
    filters[type].addEventListener('change', filterMarkersVisible);
});

function filterMarkersVisible() {
    allMarkers.forEach(markerObj => {
        const isChecked = filters[markerObj.type].checked;
        if (isChecked) {
            if (!map.hasLayer(markerObj.layer)) map.addLayer(markerObj.layer);
        } else {
            if (map.hasLayer(markerObj.layer)) map.removeLayer(markerObj.layer);
        }
    });
}

// =========================================================================
// 6. DROPDOWN UTILITY PLACEMENT PATTERNS (WRITING TO 'BIN')
// =========================================================================
const mainAddBtn = document.getElementById('add-main-btn');
const addDropdown = document.getElementById('add-dropdown');

mainAddBtn.addEventListener('click', () => {
    if (selectedTypeToAdd) {
        cancelAddMode();
    } else {
        addDropdown.classList.toggle('hidden');
        mainAddBtn.classList.toggle('active');
    }
});

document.querySelectorAll('.add-type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        selectedTypeToAdd = e.target.getAttribute('data-type');
        addDropdown.classList.add('hidden'); 
        alert(`Click anywhere on the map to place your ${selectedTypeToAdd.toUpperCase()} marker!`);
    });
});

function cancelAddMode() {
    selectedTypeToAdd = null;
    mainAddBtn.classList.remove('active');
    addDropdown.classList.add('hidden');
}

// Main map click trigger tracking deployment status
map.on('click', async function(e) {
    if (!selectedTypeToAdd) return; 

    const currentLat = e.latlng.lat;
    const currentLog = e.latlng.lng;
    const inputTitle = prompt(`Enter details for this new ${selectedTypeToAdd}:`);
    if (inputTitle === null) return;

    // Save mapping dataset straight to your database parameters
    const { data, error } = await _supabase
        .from('bin')
        .insert([{ lat: currentLat, log: currentLog, title: inputTitle, type: selectedTypeToAdd }]);

    if (error) {
        alert("Error saving item to database.");
        console.error(error);
    } else {
        const markerIcon = icons[selectedTypeToAdd];
        const newMarker = L.marker([currentLat, currentLog], { icon: markerIcon }).addTo(map)
            .bindPopup(`<b>${selectedTypeToAdd.toUpperCase()}</b><br>${inputTitle || "Utility Spot"}`)
            .openPopup();

        allMarkers.push({ layer: newMarker, type: selectedTypeToAdd });
        
        filterMarkersVisible();
        cancelAddMode();
    }
});

// =========================================================================
// 7. SMOOTH PAN RECENTER BEHAVIOR
// =========================================================================
document.getElementById('recenter-btn').addEventListener('click', () => {
    if (userCoordinates) {
        map.flyTo(userCoordinates, 15, {
            animate: true,
            duration: 1.5 
        });
    } else {
        alert("Location data unavailable. Re-checking browser permission states...");
        navigator.geolocation.getCurrentPosition(position => {
            userCoordinates = [position.coords.latitude, position.coords.longitude];
            map.flyTo(userCoordinates, 15);
        }, () => {
            alert("Could not pull location tracking information. Please check permission settings.");
        });
    }
});