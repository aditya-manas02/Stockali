import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Scan,
  Camera,
  Keyboard,
  CheckCircle2,
  AlertCircle,
  Package,
  Sparkles,
  Search,
} from 'lucide-react';
import { playScanSuccessChime } from '../utils/sound';

export const BarcodeScannerModal = ({
  isOpen,
  onClose,
  onBarcodeScanned,
  availableListings = [],
  activeOrder = null,
  onItemVerified = null,
}) => {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [lastScannedItem, setLastScannedItem] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  // Common Kirana Barcodes for rapid 1-click test simulation
  const quickTestBarcodes = [
    { barcode: '8901030000001', name: 'Aashirvaad Shudh Chakki Atta 5kg' },
    { barcode: '8901262010014', name: 'Amul Taaza Homogenised Toned Milk 1L' },
    { barcode: '8901058852331', name: 'Maggi 2-Minute Instant Noodles 70g' },
    { barcode: '8901030383708', name: 'Tata Salt Vacuum Evaporated Iodized 1kg' },
    { barcode: '8901725181222', name: 'Fortune Sunlite Refined Sunflower Oil 1L' },
  ];

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device API not supported in this browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
        startScanningLoop();
      }
    } catch (err) {
      console.warn('Camera initiation failed:', err);
      setCameraError(
        'Camera not accessible or permission denied. You can still scan using the Rapid SKU / Barcode mode below.'
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startScanningLoop = () => {
    // If Browser BarcodeDetector is available
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'qr_code'],
      });

      intervalRef.current = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              handleBarcodeDetected(barcodes[0].rawValue);
            }
          } catch (e) {
            // Ignore frame decode frame drop
          }
        }
      }, 500);
    }
  };

  const handleBarcodeDetected = (rawCode) => {
    playScanSuccessChime();

    // Match against store listings or order items
    const matchedListing = availableListings.find(
      (l) => l.product_variant?.barcode === rawCode || l.barcode === rawCode
    );

    setLastScannedItem({
      code: rawCode,
      matchedListing,
      time: new Date().toLocaleTimeString(),
    });

    if (onBarcodeScanned) {
      onBarcodeScanned(rawCode, matchedListing);
    }

    if (activeOrder && onItemVerified && matchedListing) {
      onItemVerified(matchedListing.id);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeDetected(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Kirana Barcode Scanner Desk</h3>
              <p className="text-xs text-slate-400">Scan items for instant audit or pick-pack verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-2xl bg-slate-950 border border-slate-800">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'camera'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Scanner</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'manual'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Rapid SKU / Test Codes</span>
          </button>
        </div>

        {/* Camera View */}
        {activeTab === 'camera' && (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

              {/* Scanning Target Reticle */}
              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-32 border-2 border-teal-400/80 rounded-2xl relative shadow-lg shadow-teal-500/10">
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-teal-300"></div>
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-teal-300"></div>
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-teal-300"></div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-teal-300"></div>
                    <div className="w-full h-0.5 bg-teal-400/60 animate-pulse absolute top-1/2 -translate-y-1/2"></div>
                  </div>
                </div>
              )}

              {cameraError && (
                <div className="p-4 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-300">{cameraError}</p>
                  <button
                    onClick={() => setActiveTab('manual')}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 text-teal-400 text-xs font-semibold border border-slate-700 hover:bg-slate-700 transition"
                  >
                    Switch to Rapid SKU Mode
                  </button>
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-500 text-center">
              Hold the product barcode steadily within the reticle to scan automatically.
            </p>
          </div>
        )}

        {/* Rapid SKU / Barcode Mode */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Enter barcode or SKU (e.g. 8901030000001)..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition shadow-md shadow-teal-500/20"
              >
                Scan SKU
              </button>
            </form>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Test Kirana Barcodes (1-Click Scan):
              </span>
              <div className="grid grid-cols-1 gap-2">
                {quickTestBarcodes.map((item) => (
                  <button
                    key={item.barcode}
                    type="button"
                    onClick={() => handleBarcodeDetected(item.barcode)}
                    className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left flex items-center justify-between group transition"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-200 group-hover:text-teal-400 transition">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Barcode: {item.barcode}</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/20">
                      Simulate Scan
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Scan Result Feedback Card */}
        {lastScannedItem && (
          <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500 text-slate-950 flex items-center justify-center font-black">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">
                  {lastScannedItem.matchedListing
                    ? lastScannedItem.matchedListing.product_variant?.product?.name || 'Item Matched in Store'
                    : 'Scanned Code: ' + lastScannedItem.code}
                </div>
                <div className="text-[10px] text-teal-400">
                  {lastScannedItem.matchedListing
                    ? `Price: ₹${lastScannedItem.matchedListing.current_price} | In-Stock: ${lastScannedItem.matchedListing.inventory_records?.[0]?.quantity_on_hand ?? 'Verified'}`
                    : 'Barcode logged at ' + lastScannedItem.time}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-teal-300 bg-teal-500/20 px-2 py-0.5 rounded-full border border-teal-500/40">
              Verified ✓
            </span>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
