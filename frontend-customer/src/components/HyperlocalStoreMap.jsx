import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Compass, Store as StoreIcon, Check } from 'lucide-react';

export const HyperlocalStoreMap = ({
  userCoords = [28.6315, 77.2167],
  stores = [],
  selectedStoreId = null,
  onSelectStore,
  searchRadiusM = 3000,
  onRadiusChange,
}) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const radiusCircleRef = useRef(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Map
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: userCoords,
        zoom: 13,
        zoomControl: false,
      });

      // CartoDB Dark Matter / Positron tiles for high-tech look
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      markersGroupRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    // 1. Add User Marker
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div class="relative flex items-center justify-center w-8 h-8">
          <div class="absolute w-8 h-8 bg-sky-500/30 rounded-full animate-ping"></div>
          <div class="w-5 h-5 bg-sky-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
            <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    L.marker(userCoords, { icon: userIcon })
      .bindPopup(
        `<div class="text-xs font-sans text-slate-900 font-bold p-1">
          📍 Your Hyperlocal Location
          <div class="text-[10px] text-slate-500 font-normal">Search center point</div>
        </div>`
      )
      .addTo(markersGroup);

    // 2. Add Radius Circle
    if (radiusCircleRef.current) {
      map.removeLayer(radiusCircleRef.current);
    }
    radiusCircleRef.current = L.circle(userCoords, {
      radius: searchRadiusM,
      color: '#0ea5e9',
      weight: 1.5,
      opacity: 0.7,
      fillColor: '#0ea5e9',
      fillOpacity: 0.08,
      dashArray: '6, 6',
    }).addTo(map);

    // 3. Add Store Markers
    stores.forEach((store) => {
      const isSelected = store.id === selectedStoreId;
      const lat = store.latitude || (store.location?.coordinates && store.location.coordinates[1]);
      const lng = store.longitude || (store.location?.coordinates && store.location.coordinates[0]);

      if (lat && lng) {
        const storeIcon = L.divIcon({
          className: 'custom-store-marker',
          html: `
            <div class="relative group cursor-pointer transition-transform duration-200 ${isSelected ? 'scale-125 z-50' : 'hover:scale-110'}">
              <div class="px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xl border flex items-center gap-1.5 whitespace-nowrap ${
                isSelected
                  ? 'bg-brand-500 text-slate-950 border-brand-300 ring-4 ring-brand-500/20'
                  : 'bg-slate-900/95 text-brand-300 border-slate-700'
              }">
                <span>🏬</span>
                <span>${store.name.split('-')[0].trim()}</span>
                ${store.distance_meters ? `<span class="text-[9px] opacity-75">(${(store.distance_meters / 1000).toFixed(1)}km)</span>` : ''}
              </div>
            </div>
          `,
          iconSize: [120, 30],
          iconAnchor: [60, 15],
        });

        const marker = L.marker([lat, lng], { icon: storeIcon }).addTo(markersGroup);

        const popupContent = document.createElement('div');
        popupContent.className = 'text-xs font-sans text-slate-900 p-2 space-y-2';
        popupContent.innerHTML = `
          <div>
            <div class="font-bold text-sm text-slate-950">${store.name}</div>
            <div class="text-slate-600 text-[11px]">${store.address || 'Hyperlocal Kirana'}</div>
            ${store.distance_meters ? `<div class="text-[10px] text-brand-600 font-semibold mt-0.5">📍 ${(store.distance_meters).toFixed(0)} meters away</div>` : ''}
          </div>
          <button id="btn-select-${store.id}" class="w-full py-1.5 px-3 rounded-lg bg-slate-900 text-white font-bold text-[11px] hover:bg-slate-800 transition">
            Select This Store
          </button>
        `;

        popupContent.querySelector(`#btn-select-${store.id}`)?.addEventListener('click', () => {
          onSelectStore && onSelectStore(store);
          marker.closePopup();
        });

        marker.bindPopup(popupContent);

        marker.on('click', () => {
          onSelectStore && onSelectStore(store);
        });
      }
    });

    // Fit bounds if stores exist
    if (stores.length > 0) {
      const group = new L.featureGroup([
        L.marker(userCoords),
        ...stores
          .filter((s) => s.latitude && s.longitude)
          .map((s) => L.marker([s.latitude, s.longitude])),
      ]);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }, [userCoords, stores, selectedStoreId, searchRadiusM]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(userCoords, 14);
    }
  };

  return (
    <div className="relative rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-950">
      {/* Map Surface */}
      <div ref={mapContainerRef} className="w-full h-80 z-0" />

      {/* Top Floating Overlay Controls */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-800 shadow-lg text-xs font-semibold text-slate-300 flex items-center gap-1.5 pointer-events-auto">
          <Compass className="w-3.5 h-3.5 text-brand-400" />
          <span>{stores.length} Kiranas in Neighbourhood</span>
        </div>

        {/* Radius Filters */}
        <div className="bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-slate-800 shadow-lg flex items-center gap-1 pointer-events-auto">
          {[1000, 3000, 5000].map((r) => (
            <button
              key={r}
              onClick={() => onRadiusChange && onRadiusChange(r)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition ${
                searchRadiusM === r
                  ? 'bg-brand-500 text-slate-950 shadow-md shadow-brand-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r / 1000}km
            </button>
          ))}
        </div>
      </div>

      {/* Recenter Button */}
      <button
        onClick={handleRecenter}
        title="Recenter Map"
        className="absolute bottom-4 left-4 z-10 w-9 h-9 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 shadow-lg flex items-center justify-center transition"
      >
        <Navigation className="w-4 h-4 text-brand-400" />
      </button>
    </div>
  );
};
