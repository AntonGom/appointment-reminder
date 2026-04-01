export const BRANDING_TEMPLATE_OPTIONS = [
  {
    id: "signature",
    label: "Glass Ribbon",
    description: "Bright, sculpted, and polished with a premium glass finish."
  },
  {
    id: "spotlight",
    label: "Studio Arc",
    description: "Editorial, airy, and modern with a softer luxury feel."
  },
  {
    id: "executive",
    label: "Executive Slate",
    description: "Darker, sharper, and more formal for executive-facing brands."
  }
];

const DEFAULT_TEMPLATE = "signature";
const DEFAULT_ACCENT = "#2563eb";
const DEFAULT_SECONDARY = "#e8f1ff";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const BUTTON_STYLES = new Set(["pill", "rounded", "crisp", "bubbly", "cloudy", "parallelogram"]);
const PANEL_STYLES = new Set(["rounded", "crisp", "bubbly", "cloudy", "parallelogram"]);
const ART_SHAPES = new Set(["none", "classic", "orbit", "stacked", "ribbon", "prism", "frame", "halo", "cascade", "split", "random"]);
const REAL_ART_SHAPES = ["classic", "orbit", "stacked", "ribbon", "prism", "frame", "halo", "cascade", "split"];
const SHAPE_INTENSITIES = new Set(["soft", "balanced", "bold"]);
const SHINE_STYLES = new Set(["on", "off"]);
const MOTION_STYLES = new Set(["showcase", "float", "pulse", "still"]);
const HERO_GRADIENT_STYLES = new Set(["signature", "spotlight", "split", "solid"]);

export const TEMPLATE_STYLE_PRESETS = Object.freeze({
  signature: Object.freeze({
    accentColor: "#2563eb",
    secondaryColor: "#e8f1ff",
    buttonStyle: "pill",
    panelShape: "rounded",
    artShape: "classic",
    shapeIntensity: "balanced",
    shineStyle: "on",
    motionStyle: "showcase",
    heroGradientStyle: "signature"
  }),
  spotlight: Object.freeze({
    accentColor: "#0f766e",
    secondaryColor: "#e6fbf4",
    buttonStyle: "rounded",
    panelShape: "rounded",
    artShape: "ribbon",
    shapeIntensity: "soft",
    shineStyle: "on",
    motionStyle: "float",
    heroGradientStyle: "spotlight"
  }),
  executive: Object.freeze({
    accentColor: "#0f172a",
    secondaryColor: "#dbe2ea",
    buttonStyle: "crisp",
    panelShape: "crisp",
    artShape: "frame",
    shapeIntensity: "bold",
    shineStyle: "off",
    motionStyle: "still",
    heroGradientStyle: "split"
  })
});

export function hasSavedBrandingProfile(profile = null) {
  return Boolean(cleanText(profile?.businessName, 80));
}

export function buildReminderEmailSubject(brandingProfile, options = {}) {
  const parsed = parseReminderMessage(options.message || "");
  const dateItem = parsed.summary.find(item => item.label === "Date");
  const timeItem = parsed.summary.find(item => item.label === "Time");
  const baseSubject = dateItem
    ? `Appointment Reminder for ${dateItem.value}${timeItem ? ` at ${timeItem.value}` : ""}`
    : "Appointment Reminder";

  if (!hasSavedBrandingProfile(brandingProfile) || brandingProfile?.brandingEnabled === false) {
    return baseSubject;
  }

  const businessName = normalizeBrandingProfile(brandingProfile).businessName;
  return businessName ? `${baseSubject} from ${businessName}` : baseSubject;
}

export function normalizeBrandingProfile(profile = {}, options = {}) {
  const forPreview = Boolean(options.forPreview);
  const fallbackEmail = normalizeEmail(options.fallbackEmail || "");
  const templateStyle = BRANDING_TEMPLATE_OPTIONS.some(option => option.id === profile?.templateStyle)
    ? profile.templateStyle
    : DEFAULT_TEMPLATE;
  const templatePreset = TEMPLATE_STYLE_PRESETS[templateStyle] || TEMPLATE_STYLE_PRESETS.signature;

  const businessName = cleanText(profile?.businessName, 80);
  const tagline = cleanText(profile?.tagline, 120);
  const headerLabel = cleanText(profile?.headerLabel, 50);
  const accentColor = normalizeHexColor(profile?.accentColor) || templatePreset.accentColor || DEFAULT_ACCENT;
  const secondaryColor = normalizeHexColor(profile?.secondaryColor) || templatePreset.secondaryColor || DEFAULT_SECONDARY;
  const logoUrl = normalizeUrl(profile?.logoUrl);
  const brandingEnabled = profile?.brandingEnabled !== false;
  const buttonStyle = BUTTON_STYLES.has(profile?.buttonStyle) ? profile.buttonStyle : templatePreset.buttonStyle || "pill";
  const panelShape = PANEL_STYLES.has(profile?.panelShape) ? profile.panelShape : templatePreset.panelShape || "rounded";
  const artShape = ART_SHAPES.has(profile?.artShape) ? profile.artShape : templatePreset.artShape || "classic";
  const shapeIntensity = SHAPE_INTENSITIES.has(profile?.shapeIntensity) ? profile.shapeIntensity : templatePreset.shapeIntensity || "balanced";
  const shineStyle = SHINE_STYLES.has(profile?.shineStyle) ? profile.shineStyle : templatePreset.shineStyle || "on";
  const motionStyle = MOTION_STYLES.has(profile?.motionStyle) ? profile.motionStyle : templatePreset.motionStyle || "showcase";
  const heroGradientStyle = HERO_GRADIENT_STYLES.has(profile?.heroGradientStyle) ? profile.heroGradientStyle : templatePreset.heroGradientStyle || "signature";
  const contactEmail = normalizeEmail(profile?.contactEmail) || (forPreview ? fallbackEmail || "hello@yourbusiness.com" : fallbackEmail);
  const contactPhone = cleanText(profile?.contactPhone, 40);
  const websiteUrl = normalizeUrl(profile?.websiteUrl);
  const rescheduleUrl = normalizeUrl(profile?.rescheduleUrl);

  return {
    templateStyle,
    businessName: businessName || (forPreview ? "North Shore Wellness" : ""),
    tagline: tagline || (forPreview ? "Friendly appointment reminders that feel polished and trustworthy." : ""),
    headerLabel: headerLabel || (forPreview ? "Appointment reminder" : ""),
    accentColor,
    secondaryColor,
    logoUrl,
    brandingEnabled,
    buttonStyle,
    panelShape,
    artShape,
    shapeIntensity,
    shineStyle,
    motionStyle,
    heroGradientStyle,
    contactEmail,
    contactPhone: contactPhone || (forPreview ? "(305) 555-0188" : ""),
    websiteUrl,
    rescheduleUrl
  };
}

export function buildReminderEmailHtml({ message, calendarLinks = null, brandingProfile = null, previewMode = false, randomSeed = 0 } = {}) {
  const normalizedBranding = normalizeBrandingProfile(brandingProfile, { forPreview: previewMode });
  const branding = {
    ...normalizedBranding,
    resolvedArtShape: resolveArtShape(normalizedBranding.artShape, randomSeed)
  };

  if (!previewMode && (!hasSavedBrandingProfile(brandingProfile) || brandingProfile?.brandingEnabled === false)) {
    return buildDefaultReminderEmail(message, calendarLinks);
  }

  if (branding.brandingEnabled === false) {
    return buildDefaultReminderEmail(message, calendarLinks, { includePreviewStyles: previewMode });
  }

  return buildProductionBrandedEmail({
    message,
    calendarLinks,
    branding,
    includePreviewStyles: previewMode
  });
}

function buildPreviewFocusStyles() {
  return `
    <style>
      * { box-sizing: border-box; }
      [data-preview-area] {
        transition: outline-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
      }
      [data-preview-area].preview-focus {
        outline: 3px solid rgba(239, 68, 68, 0.88);
        outline-offset: 5px;
        border-radius: 22px;
        box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.16);
      }
    </style>
  `;
}

function resolveArtShape(artShape, randomSeed = 0) {
  if (artShape && artShape !== "random") {
    return artShape;
  }

  const seed = Number.isFinite(randomSeed) && randomSeed > 0 ? randomSeed : Date.now();
  return REAL_ART_SHAPES[Math.abs(seed) % REAL_ART_SHAPES.length];
}

function buildEmailContent({ message, branding, calendarLinks }) {
  const parsed = parseReminderMessage(message);
  const surfaceStyle = buildSurfaceStyle(branding.panelShape);
  const greeting = parsed.greeting ? `<div style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 14px;">${escapeHtml(parsed.greeting)}</div>` : "";
  const intro = parsed.intro ? `<div style="font-size:15px;line-height:1.7;color:#334155;margin:0 0 18px;">${escapeHtml(parsed.intro)}</div>` : "";
  const summaryHtml = parsed.summary.length
    ? `<div data-preview-area="secondary" style="display:grid;grid-template-columns:repeat(${Math.min(parsed.summary.length, 3)}, minmax(0, 1fr));gap:10px;margin:0 0 18px;">
        ${parsed.summary.map(item => `
          <div style="${surfaceStyle}padding:14px 16px;background:linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.94));border:1px solid ${hexToRgba(branding.accentColor, 0.18)};box-shadow:0 10px 18px rgba(15,23,42,0.04);">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${branding.accentColor};margin:0 0 6px;">${escapeHtml(item.label)}</div>
            <div style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.45;">${escapeHtml(item.value)}</div>
          </div>`).join("")}
      </div>`
    : "";
  const detailsHtml = parsed.details
    ? `<div data-preview-area="secondary" style="margin:0 0 18px;${surfaceStyle}padding:16px 18px;background:linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96));border:1px solid ${hexToRgba(branding.accentColor, 0.12)};box-shadow:0 12px 22px rgba(15,23,42,0.05);">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;margin:0 0 8px;">Additional details</div>
        <div style="font-size:15px;line-height:1.7;color:#0f172a;">${escapeHtml(parsed.details).replace(/\n/g, "<br>")}</div>
      </div>`
    : "";
  const bodyHtml = parsed.body.length
    ? parsed.body.map(paragraph => `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:#334155;">${escapeHtml(paragraph)}</p>`).join("")
    : "";
  const contactPrompt = parsed.contactPrompt
    ? `<p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#334155;">${escapeHtml(parsed.contactPrompt)}</p>`
    : "";
  const closing = parsed.closing
    ? `<div style="font-size:15px;font-weight:700;color:#0f172a;margin-top:8px;">${escapeHtml(parsed.closing)}</div>`
    : "";
  const ctaButtons = buildActionButtons(branding);
  const calendarSection = buildCalendarSection(calendarLinks, branding);
  const footerContact = buildFooterContactLine(branding);
  const businessName = escapeHtml(branding.businessName || "Appointment Reminder");
  const heroLabel = escapeHtml(branding.headerLabel || "Appointment reminder");
  const tagline = branding.tagline ? `<div style="font-size:14px;line-height:1.65;color:#dbe7ff;margin-top:8px;">${escapeHtml(branding.tagline)}</div>` : "";
  const logoMarkup = branding.logoUrl
    ? `<img src="${escapeAttribute(branding.logoUrl)}" alt="${businessName} logo" style="width:52px;height:52px;border-radius:18px;display:block;object-fit:cover;background:#ffffff;border:1px solid rgba(255,255,255,0.35);">`
    : `<div style="width:52px;height:52px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);color:#ffffff;font-size:18px;font-weight:800;">${escapeHtml(getInitials(branding.businessName || "AR"))}</div>`;

  return {
    brand: branding,
    logoMarkup,
    brandTitle: businessName,
    heroLabel,
    tagline,
    greeting,
    intro,
    summaryHtml,
    detailsHtml,
    bodyHtml,
    contactPrompt,
    closing,
    ctaButtons,
    calendarSection,
    footerContact
  };
}

function buildHeroContactChips(branding, palette = {}) {
  const items = [branding.contactPhone, branding.contactEmail, formatUrlLabel(branding.websiteUrl)].filter(Boolean).slice(0, 3);

  if (!items.length) {
    return "";
  }

  const background = palette.background || "rgba(255,255,255,0.14)";
  const border = palette.border || "rgba(255,255,255,0.22)";
  const color = palette.color || "#ffffff";

  return `
    <div data-preview-area="contact" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;">
      ${items.map(item => `
        <span style="display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:999px;background:${background};border:1px solid ${border};color:${color};font-size:13px;font-weight:700;line-height:1.4;">
          ${escapeHtml(item)}
        </span>
      `).join("")}
    </div>
  `;
}

function buildHeroArtBlock(branding, options = {}) {
  const accentColor = options.accentColor || branding.accentColor || DEFAULT_ACCENT;
  const shapeProfile = getShapeProfile(branding.shapeIntensity);
  const auraColor = options.auraColor || hexToRgba(accentColor, 0.32);
  const shardColor = options.shardColor || "rgba(255,255,255,0.72)";
  const shardSecondary = options.shardSecondary || hexToRgba(branding.secondaryColor || accentColor, 0.24);
  const markBackground = options.markBackground || `linear-gradient(180deg, rgba(255,255,255,0.88), ${hexToRgba(branding.secondaryColor || accentColor, 0.72)})`;
  const markBorder = options.markBorder || "rgba(255,255,255,0.46)";
  const markTextColor = options.markTextColor || "#0f172a";
  const lineColor = options.lineColor || "rgba(255,255,255,0.86)";
  const artShape = branding.resolvedArtShape || branding.artShape || "classic";
  const initials = escapeHtml(getInitials(branding.businessName || "AR"));

  if (artShape === "none") {
    return "";
  }

  return `
    <div data-preview-area="art" style="position:relative;height:${shapeProfile.heroHeight}px;">
      <div style="position:absolute;right:${shapeProfile.auraRight}px;top:${shapeProfile.auraTop}px;width:${shapeProfile.auraSize}px;height:${shapeProfile.auraSize}px;border-radius:999px;background:radial-gradient(circle, ${auraColor}, rgba(255,255,255,0));filter:blur(4px);opacity:${shapeProfile.auraOpacity};"></div>
      ${buildHeroArtShape({ artShape, branding, shapeProfile, accentColor, shardColor, shardSecondary, lineColor })}
      ${buildHeroMark({ artShape, shapeProfile, markBackground, markBorder, markTextColor, lineColor, initials })}
    </div>
  `;
}

function shouldRenderHeroArt(branding) {
  const artShape = branding?.resolvedArtShape || branding?.artShape || "classic";
  return artShape !== "none";
}

function buildHeroArtShape({ artShape, branding, shapeProfile, accentColor, shardColor, shardSecondary, lineColor }) {
  if (artShape === "orbit") {
    return `
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 40}px;top:${shapeProfile.shardOneTop + 8}px;width:${shapeProfile.markWidth + 28}px;height:${shapeProfile.markHeight + 10}px;border-radius:999px;border:2px solid ${hexToRgba(accentColor, 0.34)};"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 18}px;top:${shapeProfile.shardTwoTop + 26}px;width:${shapeProfile.markWidth - 22}px;height:${shapeProfile.markHeight - 36}px;border-radius:999px;border:2px solid ${hexToRgba(branding.secondaryColor || accentColor, 0.58)};"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight + 26}px;top:${shapeProfile.shardTwoTop + 44}px;width:18px;height:18px;border-radius:999px;background:${hexToRgba(accentColor, 0.72)};"></div>
      <div style="position:absolute;right:${shapeProfile.shardOneRight + 10}px;top:${shapeProfile.shardOneTop + 12}px;width:32px;height:${shapeProfile.shardOneHeight}px;border-radius:16px;transform:skew(-24deg);background:linear-gradient(180deg, ${shardColor}, ${shardSecondary});"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight + 4}px;top:${shapeProfile.shardThreeTop + 10}px;width:28px;height:${shapeProfile.shardThreeHeight}px;border-radius:16px;transform:skew(-24deg);background:linear-gradient(180deg, ${hexToRgba(accentColor, 0.3)}, rgba(255,255,255,0.04));"></div>
    `;
  }

  if (artShape === "stacked") {
    return `
      <div style="position:absolute;right:${shapeProfile.shardOneRight + 16}px;top:${shapeProfile.shardOneTop}px;width:${shapeProfile.shardWidth + 8}px;height:${shapeProfile.shardOneHeight}px;border-radius:18px;transform:skew(-20deg);background:linear-gradient(180deg, ${shardColor}, ${shardSecondary});"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 6}px;top:${shapeProfile.shardTwoTop + 8}px;width:${shapeProfile.shardWidth + 12}px;height:${shapeProfile.shardTwoHeight + 12}px;border-radius:18px;transform:skew(-20deg);background:linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.06));"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight + 26}px;top:${shapeProfile.shardThreeTop + 18}px;width:${shapeProfile.shardWidth + 6}px;height:${shapeProfile.shardThreeHeight + 18}px;border-radius:18px;transform:skew(-20deg);background:linear-gradient(180deg, ${hexToRgba(accentColor, 0.34)}, rgba(255,255,255,0.04));"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 52}px;top:${shapeProfile.shardThreeTop + 2}px;width:${shapeProfile.shardWidth - 6}px;height:${shapeProfile.shardThreeHeight - 8}px;border-radius:18px;transform:skew(-20deg);background:linear-gradient(180deg, ${hexToRgba(branding.secondaryColor || accentColor, 0.64)}, rgba(255,255,255,0.06));"></div>
    `;
  }

  if (artShape === "ribbon") {
    return `
      <div style="position:absolute;right:${shapeProfile.shardOneRight + 22}px;top:${shapeProfile.shardOneTop + 8}px;width:118px;height:18px;border-radius:999px;background:linear-gradient(90deg, ${hexToRgba(accentColor, 0.6)}, rgba(255,255,255,0.12));transform:rotate(-28deg);"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 8}px;top:${shapeProfile.shardTwoTop + 34}px;width:96px;height:16px;border-radius:999px;background:linear-gradient(90deg, ${hexToRgba(branding.secondaryColor || accentColor, 0.74)}, rgba(255,255,255,0.12));transform:rotate(-28deg);"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight + 40}px;top:${shapeProfile.shardThreeTop + 54}px;width:84px;height:14px;border-radius:999px;background:linear-gradient(90deg, rgba(255,255,255,0.68), rgba(255,255,255,0.04));transform:rotate(-28deg);"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 70}px;top:${shapeProfile.shardTwoTop + 4}px;width:18px;height:${shapeProfile.markHeight - 8}px;border-radius:999px;background:linear-gradient(180deg, ${hexToRgba(accentColor, 0.36)}, rgba(255,255,255,0.06));"></div>
    `;
  }

  if (artShape === "prism") {
    return `
      <div style="position:absolute;right:${shapeProfile.shardOneRight + 30}px;top:${shapeProfile.shardOneTop + 10}px;width:44px;height:44px;border-radius:12px;transform:rotate(45deg);background:linear-gradient(180deg, ${shardColor}, ${shardSecondary});"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 2}px;top:${shapeProfile.shardTwoTop + 14}px;width:34px;height:34px;border-radius:10px;transform:rotate(45deg);background:linear-gradient(180deg, ${hexToRgba(accentColor, 0.54)}, rgba(255,255,255,0.08));"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight + 24}px;top:${shapeProfile.shardThreeTop + 48}px;width:26px;height:26px;border-radius:8px;transform:rotate(45deg);background:linear-gradient(180deg, ${hexToRgba(branding.secondaryColor || accentColor, 0.74)}, rgba(255,255,255,0.06));"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 58}px;top:${shapeProfile.shardOneTop + 54}px;width:20px;height:${shapeProfile.markHeight - 18}px;border-radius:999px;background:linear-gradient(180deg, rgba(255,255,255,0.56), rgba(255,255,255,0.04));"></div>
    `;
  }

  if (artShape === "frame") {
    return `
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 16}px;top:${shapeProfile.shardOneTop + 8}px;width:${shapeProfile.markWidth + 24}px;height:${shapeProfile.markHeight + 10}px;border-radius:28px;border:2px solid ${hexToRgba(accentColor, 0.38)};"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 30}px;top:${shapeProfile.shardTwoTop + 18}px;width:${shapeProfile.markWidth - 8}px;height:${shapeProfile.markHeight - 18}px;border-radius:24px;border:2px solid ${hexToRgba(branding.secondaryColor || accentColor, 0.66)};"></div>
      <div style="position:absolute;right:${shapeProfile.shardOneRight + 12}px;top:${shapeProfile.shardOneTop + 16}px;width:26px;height:${shapeProfile.shardOneHeight - 18}px;border-radius:16px;transform:skew(-22deg);background:linear-gradient(180deg, ${shardColor}, rgba(255,255,255,0.04));"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight + 20}px;top:${shapeProfile.shardThreeTop + 18}px;width:26px;height:${shapeProfile.shardThreeHeight + 12}px;border-radius:16px;transform:skew(-22deg);background:linear-gradient(180deg, ${hexToRgba(accentColor, 0.28)}, rgba(255,255,255,0.04));"></div>
    `;
  }

  if (artShape === "halo") {
    return `
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 8}px;top:${shapeProfile.shardOneTop - 2}px;width:${shapeProfile.markWidth + 40}px;height:${shapeProfile.markWidth + 40}px;border-radius:999px;border:2px solid ${hexToRgba(accentColor, 0.28)};"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 28}px;top:${shapeProfile.shardOneTop + 18}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markWidth}px;border-radius:999px;border:2px dashed ${hexToRgba(branding.secondaryColor || accentColor, 0.62)};"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight + 16}px;top:${shapeProfile.shardThreeTop + 8}px;width:16px;height:16px;border-radius:999px;background:${hexToRgba(accentColor, 0.84)};"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight + 58}px;top:${shapeProfile.shardThreeTop + 34}px;width:12px;height:12px;border-radius:999px;background:${hexToRgba(branding.secondaryColor || accentColor, 0.88)};"></div>
      <div style="position:absolute;right:${shapeProfile.shardOneRight + 8}px;top:${shapeProfile.shardTwoTop + 18}px;width:22px;height:${shapeProfile.shardOneHeight + 12}px;border-radius:999px;background:linear-gradient(180deg, ${hexToRgba(accentColor, 0.32)}, rgba(255,255,255,0.04));"></div>
    `;
  }

  if (artShape === "cascade") {
    return `
      <div style="position:absolute;right:${shapeProfile.shardOneRight + 44}px;top:${shapeProfile.shardOneTop + 2}px;width:${shapeProfile.shardWidth + 24}px;height:${shapeProfile.shardOneHeight + 4}px;border-radius:18px;transform:skew(-16deg);background:linear-gradient(180deg, ${shardColor}, ${shardSecondary});"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 18}px;top:${shapeProfile.shardTwoTop + 22}px;width:${shapeProfile.shardWidth + 12}px;height:${shapeProfile.shardTwoHeight + 10}px;border-radius:18px;transform:skew(-16deg);background:linear-gradient(180deg, ${hexToRgba(branding.secondaryColor || accentColor, 0.74)}, rgba(255,255,255,0.06));"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight - 2}px;top:${shapeProfile.shardThreeTop + 50}px;width:${shapeProfile.shardWidth + 2}px;height:${shapeProfile.shardThreeHeight + 18}px;border-radius:18px;transform:skew(-16deg);background:linear-gradient(180deg, ${hexToRgba(accentColor, 0.56)}, rgba(255,255,255,0.04));"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 72}px;top:${shapeProfile.shardOneTop + 56}px;width:${shapeProfile.shardWidth - 16}px;height:${shapeProfile.shardThreeHeight - 6}px;border-radius:18px;transform:skew(-16deg);background:linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.04));"></div>
    `;
  }

  if (artShape === "split") {
    return `
      <div style="position:absolute;right:${shapeProfile.shardOneRight + 52}px;top:${shapeProfile.shardOneTop + 4}px;width:34px;height:${shapeProfile.markHeight + 8}px;border-radius:18px;transform:skew(-20deg);background:linear-gradient(180deg, ${shardColor}, ${shardSecondary});"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 2}px;top:${shapeProfile.shardTwoTop + 12}px;width:34px;height:${shapeProfile.markHeight - 12}px;border-radius:18px;transform:skew(-20deg);background:linear-gradient(180deg, ${hexToRgba(accentColor, 0.58)}, rgba(255,255,255,0.06));"></div>
      <div style="position:absolute;right:${shapeProfile.shardTwoRight + 42}px;top:${shapeProfile.shardTwoTop + 18}px;width:${shapeProfile.markWidth - 24}px;height:6px;border-radius:999px;background:${hexToRgba(branding.secondaryColor || accentColor, 0.72)};transform:rotate(-24deg);"></div>
      <div style="position:absolute;right:${shapeProfile.shardThreeRight + 34}px;top:${shapeProfile.shardThreeTop + 62}px;width:${shapeProfile.markWidth - 30}px;height:6px;border-radius:999px;background:${hexToRgba(accentColor, 0.42)};transform:rotate(-24deg);"></div>
    `;
  }

  return `
    <div style="position:absolute;right:${shapeProfile.shardOneRight}px;top:${shapeProfile.shardOneTop}px;width:${shapeProfile.shardWidth}px;height:${shapeProfile.shardOneHeight}px;border-radius:16px;transform:skew(-24deg);background:linear-gradient(180deg, ${shardColor}, ${shardSecondary});"></div>
    <div style="position:absolute;right:${shapeProfile.shardTwoRight}px;top:${shapeProfile.shardTwoTop}px;width:${shapeProfile.shardWidth}px;height:${shapeProfile.shardTwoHeight}px;border-radius:16px;transform:skew(-24deg);background:linear-gradient(180deg, ${shardColor}, rgba(255,255,255,0.06));"></div>
    <div style="position:absolute;right:${shapeProfile.shardThreeRight}px;top:${shapeProfile.shardThreeTop}px;width:${shapeProfile.shardWidth}px;height:${shapeProfile.shardThreeHeight}px;border-radius:16px;transform:skew(-24deg);background:linear-gradient(180deg, ${hexToRgba(accentColor, 0.26)}, rgba(255,255,255,0.04));"></div>
  `;
}

function buildHeroMark({ artShape, shapeProfile, markBackground, markBorder, markTextColor, lineColor, initials }) {
  if (artShape === "orbit") {
    return `
      <div style="position:absolute;right:${shapeProfile.markRight + 4}px;top:${shapeProfile.markTop + 6}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markWidth}px;border-radius:999px;background:${markBackground};border:1px solid ${markBorder};box-shadow:0 18px 30px rgba(15,23,42,0.14);overflow:hidden;">
        <div style="position:absolute;inset:12px;border-radius:999px;border:2px solid ${lineColor};opacity:0.84;"></div>
        <div style="position:absolute;inset:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.14);color:${markTextColor};font-size:24px;font-weight:900;letter-spacing:-0.04em;">${initials}</div>
      </div>
    `;
  }

  if (artShape === "stacked") {
    return `
      <div style="position:absolute;right:${shapeProfile.markRight + 16}px;top:${shapeProfile.markTop + 8}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markHeight}px;border-radius:22px;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.18);"></div>
      <div style="position:absolute;right:${shapeProfile.markRight + 8}px;top:${shapeProfile.markTop + 4}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markHeight}px;border-radius:24px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.16);"></div>
      <div style="position:absolute;right:${shapeProfile.markRight}px;top:${shapeProfile.markTop}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markHeight}px;border-radius:26px;background:${markBackground};border:1px solid ${markBorder};box-shadow:0 18px 30px rgba(15,23,42,0.14);overflow:hidden;">
        <div style="position:absolute;inset:16px;border-radius:20px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.14);color:${markTextColor};font-size:26px;font-weight:900;letter-spacing:-0.04em;">${initials}</div>
      </div>
    `;
  }

  if (artShape === "ribbon") {
    return `
      <div style="position:absolute;right:${shapeProfile.markRight - 6}px;top:${shapeProfile.markTop + 10}px;width:${shapeProfile.markWidth + 12}px;height:${shapeProfile.markHeight - 10}px;border-radius:999px;background:${markBackground};border:1px solid ${markBorder};box-shadow:0 18px 30px rgba(15,23,42,0.14);overflow:hidden;transform:skew(-16deg);">
        <div style="position:absolute;top:-8px;left:36px;width:4px;height:144px;border-radius:999px;background:${lineColor};transform:skew(-12deg);"></div>
        <div style="position:absolute;top:-8px;left:64px;width:4px;height:144px;border-radius:999px;background:${lineColor};transform:skew(-12deg);"></div>
        <div style="position:absolute;inset:16px 20px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.16);color:${markTextColor};font-size:24px;font-weight:900;letter-spacing:-0.04em;transform:skew(16deg);">${initials}</div>
      </div>
    `;
  }

  if (artShape === "prism") {
    return `
      <div style="position:absolute;right:${shapeProfile.markRight + 6}px;top:${shapeProfile.markTop + 8}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markWidth}px;transform:rotate(45deg);border-radius:24px;background:${markBackground};border:1px solid ${markBorder};box-shadow:0 18px 30px rgba(15,23,42,0.14);overflow:hidden;">
        <div style="position:absolute;inset:18px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.16);color:${markTextColor};font-size:24px;font-weight:900;letter-spacing:-0.04em;transform:rotate(-45deg);">${initials}</div>
      </div>
    `;
  }

  if (artShape === "frame") {
    return `
      <div style="position:absolute;right:${shapeProfile.markRight}px;top:${shapeProfile.markTop}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markHeight}px;border-radius:28px;background:rgba(255,255,255,0.08);border:2px solid ${markBorder};box-shadow:0 18px 30px rgba(15,23,42,0.14);overflow:hidden;">
        <div style="position:absolute;inset:10px;border-radius:22px;border:2px solid ${lineColor};opacity:0.88;"></div>
        <div style="position:absolute;inset:24px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:${markBackground};color:${markTextColor};font-size:26px;font-weight:900;letter-spacing:-0.04em;">${initials}</div>
      </div>
    `;
  }

  if (artShape === "halo") {
    return `
      <div style="position:absolute;right:${shapeProfile.markRight + 6}px;top:${shapeProfile.markTop + 4}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markWidth}px;border-radius:999px;background:${markBackground};border:1px solid ${markBorder};box-shadow:0 18px 30px rgba(15,23,42,0.14);overflow:hidden;">
        <div style="position:absolute;inset:10px;border-radius:999px;border:2px solid ${lineColor};opacity:0.84;"></div>
        <div style="position:absolute;inset:20px;border-radius:999px;border:2px solid ${hexToRgba(markTextColor, 0.16)};"></div>
        <div style="position:absolute;inset:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.16);color:${markTextColor};font-size:24px;font-weight:900;letter-spacing:-0.04em;">${initials}</div>
      </div>
    `;
  }

  if (artShape === "cascade") {
    return `
      <div style="position:absolute;right:${shapeProfile.markRight + 12}px;top:${shapeProfile.markTop + 4}px;width:${shapeProfile.markWidth + 8}px;height:${shapeProfile.markHeight}px;border-radius:26px;background:${markBackground};border:1px solid ${markBorder};box-shadow:0 18px 30px rgba(15,23,42,0.14);overflow:hidden;">
        <div style="position:absolute;inset:14px 18px 42px 18px;border-radius:18px;background:rgba(255,255,255,0.18);"></div>
        <div style="position:absolute;left:18px;right:18px;bottom:18px;height:18px;border-radius:999px;background:${lineColor};opacity:0.72;"></div>
        <div style="position:absolute;inset:18px;border-radius:20px;display:flex;align-items:center;justify-content:center;color:${markTextColor};font-size:26px;font-weight:900;letter-spacing:-0.04em;">${initials}</div>
      </div>
    `;
  }

  if (artShape === "split") {
    return `
      <div style="position:absolute;right:${shapeProfile.markRight + 6}px;top:${shapeProfile.markTop + 6}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markHeight}px;border-radius:24px;background:${markBackground};border:1px solid ${markBorder};box-shadow:0 18px 30px rgba(15,23,42,0.14);overflow:hidden;">
        <div style="position:absolute;left:50%;top:-10px;width:5px;height:160px;border-radius:999px;background:${lineColor};transform:translateX(-50%) skew(-20deg);"></div>
        <div style="position:absolute;inset:16px 18px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.06));color:${markTextColor};font-size:25px;font-weight:900;letter-spacing:-0.04em;">${initials}</div>
      </div>
    `;
  }

  return `
    <div style="position:absolute;right:${shapeProfile.markRight}px;top:${shapeProfile.markTop}px;width:${shapeProfile.markWidth}px;height:${shapeProfile.markHeight}px;border-radius:28px;background:${markBackground};border:1px solid ${markBorder};box-shadow:0 18px 30px rgba(15,23,42,0.14);overflow:hidden;">
      <div style="position:absolute;top:-10px;left:30px;width:4px;height:144px;border-radius:999px;background:${lineColor};transform:skew(-24deg);"></div>
      <div style="position:absolute;top:-10px;left:58px;width:4px;height:144px;border-radius:999px;background:${lineColor};transform:skew(-24deg);"></div>
      <div style="position:absolute;inset:16px;border-radius:22px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.14);color:${markTextColor};font-size:26px;font-weight:900;letter-spacing:-0.04em;">${initials}</div>
    </div>
  `;
}

function buildSignatureTemplate(content, options = {}) {
  const includePreviewStyles = Boolean(options.includePreviewStyles);
  const hasHeroArt = shouldRenderHeroArt(content.brand);
  const heroColumns = hasHeroArt ? "minmax(0, 1fr) 188px" : "minmax(0, 1fr)";
  return `
    ${includePreviewStyles ? buildPreviewFocusStyles() : ""}
    <div style="margin:0;padding:34px 16px;background:
      radial-gradient(circle at top left, ${hexToRgba(content.brand.accentColor, 0.18)}, transparent 34%),
      linear-gradient(180deg, #f6f9ff, #f8fbff);font-family:Arial, sans-serif;">
      <div style="max-width:700px;margin:0 auto;background:rgba(255,255,255,0.94);border:1px solid rgba(255,255,255,0.82);border-radius:34px;overflow:hidden;box-shadow:0 28px 60px rgba(15,23,42,0.16);">
        <div data-preview-area="hero" style="padding:28px;background:
          radial-gradient(circle at top right, ${hexToRgba(content.brand.secondaryColor, 0.88)}, transparent 26%),
          linear-gradient(135deg, ${content.brand.accentColor} 0%, ${hexToRgba(content.brand.accentColor, 0.72)} 56%, #111827 100%);">
          <div style="display:grid;grid-template-columns:${heroColumns};gap:18px;align-items:center;">
            <div>
              <div style="display:flex;align-items:center;gap:16px;">
                <div data-preview-area="logo">${content.logoMarkup}</div>
                <div>
                  <div data-preview-area="hero-label" style="font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:rgba(219,234,254,0.92);">${content.heroLabel}</div>
                  <div style="font-size:31px;line-height:1.02;font-weight:800;color:#ffffff;margin-top:6px;">${content.brandTitle}</div>
                </div>
              </div>
              ${content.tagline}
              ${buildHeroContactChips(content.brand, {
                background: "rgba(255,255,255,0.14)",
                border: "rgba(255,255,255,0.2)",
                color: "#ffffff"
              })}
            </div>
            ${hasHeroArt ? buildHeroArtBlock(content.brand, {
              accentColor: content.brand.accentColor,
              auraColor: hexToRgba(content.brand.accentColor, 0.36),
              shardColor: "rgba(255,255,255,0.74)",
              shardSecondary: hexToRgba(content.brand.secondaryColor, 0.28),
              markBackground: `linear-gradient(180deg, rgba(255,255,255,0.82), ${hexToRgba(content.brand.secondaryColor, 0.5)})`,
              markBorder: "rgba(255,255,255,0.34)",
              markTextColor: "#0f172a"
            }) : ""}
          </div>
        </div>
        <div style="padding:28px;">
          ${content.greeting}
          ${content.intro}
          ${content.summaryHtml}
          ${content.detailsHtml}
          ${content.bodyHtml}
          ${content.contactPrompt}
          ${content.ctaButtons}
          ${content.calendarSection}
          ${content.closing}
        </div>
        <div data-preview-area="footer" style="padding:18px 28px;border-top:1px solid rgba(203,213,225,0.72);background:rgba(248,250,252,0.92);color:#64748b;font-size:13px;line-height:1.7;">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">${content.brandTitle}</div>
          ${content.footerContact}
        </div>
      </div>
    </div>
  `;
}

function buildSpotlightTemplate(content, options = {}) {
  const includePreviewStyles = Boolean(options.includePreviewStyles);
  const hasHeroArt = shouldRenderHeroArt(content.brand);
  const heroColumns = hasHeroArt ? "minmax(0, 1fr) 188px" : "minmax(0, 1fr)";
  return `
    ${includePreviewStyles ? buildPreviewFocusStyles() : ""}
    <div style="margin:0;padding:30px 14px;background:
      radial-gradient(circle at top left, ${hexToRgba(content.brand.accentColor, 0.12)}, transparent 32%),
      linear-gradient(180deg, #f8fbff, #f6f9ff);font-family:Arial, sans-serif;">
      <div style="max-width:700px;margin:0 auto;background:rgba(255,255,255,0.96);border:1px solid ${hexToRgba(content.brand.accentColor, 0.16)};border-radius:34px;overflow:hidden;box-shadow:0 24px 54px rgba(15,23,42,0.11);">
        <div data-preview-area="hero" style="padding:24px 26px;background:
          radial-gradient(circle at top right, ${hexToRgba(content.brand.secondaryColor, 0.78)}, transparent 20%),
          linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94) 52%, ${hexToRgba(content.brand.accentColor, 0.1)});border-bottom:1px solid ${hexToRgba(content.brand.accentColor, 0.14)};">
          <div style="display:grid;grid-template-columns:${heroColumns};gap:18px;align-items:center;">
            <div>
              <div style="display:flex;align-items:center;gap:14px;">
                <div data-preview-area="logo">${content.logoMarkup}</div>
                <div>
                  <div data-preview-area="hero-label" style="font-size:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${content.brand.accentColor};">${content.heroLabel}</div>
                  <div style="font-size:30px;line-height:1.03;font-weight:800;color:#0f172a;margin-top:5px;">${content.brandTitle}</div>
                </div>
              </div>
              ${content.brand.tagline ? `<div style="font-size:14px;line-height:1.7;color:#475569;margin-top:10px;">${escapeHtml(content.brand.tagline)}</div>` : ""}
              ${buildHeroContactChips(content.brand, {
                background: "rgba(255,255,255,0.78)",
                border: hexToRgba(content.brand.accentColor, 0.16),
                color: "#0f172a"
              })}
            </div>
            ${hasHeroArt ? buildHeroArtBlock(content.brand, {
              accentColor: content.brand.accentColor,
              auraColor: hexToRgba(content.brand.accentColor, 0.18),
              shardColor: "rgba(203,213,225,0.92)",
              shardSecondary: hexToRgba(content.brand.secondaryColor, 0.42),
              markBackground: `linear-gradient(180deg, rgba(255,255,255,0.96), ${hexToRgba(content.brand.secondaryColor, 0.72)})`,
              markBorder: "rgba(203,213,225,0.72)",
              markTextColor: "#0f172a",
              lineColor: "rgba(255,255,255,0.92)"
            }) : ""}
          </div>
        </div>
        <div style="padding:28px;">
          ${content.greeting}
          ${content.intro}
          ${content.summaryHtml}
          <div style="padding:20px 22px;border-radius:26px;background:rgba(255,255,255,0.9);border:1px solid rgba(226,232,240,0.95);box-shadow:0 16px 28px rgba(15,23,42,0.06);">
            ${content.detailsHtml}
            ${content.bodyHtml}
            ${content.contactPrompt}
          </div>
          ${content.ctaButtons}
          ${content.calendarSection}
          <div style="margin-top:18px;">${content.closing}</div>
        </div>
        <div data-preview-area="footer" style="padding:18px 28px;background:#eff6ff;border-top:1px solid #dbeafe;color:#475569;font-size:13px;line-height:1.7;">
          <div style="font-weight:800;color:#0f172a;margin-bottom:4px;">${content.brandTitle}</div>
          ${content.footerContact}
        </div>
      </div>
    </div>
  `;
}

function buildExecutiveTemplate(content, options = {}) {
  const includePreviewStyles = Boolean(options.includePreviewStyles);
  const hasHeroArt = shouldRenderHeroArt(content.brand);
  const heroColumns = hasHeroArt ? "minmax(0, 1fr) 188px" : "minmax(0, 1fr)";
  return `
    ${includePreviewStyles ? buildPreviewFocusStyles() : ""}
    <div style="margin:0;padding:30px 14px;background:
      radial-gradient(circle at top left, rgba(15,23,42,0.18), transparent 32%),
      linear-gradient(180deg, #eef2f7, #f3f6fb);font-family:Arial, sans-serif;">
      <div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #d5dde8;border-radius:30px;overflow:hidden;box-shadow:0 24px 48px rgba(15,23,42,0.16);">
        <div data-preview-area="hero" style="padding:24px 28px;background:
          radial-gradient(circle at top right, ${hexToRgba(content.brand.secondaryColor, 0.34)}, transparent 24%),
          linear-gradient(135deg, #0f172a 0%, #182235 54%, #1f2937 100%);border-bottom:4px solid ${content.brand.accentColor};">
          <div style="display:grid;grid-template-columns:${heroColumns};gap:18px;align-items:center;">
            <div>
              <div style="display:flex;align-items:center;gap:14px;">
                <div data-preview-area="logo">${content.logoMarkup}</div>
                <div>
                  <div data-preview-area="hero-label" style="font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#94a3b8;">${content.heroLabel}</div>
                  <div style="font-size:30px;line-height:1.04;font-weight:800;color:#ffffff;margin-top:4px;">${content.brandTitle}</div>
                </div>
              </div>
              <div style="font-size:14px;line-height:1.7;color:#cbd5e1;margin-top:10px;">${escapeHtml(content.brand.tagline || "Professional reminders for a polished client experience.")}</div>
              ${buildHeroContactChips(content.brand, {
                background: "rgba(255,255,255,0.08)",
                border: "rgba(148,163,184,0.24)",
                color: "#e2e8f0"
              })}
            </div>
            ${hasHeroArt ? buildHeroArtBlock(content.brand, {
              accentColor: content.brand.accentColor,
              auraColor: hexToRgba(content.brand.accentColor, 0.2),
              shardColor: "rgba(148,163,184,0.42)",
              shardSecondary: hexToRgba(content.brand.secondaryColor, 0.18),
              markBackground: `linear-gradient(180deg, ${hexToRgba(content.brand.accentColor, 0.24)}, ${hexToRgba(content.brand.secondaryColor, 0.34)}, rgba(15,23,42,0.62))`,
              markBorder: "rgba(255,255,255,0.18)",
              markTextColor: "#f8fafc",
              lineColor: "rgba(255,255,255,0.54)"
            }) : ""}
          </div>
        </div>
        <div style="padding:28px;">
          ${content.greeting}
          ${content.intro}
          ${content.summaryHtml}
          ${content.detailsHtml}
          ${content.bodyHtml}
          ${content.contactPrompt}
          ${content.ctaButtons}
          ${content.calendarSection}
          ${content.closing}
        </div>
        <div data-preview-area="footer" style="padding:18px 26px;background:#0f172a;color:#cbd5e1;font-size:13px;line-height:1.7;">
          <div style="font-weight:800;color:#ffffff;margin-bottom:4px;">${content.brandTitle}</div>
          ${content.footerContact}
        </div>
      </div>
    </div>
  `;
}

function buildDefaultReminderEmail(message, calendarLinks, options = {}) {
  const includePreviewStyles = Boolean(options.includePreviewStyles);
  const safeMessage = escapeHtml(message || "");
  const formattedMessage = safeMessage
    .split("\n\n")
    .filter(Boolean)
    .map(section => `<p style="margin:0 0 16px; line-height:1.65; color:#334155; font-size:15px;">${section.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const contentHtml = `
    <div style="margin:0; padding:32px 16px; background:#f3f7ff;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #dbe7ff; border-radius:20px; overflow:hidden; box-shadow:0 10px 30px rgba(37,99,235,0.08);">
        <div data-preview-area="hero" style="background:linear-gradient(135deg, #2563eb, #1d4ed8); padding:20px 24px;">
          <div style="color:#ffffff; font-size:22px; font-weight:700;">Appointment Reminder</div>
        </div>
        <div style="padding:28px 24px;">
          ${formattedMessage}
        </div>
        ${buildCalendarSection(calendarLinks, { accentColor: DEFAULT_ACCENT, buttonStyle: "pill" })}
      </div>
    </div>
  `;

  return wrapEmailDocument(contentHtml, {
    includePreviewStyles,
    preheader: buildEmailPreheader({ parsed: parseReminderMessage(message), branding: null })
  });
}

function buildProductionBrandedEmail({ message, calendarLinks, branding, includePreviewStyles = false }) {
  const parsed = parseReminderMessage(message);
  const theme = getProductionTheme(branding);
  const summaryHtml = buildProductionSummary(parsed.summary, branding);
  const detailsHtml = parsed.details ? buildProductionDetails(parsed.details, branding) : "";
  const hasHeroArt = shouldRenderHeroArt(branding);
  const bodyHtml = parsed.body.length
    ? parsed.body.map(paragraph => `
        <tr>
          <td style="padding:0 0 12px;font-size:15px;line-height:1.7;${paintTextColor("#334155")}">
            ${escapeHtml(paragraph)}
          </td>
        </tr>
      `).join("")
    : "";
  const contactPromptHtml = parsed.contactPrompt
    ? `
      <tr>
        <td style="padding:0 0 16px;font-size:15px;line-height:1.7;${paintTextColor("#334155")}">
          ${escapeHtml(parsed.contactPrompt)}
        </td>
      </tr>
    `
    : "";
  const closingHtml = parsed.closing
    ? `
      <tr>
        <td style="padding:4px 0 0;font-size:15px;font-weight:700;line-height:1.6;${paintTextColor("#0f172a")}">
          ${escapeHtml(parsed.closing)}
        </td>
      </tr>
    `
    : "";
  const logoMarkup = branding.logoUrl
    ? `<img src="${escapeAttribute(branding.logoUrl)}" alt="${escapeAttribute(branding.businessName)} logo" width="54" height="54" style="display:block;width:54px;height:54px;border-radius:16px;object-fit:cover;border:1px solid ${hexToRgba("#ffffff", 0.24)};">`
    : `<div style="width:54px;height:54px;border-radius:16px;background:${theme.markBackground};border:1px solid ${theme.markBorder};display:flex;align-items:center;justify-content:center;color:${theme.markText};font-size:20px;font-weight:800;line-height:1;">${escapeHtml(getInitials(branding.businessName || "AR"))}</div>`;
  const topLabel = escapeHtml(branding.headerLabel || "Appointment Reminder");
  const businessName = escapeHtml(branding.businessName || "Appointment Reminder");
  const tagline = branding.tagline
    ? `<div style="font-size:14px;line-height:1.6;${paintTextColor(theme.taglineColor)}margin-top:8px;">${escapeHtml(branding.tagline)}</div>`
    : "";
  const contactLineParts = [branding.contactEmail, branding.contactPhone, formatUrlLabel(branding.websiteUrl)].filter(Boolean);
  const contactLine = contactLineParts.length
    ? `<div style="font-size:13px;line-height:1.6;${paintTextColor(theme.metaColor)}margin-top:12px;">${escapeHtml(contactLineParts.join(" | "))}</div>`
    : "";
  const productionButtons = buildProductionButtons(branding);
  const productionCalendar = buildProductionCalendar(calendarLinks, branding);
  const heroArtCell = hasHeroArt
    ? `
      <td width="18" style="font-size:0;line-height:0;">&nbsp;</td>
      <td data-preview-area="art" valign="middle" width="170" style="width:170px;">
        ${buildProductionHeroArt(branding, theme)}
      </td>
    `
    : "";

  const contentHtml = `
    <div style="margin:0;padding:28px 12px;background:${theme.pageBackground};">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid ${theme.shellBorder};border-radius:28px;overflow:hidden;box-shadow:0 18px 38px rgba(15,23,42,0.12);">
        <tr>
          <td data-preview-area="hero" bgcolor="${theme.heroBgColor}" style="padding:0;background:${theme.heroBackground};">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${theme.heroBgColor}">
              <tr>
                <td style="padding:26px 28px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td valign="top" style="width:72px;padding-right:16px;">
                        <div data-preview-area="logo">${logoMarkup}</div>
                      </td>
                      <td valign="top">
                        <div data-preview-area="hero-label" style="font-size:12px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;${paintTextColor(theme.labelColor)}">
                          ${topLabel}
                        </div>
                        <div style="font-size:34px;line-height:1.02;font-weight:800;${paintTextColor(theme.titleColor)}margin-top:6px;">
                          ${businessName}
                        </div>
                        ${tagline}
                        ${contactLine ? `<div data-preview-area="contact">${contactLine}</div>` : ""}
                      </td>
                      ${heroArtCell}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 14px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:0 0 14px;font-size:18px;font-weight:800;line-height:1.4;${paintTextColor("#0f172a")}">
                  ${escapeHtml(parsed.greeting || "Hello,")}
                </td>
              </tr>
              ${parsed.intro ? `
                <tr>
                  <td style="padding:0 0 18px;font-size:15px;line-height:1.7;${paintTextColor("#334155")}">
                    ${escapeHtml(parsed.intro)}
                  </td>
                </tr>
              ` : ""}
              ${summaryHtml}
              ${detailsHtml}
              ${bodyHtml}
              ${contactPromptHtml}
              ${productionButtons}
              ${productionCalendar}
              ${closingHtml}
            </table>
          </td>
        </tr>
        <tr>
          <td data-preview-area="footer" bgcolor="${theme.footerBgColor}" style="padding:18px 28px;border-top:1px solid #e2e8f0;background:${theme.footerBackground};">
            <div style="font-size:13px;line-height:1.7;${paintTextColor(theme.footerColor)}">
              <strong style="${paintTextColor(theme.footerTitleColor)}">${businessName}</strong><br>
              ${escapeHtml(buildFooterContactLine(branding))}
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;

  return wrapEmailDocument(contentHtml, {
    includePreviewStyles,
    preheader: buildEmailPreheader({ parsed, branding })
  });
}

function wrapEmailDocument(contentHtml, options = {}) {
  const includePreviewStyles = Boolean(options.includePreviewStyles);
  const preheader = String(options.preheader || "").trim();

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="x-ua-compatible" content="ie=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light">
      <style>
        body, table, td, div, p, a, span {
          font-family: Arial, "Segoe UI", Helvetica, sans-serif !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #f4f7fb;
          color: #0f172a;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        a {
          color: inherit;
        }
        a[x-apple-data-detectors] {
          color: inherit !important;
          text-decoration: none !important;
        }
      </style>
      ${includePreviewStyles ? buildPreviewFocusStyles() : ""}
    </head>
    <body>
      ${preheader ? `<div style="display:none!important;max-height:0;overflow:hidden;opacity:0;mso-hide:all;color:transparent;line-height:1px;font-size:1px;">${escapeHtml(preheader)}</div>` : ""}
      ${contentHtml}
    </body>
  </html>`;
}

function buildEmailPreheader({ parsed, branding }) {
  const businessName = cleanText(branding?.businessName, 80);
  const dateItem = parsed?.summary?.find(item => item.label === "Date");
  const timeItem = parsed?.summary?.find(item => item.label === "Time");
  const parts = [];

  if (businessName) {
    parts.push(`Appointment reminder from ${businessName}`);
  } else {
    parts.push("Appointment reminder");
  }

  if (dateItem?.value) {
    parts.push(`for ${dateItem.value}`);
  }

  if (timeItem?.value) {
    parts.push(`at ${timeItem.value}`);
  }

  return parts.join(" ");
}

function buildHeroBackground(branding, templateStyle) {
  const accent = branding.accentColor || DEFAULT_ACCENT;
  const secondary = branding.secondaryColor || DEFAULT_SECONDARY;
  const style = branding.heroGradientStyle || "signature";
  const executiveTail = "#111827";
  const spotlightBase = "#ffffff";

  if (templateStyle === "executive") {
    if (style === "solid") {
      return `linear-gradient(135deg, ${accent} 0%, ${hexToRgba(accent, 0.92)} 100%)`;
    }

    if (style === "spotlight") {
      return `radial-gradient(circle at 82% 20%, ${secondary} 0%, transparent 34%), linear-gradient(135deg, ${accent} 0%, ${executiveTail} 100%)`;
    }

    if (style === "split") {
      return `linear-gradient(118deg, ${accent} 0%, ${accent} 50%, ${secondary} 50%, ${secondary} 100%)`;
    }

    return `linear-gradient(135deg, ${accent} 0%, ${hexToRgba(accent, 0.88)} 52%, ${secondary} 100%)`;
  }

  if (templateStyle === "spotlight") {
    if (style === "solid") {
      return `linear-gradient(135deg, ${accent} 0%, ${hexToRgba(accent, 0.18)} 100%)`;
    }

    if (style === "split") {
      return `linear-gradient(118deg, ${hexToRgba(accent, 0.22)} 0%, ${hexToRgba(accent, 0.22)} 50%, ${secondary} 50%, ${hexToRgba(secondary, 0.92)} 100%)`;
    }

    if (style === "signature") {
      return `linear-gradient(135deg, ${hexToRgba(accent, 0.32)} 0%, ${hexToRgba(accent, 0.16)} 50%, ${secondary} 100%)`;
    }

    return `radial-gradient(circle at 82% 20%, ${secondary} 0%, transparent 32%), linear-gradient(135deg, ${hexToRgba(accent, 0.34)} 0%, ${spotlightBase} 100%)`;
  }

  if (style === "solid") {
    return `linear-gradient(135deg, ${accent} 0%, ${accent} 100%)`;
  }

  if (style === "spotlight") {
    return `radial-gradient(circle at 82% 20%, ${secondary} 0%, transparent 32%), linear-gradient(135deg, ${accent} 0%, ${hexToRgba(accent, 0.88)} 100%)`;
  }

  if (style === "split") {
    return `linear-gradient(118deg, ${accent} 0%, ${accent} 50%, ${secondary} 50%, ${secondary} 100%)`;
  }

  return `linear-gradient(135deg, ${accent} 0%, ${hexToRgba(accent, 0.9)} 52%, ${secondary} 100%)`;
}

function paintTextColor(color) {
  return `color:${color};-webkit-text-fill-color:${color};`;
}

function buildProductionHeroArt(branding, theme) {
  const artShape = branding.resolvedArtShape || branding.artShape || "classic";
  const accent = branding.accentColor || DEFAULT_ACCENT;
  const secondary = branding.secondaryColor || DEFAULT_SECONDARY;
  const markText = theme.templateStyle === "executive" ? "#f8fafc" : "#0f172a";
  const markFill = theme.templateStyle === "executive"
    ? `linear-gradient(180deg, ${hexToRgba(secondary, 0.22)}, rgba(255,255,255,0.06))`
    : `linear-gradient(180deg, rgba(255,255,255,0.94), ${hexToRgba(secondary, 0.82)})`;
  const markBorder = theme.templateStyle === "executive"
    ? "rgba(255,255,255,0.2)"
    : hexToRgba(accent, 0.18);
  const mainMark = `
    <div style="position:absolute;right:8px;top:16px;width:92px;height:112px;border-radius:28px;background:${markFill};border:1px solid ${markBorder};box-shadow:0 10px 22px rgba(15,23,42,0.12);overflow:hidden;">
      <div style="position:absolute;top:-8px;left:30px;width:3px;height:126px;background:${theme.heroLineColor};opacity:0.88;"></div>
      <div style="position:absolute;top:-8px;left:56px;width:3px;height:126px;background:${theme.heroLineColor};opacity:0.88;"></div>
      <div style="position:absolute;inset:14px;border-radius:20px;background:${theme.heroMarkCore};display:flex;align-items:center;justify-content:center;color:${markText};font-size:19px;font-weight:800;line-height:1;">${escapeHtml(getInitials(branding.businessName || "AR"))}</div>
    </div>`;

  if (artShape === "none") {
    return "";
  }

  let artHtml = "";

  if (artShape === "orbit") {
    artHtml = `
      <div style="position:absolute;right:30px;top:10px;width:104px;height:104px;border-radius:999px;border:2px solid ${hexToRgba(accent, 0.28)};"></div>
      <div style="position:absolute;right:18px;top:24px;width:86px;height:86px;border-radius:999px;border:2px solid ${hexToRgba(secondary, 0.92)};"></div>
      <div style="position:absolute;right:112px;top:64px;width:12px;height:12px;border-radius:999px;background:${accent};"></div>
    `;
  } else if (artShape === "stacked") {
    artHtml = `
      <div style="position:absolute;right:82px;top:12px;width:34px;height:116px;border-radius:18px;background:linear-gradient(180deg, rgba(255,255,255,0.84), ${hexToRgba(secondary, 0.4)});"></div>
      <div style="position:absolute;right:52px;top:28px;width:34px;height:94px;border-radius:18px;background:linear-gradient(180deg, ${hexToRgba(secondary, 0.82)}, rgba(255,255,255,0.08));"></div>
      <div style="position:absolute;right:22px;top:46px;width:34px;height:74px;border-radius:18px;background:linear-gradient(180deg, ${hexToRgba(accent, 0.52)}, rgba(255,255,255,0.08));"></div>
    `;
  } else if (artShape === "ribbon") {
    artHtml = `
      <div style="position:absolute;right:78px;top:28px;width:74px;height:14px;border-radius:999px;background:${hexToRgba(accent, 0.56)};"></div>
      <div style="position:absolute;right:58px;top:54px;width:86px;height:14px;border-radius:999px;background:${hexToRgba(secondary, 0.92)};"></div>
      <div style="position:absolute;right:88px;top:82px;width:66px;height:14px;border-radius:999px;background:rgba(255,255,255,0.7);"></div>
    `;
  } else if (artShape === "prism") {
    artHtml = `
      <div style="position:absolute;right:86px;top:20px;width:34px;height:34px;transform:rotate(45deg);border-radius:10px;background:rgba(255,255,255,0.86);"></div>
      <div style="position:absolute;right:56px;top:50px;width:26px;height:26px;transform:rotate(45deg);border-radius:8px;background:${hexToRgba(secondary, 0.92)};"></div>
      <div style="position:absolute;right:98px;top:82px;width:18px;height:18px;transform:rotate(45deg);border-radius:6px;background:${hexToRgba(accent, 0.64)};"></div>
    `;
  } else if (artShape === "frame") {
    artHtml = `
      <div style="position:absolute;right:18px;top:12px;width:118px;height:118px;border-radius:28px;border:2px solid ${hexToRgba(accent, 0.26)};"></div>
      <div style="position:absolute;right:34px;top:28px;width:90px;height:90px;border-radius:24px;border:2px solid ${hexToRgba(secondary, 0.92)};"></div>
    `;
  } else if (artShape === "halo") {
    artHtml = `
      <div style="position:absolute;right:26px;top:18px;width:108px;height:108px;border-radius:999px;border:2px solid ${hexToRgba(accent, 0.24)};"></div>
      <div style="position:absolute;right:42px;top:34px;width:76px;height:76px;border-radius:999px;border:2px dashed ${hexToRgba(secondary, 0.94)};"></div>
      <div style="position:absolute;right:122px;top:64px;width:10px;height:10px;border-radius:999px;background:${accent};"></div>
    `;
  } else if (artShape === "cascade") {
    artHtml = `
      <div style="position:absolute;right:94px;top:18px;width:18px;height:92px;border-radius:999px;background:rgba(255,255,255,0.82);"></div>
      <div style="position:absolute;right:68px;top:34px;width:18px;height:76px;border-radius:999px;background:${hexToRgba(secondary, 0.88)};"></div>
      <div style="position:absolute;right:42px;top:50px;width:18px;height:60px;border-radius:999px;background:${hexToRgba(accent, 0.5)};"></div>
    `;
  } else if (artShape === "split") {
    artHtml = `
      <div style="position:absolute;right:78px;top:18px;width:48px;height:104px;border-radius:18px;background:linear-gradient(180deg, rgba(255,255,255,0.9), ${hexToRgba(secondary, 0.7)});"></div>
      <div style="position:absolute;right:48px;top:18px;width:34px;height:104px;border-radius:18px;background:linear-gradient(180deg, ${hexToRgba(accent, 0.6)}, rgba(255,255,255,0.1));"></div>
    `;
  } else {
    artHtml = `
      <div style="position:absolute;right:84px;top:14px;width:30px;height:116px;border-radius:16px;background:linear-gradient(180deg, rgba(255,255,255,0.84), ${hexToRgba(secondary, 0.44)});"></div>
      <div style="position:absolute;right:54px;top:40px;width:30px;height:90px;border-radius:16px;background:linear-gradient(180deg, ${hexToRgba(secondary, 0.88)}, rgba(255,255,255,0.08));"></div>
      <div style="position:absolute;right:118px;top:58px;width:24px;height:68px;border-radius:14px;background:linear-gradient(180deg, ${hexToRgba(accent, 0.42)}, rgba(255,255,255,0.06));"></div>
    `;
  }

  return `
    <div style="position:relative;width:156px;height:138px;margin-left:auto;">
      <div style="position:absolute;right:0;top:0;width:126px;height:126px;border-radius:999px;background:radial-gradient(circle, ${hexToRgba(secondary, 0.7)}, rgba(255,255,255,0));"></div>
      ${artHtml}
      ${mainMark}
    </div>
  `;
}

function getProductionTheme(branding) {
  if (branding.templateStyle === "executive") {
    return {
      templateStyle: "executive",
      pageBackground: "#eef2f7",
      heroBackground: buildHeroBackground(branding, "executive"),
      heroBgColor: "#182235",
      shellBorder: "#d5dde8",
      labelColor: "#94a3b8",
      titleColor: "#ffffff",
      taglineColor: "#dbe4ef",
      metaColor: "#c3d0df",
      markBackground: "rgba(255,255,255,0.12)",
      markBorder: "rgba(255,255,255,0.18)",
      markText: "#ffffff",
      heroLineColor: "rgba(255,255,255,0.24)",
      heroMarkCore: "linear-gradient(140deg, rgba(15,23,42,0.92), rgba(37,99,235,0.34))",
      footerBackground: "#0f172a",
      footerBgColor: "#0f172a",
      footerColor: "#cbd5e1",
      footerTitleColor: "#ffffff"
    };
  }

  if (branding.templateStyle === "spotlight") {
    return {
      templateStyle: "spotlight",
      pageBackground: "#f8fbff",
      heroBackground: buildHeroBackground(branding, "spotlight"),
      heroBgColor: "#ffffff",
      shellBorder: hexToRgba(branding.accentColor, 0.18),
      labelColor: branding.accentColor,
      titleColor: "#0f172a",
      taglineColor: "#475569",
      metaColor: "#475569",
      markBackground: `linear-gradient(180deg, #ffffff, ${hexToRgba(branding.secondaryColor, 0.78)})`,
      markBorder: hexToRgba(branding.accentColor, 0.18),
      markText: "#0f172a",
      heroLineColor: "rgba(255,255,255,0.86)",
      heroMarkCore: `linear-gradient(140deg, rgba(255,255,255,0.94), ${hexToRgba(branding.secondaryColor, 0.72)})`,
      footerBackground: "#eff6ff",
      footerBgColor: "#eff6ff",
      footerColor: "#475569",
      footerTitleColor: "#0f172a"
    };
  }

  return {
    templateStyle: "signature",
    pageBackground: "#f4f7fb",
    heroBackground: buildHeroBackground(branding, "signature"),
    heroBgColor: branding.accentColor,
    shellBorder: "#dbe7ff",
    labelColor: "#dbeafe",
    titleColor: "#ffffff",
    taglineColor: "#dbeafe",
    metaColor: "#eff6ff",
    markBackground: `linear-gradient(180deg, rgba(255,255,255,0.92), ${hexToRgba(branding.secondaryColor, 0.72)})`,
    markBorder: "rgba(255,255,255,0.3)",
    markText: "#0f172a",
    heroLineColor: "rgba(255,255,255,0.76)",
    heroMarkCore: `linear-gradient(140deg, rgba(255,255,255,0.94), ${hexToRgba(branding.secondaryColor, 0.8)})`,
    footerBackground: "#f8fafc",
    footerBgColor: "#f8fafc",
    footerColor: "#64748b",
    footerTitleColor: "#0f172a"
  };
}

function buildProductionSummary(summaryItems, branding) {
  if (!summaryItems.length) {
    return "";
  }

  const radius = getSafePanelRadius(branding.panelShape);
  const cells = summaryItems.slice(0, 3).map(item => `
    <td valign="top" style="padding:0 8px 0 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="border:1px solid ${hexToRgba(branding.accentColor, 0.18)};${radius}background:linear-gradient(180deg, #ffffff, #f8fafc);">
        <tr>
          <td style="padding:14px 14px 12px;">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;${paintTextColor(branding.accentColor)}margin:0 0 6px;">${escapeHtml(item.label)}</div>
            <div style="font-size:16px;font-weight:700;line-height:1.45;${paintTextColor("#0f172a")}">${escapeHtml(item.value)}</div>
          </td>
        </tr>
      </table>
    </td>
  `).join("");

  return `
    <tr>
      <td data-preview-area="secondary" style="padding:0 0 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>${cells}</tr>
        </table>
      </td>
    </tr>
  `;
}

function buildProductionDetails(details, branding) {
  const radius = getSafePanelRadius(branding.panelShape);

  return `
    <tr>
      <td data-preview-area="secondary" style="padding:0 0 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="border:1px solid ${hexToRgba(branding.accentColor, 0.14)};${radius}background:linear-gradient(180deg, #ffffff, ${hexToRgba(branding.secondaryColor, 0.34)});">
          <tr>
            <td style="padding:16px 18px;">
              <div style="font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;${paintTextColor("#64748b")}margin:0 0 8px;">Additional details</div>
              <div style="font-size:15px;line-height:1.7;${paintTextColor("#0f172a")}">${escapeHtml(details).replace(/\n/g, "<br>")}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function buildProductionButtons(branding) {
  const buttons = [];
  const radius = getSafeButtonRadius(branding.buttonStyle);

  if (branding.contactPhone) {
    const digits = branding.contactPhone.replace(/\D/g, "");
    if (digits) {
      buttons.push({
        href: `tel:${digits}`,
        label: "Call us",
        background: branding.accentColor,
        color: "#ffffff",
        border: branding.accentColor
      });
    }
  }

  if (branding.websiteUrl) {
    buttons.push({
      href: branding.websiteUrl,
      label: "Visit website",
      background: "#ffffff",
      color: "#0f172a",
      border: hexToRgba(branding.accentColor, 0.24)
    });
  }

  if (branding.rescheduleUrl) {
    buttons.push({
      href: branding.rescheduleUrl,
      label: "Reschedule",
      background: "#0f172a",
      color: "#ffffff",
      border: "#0f172a"
    });
  }

  if (!buttons.length) {
    return "";
  }

  return `
    <tr>
      <td data-preview-area="buttons" style="padding:0 0 18px;">
        ${buttons.map(button => `
          <a href="${escapeAttribute(button.href)}" style="display:inline-block;margin:0 10px 10px 0;padding:12px 16px;${radius}background:${button.background};${paintTextColor(button.color)}border:1px solid ${button.border};text-decoration:none;font-size:14px;font-weight:800;line-height:1.2;">${escapeHtml(button.label)}</a>
        `).join("")}
      </td>
    </tr>
  `;
}

function buildProductionCalendar(calendarLinks, branding) {
  if (!calendarLinks) {
    return "";
  }

  const radius = getSafePanelRadius(branding.panelShape);
  const buttonRadius = getSafeButtonRadius(branding.buttonStyle);

  return `
    <tr>
      <td data-preview-area="buttons" style="padding:0 0 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#ffffff" style="${radius}background:${hexToRgba(branding.accentColor, 0.05)};border:1px solid ${hexToRgba(branding.accentColor, 0.16)};">
          <tr>
            <td style="padding:18px;">
              <div style="font-size:15px;font-weight:800;${paintTextColor("#0f172a")}margin:0 0 8px;">Add to Calendar</div>
              <div style="font-size:13px;line-height:1.65;${paintTextColor("#475569")}margin:0 0 12px;">Save this appointment to the calendar you already use.</div>
              <a href="${escapeAttribute(calendarLinks.apple)}" style="display:inline-block;margin:0 10px 10px 0;padding:11px 14px;${buttonRadius}background:#1f2937;${paintTextColor("#ffffff")}border:1px solid #1f2937;text-decoration:none;font-size:13px;font-weight:800;line-height:1.2;">Apple Calendar</a>
              <a href="${escapeAttribute(calendarLinks.outlook)}" style="display:inline-block;margin:0 10px 10px 0;padding:11px 14px;${buttonRadius}background:${branding.accentColor};${paintTextColor("#ffffff")}border:1px solid ${branding.accentColor};text-decoration:none;font-size:13px;font-weight:800;line-height:1.2;">Outlook Calendar</a>
              <a href="${escapeAttribute(calendarLinks.google)}" style="display:inline-block;margin:0 10px 10px 0;padding:11px 14px;${buttonRadius}background:#0f766e;${paintTextColor("#ffffff")}border:1px solid #0f766e;text-decoration:none;font-size:13px;font-weight:800;line-height:1.2;">Google Calendar</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function getSafeButtonRadius(style) {
  if (style === "crisp") {
    return "border-radius:10px;";
  }

  if (style === "rounded") {
    return "border-radius:16px;";
  }

  if (style === "bubbly") {
    return "border-radius:24px;";
  }

  if (style === "cloudy") {
    return "border-radius:28px;";
  }

  if (style === "parallelogram") {
    return "border-radius:12px;";
  }

  return "border-radius:999px;";
}

function getSafePanelRadius(style) {
  if (style === "crisp") {
    return "border-radius:12px;";
  }

  if (style === "bubbly") {
    return "border-radius:24px;";
  }

  if (style === "cloudy") {
    return "border-radius:28px;";
  }

  if (style === "parallelogram") {
    return "border-radius:14px;";
  }

  return "border-radius:18px;";
}

function buildButtonStyle(style) {
  if (style === "crisp") {
    return "border-radius:10px;";
  }

  if (style === "rounded") {
    return "border-radius:16px;";
  }

  if (style === "bubbly") {
    return "border-radius:28px 22px 30px 20px / 24px 30px 22px 28px;";
  }

  if (style === "cloudy") {
    return "border-radius:26px 34px 24px 36px / 30px 24px 34px 26px;";
  }

  if (style === "parallelogram") {
    return "border-radius:12px;clip-path:polygon(12% 0, 100% 0, 88% 100%, 0 100%);padding-left:22px;padding-right:22px;";
  }

  return "border-radius:999px;";
}

function buildSurfaceStyle(style) {
  if (style === "crisp") {
    return "border-radius:12px;";
  }

  if (style === "bubbly") {
    return "border-radius:28px 20px 30px 22px / 24px 32px 22px 30px;";
  }

  if (style === "cloudy") {
    return "border-radius:26px 34px 24px 38px / 30px 24px 36px 26px;";
  }

  if (style === "parallelogram") {
    return "border-radius:14px;clip-path:polygon(6% 0, 100% 0, 94% 100%, 0 100%);";
  }

  return "border-radius:18px;";
}

function buildActionButtons(branding) {
  const buttons = [];
  const buttonShapeStyle = buildButtonStyle(branding.buttonStyle);

  if (branding.contactPhone) {
    const digits = branding.contactPhone.replace(/\D/g, "");
    if (digits) {
      buttons.push({
        href: `tel:${digits}`,
        label: "Call us",
        background: branding.accentColor,
        color: "#ffffff",
        style: buttonShapeStyle
      });
    }
  }

  if (branding.websiteUrl) {
      buttons.push({
        href: branding.websiteUrl,
        label: "Visit website",
        background: `linear-gradient(135deg, ${hexToRgba(branding.secondaryColor, 0.92)}, rgba(255,255,255,0.98))`,
        color: "#0f172a",
        border: hexToRgba(branding.accentColor, 0.2),
        style: buttonShapeStyle
    });
  }

  if (branding.rescheduleUrl) {
    buttons.push({
      href: branding.rescheduleUrl,
        label: "Reschedule",
        background: "#0f172a",
        color: "#ffffff",
        style: buttonShapeStyle
      });
    }

  if (!buttons.length) {
    return "";
  }

  return `
    <div data-preview-area="buttons" style="display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px;">
      ${buttons.map(button => `
        <a href="${escapeAttribute(button.href)}" style="display:inline-block;padding:12px 16px;${button.style}text-decoration:none;font-size:14px;font-weight:800;background:${button.background};color:${button.color};border:${button.border ? `1px solid ${button.border}` : "none"};">${escapeHtml(button.label)}</a>
      `).join("")}
    </div>
  `;
}

function buildCalendarSection(calendarLinks, brandingOrAccent) {
  if (!calendarLinks) {
    return "";
  }

  const branding = typeof brandingOrAccent === "string"
    ? { accentColor: brandingOrAccent, buttonStyle: "pill" }
    : brandingOrAccent || { accentColor: DEFAULT_ACCENT, buttonStyle: "pill" };
  const accentColor = branding.accentColor || DEFAULT_ACCENT;
  const buttonShapeStyle = buildButtonStyle(branding.buttonStyle);
  const panelShapeStyle = buildSurfaceStyle(branding.panelShape);

  return `
    <div data-preview-area="buttons" style="margin:4px 0 18px;padding:18px;${panelShapeStyle}background:${hexToRgba(accentColor, 0.06)};border:1px solid ${hexToRgba(accentColor, 0.16)};">
      <div style="margin:0 0 10px;color:#0f172a;font-size:15px;font-weight:800;">Add to Calendar</div>
      <div style="font-size:13px;line-height:1.65;color:#475569;margin:0 0 12px;">Save this appointment to the calendar you already use.</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <a href="${escapeAttribute(calendarLinks.apple)}" style="display:inline-block;padding:11px 14px;${buttonShapeStyle}background:#1f2937;color:#ffffff;text-decoration:none;font-size:13px;font-weight:800;">Apple Calendar</a>
        <a href="${escapeAttribute(calendarLinks.outlook)}" style="display:inline-block;padding:11px 14px;${buttonShapeStyle}background:${accentColor};color:#ffffff;text-decoration:none;font-size:13px;font-weight:800;">Outlook Calendar</a>
        <a href="${escapeAttribute(calendarLinks.google)}" style="display:inline-block;padding:11px 14px;${buttonShapeStyle}background:#0f766e;color:#ffffff;text-decoration:none;font-size:13px;font-weight:800;">Google Calendar</a>
      </div>
    </div>
  `;
}

function getShapeProfile(intensity) {
  if (intensity === "soft") {
    return {
      heroHeight: 150,
      auraSize: 104,
      auraOpacity: 0.72,
      auraRight: 22,
      auraTop: 20,
      shardWidth: 38,
      shardOneRight: 92,
      shardOneTop: 14,
      shardOneHeight: 120,
      shardTwoRight: 46,
      shardTwoTop: 40,
      shardTwoHeight: 86,
      shardThreeRight: 128,
      shardThreeTop: 66,
      shardThreeHeight: 68,
      markRight: 10,
      markTop: 18,
      markWidth: 96,
      markHeight: 118
    };
  }

  if (intensity === "bold") {
    return {
      heroHeight: 172,
      auraSize: 132,
      auraOpacity: 0.96,
      auraRight: 10,
      auraTop: 10,
      shardWidth: 50,
      shardOneRight: 86,
      shardOneTop: 0,
      shardOneHeight: 148,
      shardTwoRight: 24,
      shardTwoTop: 32,
      shardTwoHeight: 108,
      shardThreeRight: 134,
      shardThreeTop: 58,
      shardThreeHeight: 94,
      markRight: 0,
      markTop: 10,
      markWidth: 108,
      markHeight: 132
    };
  }

  return {
    heroHeight: 160,
    auraSize: 118,
    auraOpacity: 0.86,
    auraRight: 18,
    auraTop: 16,
    shardWidth: 44,
    shardOneRight: 94,
    shardOneTop: 8,
    shardOneHeight: 136,
    shardTwoRight: 40,
    shardTwoTop: 36,
    shardTwoHeight: 96,
    shardThreeRight: 132,
    shardThreeTop: 62,
    shardThreeHeight: 80,
    markRight: 8,
    markTop: 16,
    markWidth: 100,
    markHeight: 124
  };
}

function buildFooterContactLine(branding) {
  const parts = [branding.contactEmail, branding.contactPhone, formatUrlLabel(branding.websiteUrl)].filter(Boolean);
  return parts.length ? escapeHtml(parts.join(" | ")) : "Professional appointment reminders sent from this business.";
}

function parseReminderMessage(message) {
  const lines = String(message || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.trim());
  const greeting = lines.find(line => line) || "Hello,";
  const intro = lines.find(line => /^This is a friendly reminder/i.test(line)) || "";
  const summary = [];
  const body = [];
  let detailsLines = [];
  let captureDetails = false;
  let contactPrompt = "";
  let closing = "";

  lines.forEach((line, index) => {
    if (!line) {
      if (captureDetails && detailsLines.length) {
        captureDetails = false;
      }
      return;
    }

    if (index === 0 || line === intro) {
      return;
    }

    if (/^Date:/i.test(line)) {
      summary.push({ label: "Date", value: line.replace(/^Date:\s*/i, "") });
      return;
    }

    if (/^Time:/i.test(line)) {
      summary.push({ label: "Time", value: line.replace(/^Time:\s*/i, "") });
      return;
    }

    if (/^(Location|Service Location):/i.test(line)) {
      summary.push({ label: "Location", value: line.replace(/^(Location|Service Location):\s*/i, "") });
      return;
    }

    if (/^Additional Details:/i.test(line)) {
      captureDetails = true;
      detailsLines = [];
      return;
    }

    if (/^If you need to reach us/i.test(line)) {
      captureDetails = false;
      contactPrompt = line;
      return;
    }

    if (/^Thank you/i.test(line)) {
      closing = line;
      return;
    }

    if (captureDetails) {
      detailsLines.push(line);
      return;
    }

    body.push(line);
  });

  return {
    greeting,
    intro,
    summary,
    details: detailsLines.join("\n"),
    body,
    contactPrompt,
    closing: closing || "Thank you."
  };
}

function cleanText(value, maxLength) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function normalizeEmail(value) {
  const normalized = cleanText(value, 120);
  return EMAIL_PATTERN.test(normalized) ? normalized : "";
}

function normalizeUrl(value) {
  const normalized = cleanText(value, 240);

  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized.startsWith("http") ? normalized : `https://${normalized}`);
    return /^https?:$/i.test(url.protocol) ? url.toString() : "";
  } catch (_error) {
    return "";
  }
}

function normalizeHexColor(value) {
  const normalized = String(value || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(normalized)) {
    return normalized.toLowerCase();
  }

  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return "";
}

function getInitials(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "AR";
  }

  return parts.map(part => part[0].toUpperCase()).join("");
}

function formatUrlLabel(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./i, "");
  } catch (_error) {
    return value;
  }
}

function hexToRgba(hex, alpha) {
  const normalized = normalizeHexColor(hex) || DEFAULT_ACCENT;
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "");
}
