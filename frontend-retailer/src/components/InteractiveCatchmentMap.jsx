import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Layers, Radio, TrendingUp, Compass } from 'lucide-react';

export const InteractiveCatchmentMap = ({ activeStore }) => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({ circles: null, hotspots: null });
  const [showHotspots, setShowHotspots] = useState(true);

  const storeLat = activeStore?.latitude || 28.6315;
  const storeLng = activeStore?.longitude || 77.2167;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [storeLat, storeLng],
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      layersRef.current.circles = L.layerGroup().addTo(map);
      layersRef.current.hotspots = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    map.setView([storeLat, storeLng], 14);

    const { circles, hotspots } = layersRef.current;
    circles.clearLayers();
    hotspots.clearLayers();

    // Store Flagship Pin
    const storeIcon = L.divIcon({
      className: 'store-flagship-marker',
      html: `
        <div class="relative flex items-center justify-center w-10 h-10">
          <div class="absolute w-10 h-10 bg-teal-400/20 rounded-full animate-ping"></div>
          <div class="w-8 h-8 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 border-2 border-slate-900 shadow-2xl flex items-center justify-center text-slate-950 font-black text-sm">
            🏬
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    L.marker([storeLat, storeLng], { icon: storeIcon })
      .bindPopup(
        `<div class="text-xs font-sans text-slate-900 p-2">
          <div class="font-black text-sm text-slate-950">${activeStore?.name || 'Your Flagship Store'}</div>
          <div class="text-slate-600 text-[11px] mt-0.5">${activeStore?.address || 'Operating Headquarters'}</div>
          <div class="mt-2 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            Primary Kirana Base
          </div>
        </div>`
      )
      .addTo(circles);

    // Primary Walkable Catchment (1.5 km - 15 min walk)
    L.circle([storeLat, storeLng], {
      radius: 1500,
      color: '#14b8a6',
      weight: 1.5,
      opacity: 0.8,
      fillColor: '#14b8a6',
      fillOpacity: 0.12,
    })
      .bindTooltip('1.5 km Walking Catchment (68% of In-Store Pickups)', {
        permanent: false,
        direction: 'top',
        className: 'custom-leaflet-tooltip',
      })
      .addTo(circles);

    // Secondary Delivery Reach (3.0 km)
    L.circle([storeLat, storeLng], {
      radius: 3000,
      color: '#0ea5e9',
      weight: 1.2,
      dashArray: '5, 5',
      opacity: 0.6,
      fillColor: '#0ea5e9',
      fillOpacity: 0.04,
    })
      .bindTooltip('3.0 km Hyperlocal Delivery Horizon', {
        permanent: false,
        direction: 'top',
        className: 'custom-leaflet-tooltip',
      })
      .addTo(circles);

    // Simulated Neighbourhood Search Demand Hotspots (surrounding coordinates)
    if (showHotspots) {
      const demandClusters = [
        { dlat: 0.006, dlng: 0.004, label: 'CP Inner Circle', searches: 42, topQuery: 'Atta & Basmati' },
        { dlat: -0.007, dlng: 0.005, label: 'Barakhamba Road', searches: 28, topQuery: 'Amul Milk & Ghee' },
        { dlat: 0.004, dlng: -0.008, label: 'Gol Market', searches: 61, topQuery: 'Maggi & Cooking Oil' },
        { dlat: -0.005, dlng: -0.006, label: 'Janpath Lane', searches: 34, topQuery: 'Tata Salt & Sugar' },
      ];

      demandClusters.forEach((c) => {
        const hLat = storeLat + c.dlat;
        const hLng = storeLng + c.dlng;

        const hotspotIcon = L.divIcon({
          className: 'demand-hotspot-marker',
          html: `
            <div class="group cursor-pointer">
              <div class="px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xl border bg-amber-500/20 text-amber-300 border-amber-500/50 flex items-center gap-1 backdrop-blur-md hover:scale-110 transition">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                <span>${c.searches} Hits</span>
              </div>
            </div>
          `,
          iconSize: [80, 24],
          iconAnchor: [40, 12],
        });

        L.marker([hLat, hLng], { icon: hotspotIcon })
          .bindPopup(
            `<div class="text-xs font-sans text-slate-900 p-2">
              <div class="font-bold text-amber-700 flex items-center gap-1">
                🔥 Demand Cluster: ${c.label}
              </div>
              <div class="text-slate-600 text-[11px] mt-1">${c.searches} recent proximity searches</div>
              <div class="text-[10px] text-slate-500 mt-0.5">Top SKU: <b>${c.topQuery}</b></div>
            </div>`
          )
          .addTo(hotspots);

        // Surrounding faint heat pulse
        L.circle([hLat, hLng], {
          radius: 350,
          color: '#f59e0b',
          weight: 0.8,
          fillColor: '#f59e0b',
          fillOpacity: 0.15,
        }).addTo(hotspots);
      });
    }
  }, [storeLat, storeLng, showHotspots, activeStore]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-teal-400" />
            Hyperlocal Catchment & Customer Demand Map
          </h3>
          <p className="text-xs text-slate-400">
            Real-time visual boundaries for 15-minute pickup radius and customer search clusters.
          </p>
        </div>

        <button
          onClick={() => setShowHotspots(!showHotspots)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition ${
            showHotspots
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>{showHotspots ? 'Demand Clusters: On' : 'Demand Clusters: Off'}</span>
        </button>
      </div>

      <div className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-72 z-0" />

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-[10px] text-slate-300 space-y-1 shadow-lg pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
            <span>1.5 km Core Walking Catchment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full border border-sky-400 border-dashed"></span>
            <span>3.0 km Delivery Horizon</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            <span>Customer Search Hotspots (Live Signals)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
