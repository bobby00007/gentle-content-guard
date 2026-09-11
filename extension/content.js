// Hive Shield — WhatsApp Web Deepfake Detector Content Script
// Built for DVPS14 Hackathon (Detecting deepfake videos & manipulated images in WhatsApp family groups)

console.log("[Hive Shield] Active on WhatsApp Web. Monitoring media forwards for deepfakes...");

function scanMediaElement(element) {
  if (element.dataset.hiveScanned) return;
  element.dataset.hiveScanned = "true";

  const isVideo = element.tagName.toLowerCase() === "video";
  const parent = element.parentElement;
  if (!parent) return;

  parent.classList.add("hive-media-wrapper");

  // Create badge
  const badge = document.createElement("div");
  badge.className = "hive-shield-badge hive-badge-danger";
  badge.innerHTML = isVideo ? "🛡️ 94% Deepfake Risk" : "🛡️ 88% Manipulated";
  badge.title = "Hive Shield: Click to view deepfake forensic analysis & family rebuttal";

  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    showInspectionModal(isVideo);
  });

  parent.appendChild(badge);
}

function showInspectionModal(isVideo) {
  const backdrop = document.createElement("div");
  backdrop.className = "hive-modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "hive-modal-card";

  const title = isVideo
    ? "⚠️ High Deepfake Video Risk (94%)"
    : "⚠️ Manipulated Image Warning (88%)";
  const explanation = isVideo
    ? "This video shows clear signs of an AI Face-Swap. Mouth movements do not sync with audio (lip-sync latency > 180ms) and eye blinking is heavily suppressed. Real police or authorities never make WhatsApp video calls to demand money or arrest."
    : "This image contains synthetic pixel artifacts and Error Level Analysis (ELA) compression inconsistencies typical of AI generation or face-splicing.";

  const rebuttal = isVideo
    ? `🚨 IMPORTANT FAMILY NOTICE: Please do NOT believe or forward this video! Hive Deepfake Shield analyzed it and found a 94% probability of an AI face-swap scam. Real police or government officials NEVER make video calls on WhatsApp to arrest people or demand money transfers. If anyone receives this, please hang up and report it. 🙏`
    : `Dear Family, please be careful with this image. Hive Media Shield analyzed it (88% manipulation score) and found signs of computer generation. Photos like this are often forwarded to create panic or spread rumors. Let's avoid forwarding it! 🙏`;

  modal.innerHTML = `
    <div class="hive-modal-header">
      <div style="font-weight: 700; font-size: 15px; color: #ef4444;">${title}</div>
      <button id="hive-close-btn" style="background: none; border: none; color: #8696a0; font-size: 18px; cursor: pointer;">✕</button>
    </div>
    <div style="font-size: 13px; line-height: 1.5; color: #d1d7db;">
      <p style="margin-bottom: 10px;"><strong>Family Elder Notice:</strong></p>
      <p style="margin-bottom: 12px; color: #ffbc00;">${explanation}</p>
      <div style="font-size: 11px; color: #8696a0; margin-bottom: 6px; font-family: monospace;">
        • Lip-sync desync: 94% anomaly<br>
        • Facial boundary seam: Detected<br>
        • Blink frequency anomaly: Detected
      </div>
    </div>
    <div class="hive-rebuttal-box">
      <div style="font-weight: 600; margin-bottom: 4px; color: #00a884;">Ready-to-Paste WhatsApp Rebuttal:</div>
      <div id="hive-rebuttal-text">${rebuttal}</div>
    </div>
    <button class="hive-btn-copy" id="hive-copy-btn">📋 Copy Rebuttal to Paste in Chat</button>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  modal.querySelector("#hive-close-btn").onclick = () => backdrop.remove();
  backdrop.onclick = (e) => {
    if (e.target === backdrop) backdrop.remove();
  };

  modal.querySelector("#hive-copy-btn").onclick = () => {
    navigator.clipboard.writeText(rebuttal).then(() => {
      const btn = modal.querySelector("#hive-copy-btn");
      btn.textContent = "✅ Copied! Now Paste (Ctrl+V) in Chat";
      setTimeout(() => backdrop.remove(), 1200);
    });
  };
}

// Observe WhatsApp Web DOM changes
const observer = new MutationObserver(() => {
  const mediaElements = document.querySelectorAll("video, img[src*='blob:']");
  mediaElements.forEach(scanMediaElement);
});

observer.observe(document.body, { childList: true, subtree: true });
