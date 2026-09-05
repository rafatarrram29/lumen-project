export type Lang = "en" | "ar";

export type Translations = {
  common: {
    appName: string;
    tagline: string;
    signOut: string;
    cancel: string;
    continueLabel: string;
    hide: string;
    details: string;
    none: string;
    month: (n: number) => string;
  };
  login: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    pleaseWait: string;
    signIn: string;
    createAccount: string;
    noAccount: string;
    signUpFree: string;
    haveAccount: string;
    checkEmail: string;
    domainNotAllowed: string;
    forgotPassword: string;
    resetTitle: string;
    resetSubtitle: string;
    sendResetLink: string;
    resetLinkSent: string;
    backToSignIn: string;
  };
  resetPassword: {
    title: string;
    subtitle: string;
    newPassword: string;
    updateButton: string;
    successTitle: string;
    successBody: string;
    continueToApp: string;
  };
  home: {
    tagline: string;
    trendTitle: string;
    trendDesc: string;
    rootCauseTitle: string;
    rootCauseDesc: string;
    decisionsTitle: string;
    decisionsDesc: string;
    startAnalysis: string;
  };
  sidebar: {
    upload: string;
    uploading: string;
    year: string;
    analyze: string;
    loading: string;
    datasets: string;
    deleteDataset: (name: string) => string;
    uploadTargets: string;
  };
  targets: {
    uploadButton: string;
    modalTitle: (fileName: string) => string;
    subtitle: string;
    fieldTargetValue: string;
    atLeastOneRequired: string;
    replaceWarning: string;
    ofTarget: (pct: number) => string;
    underTarget: string;
    underTargetBy: (pct: number) => string;
    thresholdLabel: string;
    uploadSuccess: (n: number) => string;
    monthMismatch: (targetMonths: string, latestMonth: number) => string;
  };
  export: {
    button: string;
    modalTitle: string;
    formatLabel: string;
    formatPdf: string;
    formatPptx: string;
    selectAll: string;
    deselectAll: string;
    groupSummary: string;
    groupAreas: string;
    groupItems: string;
    groupMarket: string;
    groupDecisions: string;
    groupCharts: string;
    groupSections: string;
    itemSummary: string;
    itemSystemic: string;
    itemDecision: string;
    itemTargets: string;
    exportButton: string;
    exporting: string;
    noItemsSelected: string;
    generatedOn: (date: string) => string;
    valueLabel: string;
    changeLabel: string;
    ofTargetLabel: string;
  };
  corrections: {
    logTitle: string;
    logButton: string;
  };
  editMapping: {
    editSalesButton: string;
    editSalesTitle: string;
    editSalesWarning: string;
    editLinkButton: string;
    editLinkTitle: string;
    save: string;
  };
  inlineEdit: {
    editHint: string;
    renameHint: string;
    editedTitle: (editor: string, date: string) => string;
    saveFailed: string;
    logSectionTitle: string;
    logEmpty: string;
    changedFrom: (oldValue: string, newValue: string) => string;
    undoToastMessage: string;
    undoButton: string;
    undoneBadge: string;
  };
  linkedFiles: {
    panelTitle: string;
    addButton: string;
    fileTypeLabel: string;
    typeAchievement: string;
    typeKpis: string;
    typeOther: string;
    displayNameLabel: string;
    mappingHelp: string;
    joinKeysLabel: string;
    joinKeyArea: string;
    joinKeyRep: string;
    joinKeyLine: string;
    joinKeyMonth: string;
    joinKeysHint: string;
    atLeastOneJoinKey: string;
    replaceButton: string;
    deleteButton: string;
    deleteConfirm: (name: string) => string;
    modalTitle: (fileName: string) => string;
    replaceModalTitle: (fileName: string) => string;
    uploadSuccess: (n: number) => string;
    linkedContextTitle: string;
  };
  ims: {
    tabLabel: string;
    salesTabLabel: string;
    emptyTitle: string;
    emptyBody: string;
    uploadButton: string;
    modalTitle: (fileName: string) => string;
    fieldArea: string;
    fieldProduct: string;
    fieldMarketShare: string;
    fieldMonth: string;
    fieldCompany: string;
    fieldCompanyHint: string;
    fieldGrowthRate: string;
    fieldGrowthRateHint: string;
    atLeastOneOfAreaProduct: string;
    fixedMonthLabel: string;
    fixedMonthPlaceholder: string;
    fixedMonthHint: string;
    fixedProductLabel: string;
    fixedProductPlaceholder: string;
    fixedProductHint: string;
    ownCompanyLabel: string;
    ownCompanyHint: string;
    pdfExtracting: string;
    pdfExtractFailed: (err: string) => string;
    pdfPageImageWarning: string;
    pdfPageNoTableWarning: string;
    pdfSkip: string;
    pdfEnterManually: string;
    pdfManualHint: string;
    pdfManualPlaceholder: string;
    pdfUseManual: string;
    pdfUseTable: string;
    pdfPageLabel: (n: number) => string;
    pdfTablesFound: (n: number) => string;
    pdfNoTablesAtAll: string;
    pdfBackToPages: string;
    pdfSelectAll: string;
    pdfSelectedCount: (n: number) => string;
    pdfContinueWithSelected: (n: number) => string;
    pdfMappingStepOf: (i: number, n: number) => string;
    pdfManualAdded: string;
    pdfRemove: string;
    pdfApplyToAllSimilar: (n: number) => string;
    pdfAppliedToSimilar: (n: number) => string;
    save: string;
    uploadSuccess: (n: number) => string;
    deleteButton: string;
    deleteConfirm: (name: string) => string;
    filesTitle: string;
    byAreaProduct: string;
    latestShare: string;
    change: string;
    vsMonthsAgo: (n: number) => string;
    topCompetitor: string;
    noCompetitorData: string;
    findingsTitle: string;
    noFindings: string;
    shareDropSummary: (product: string | null, area: string | null, pct: number, months: number) => string;
    shareGainSummary: (product: string | null, area: string | null, pct: number, months: number) => string;
    competitorMoveNote: (company: string, pct: number) => string;
    marketOutpacingUs: (area: string, salesPct: number, sharePct: number) => string;
    weOutpacingMarket: (area: string, salesPct: number, sharePct: number) => string;
    notAvailable: string;
    ytdMarketShare: string;
    rankInCategory: (rank: number, total: number) => string;
    rankByShare: (rank: number, total: number) => string;
    ourGrowth: string;
    ourGrowthSubtitle: string;
    marketGrowthLabel: string;
    marketGrowthSubtitle: string;
    shareGainLossLabel: string;
    shareGainLossSubtitle: string;
    marketRankingTitle: string;
    monthlyTrendTitle: string;
    analysisTitleLabel: string;
    positionShareLine: (share: string, rank: string) => string;
    positionGrowthLine: (ourGrowth: string, marketGrowth: string) => string;
    competitorsTitle: string;
  };
  repHistory: {
    title: string;
    addPeriod: string;
    startMonth: string;
    endMonth: string;
    repNameLabel: string;
    vacantPlaceholder: string;
    vacant: string;
    save: string;
    invalidRange: string;
    responsibleInMonth: (month: string, rep: string) => string;
    deletePeriod: string;
  };
  wizard: {
    uploadTitle: (fileName: string) => string;
    subtitle: string;
    addToExisting: string;
    createNew: string;
    datasetLabel: string;
    datasetNameLabel: string;
    mappingHelp: string;
    selectColumn: string;
    mismatch: (name: string, missing: string) => string;
    multiFileNote: (n: number) => string;
    fieldArea: string;
    fieldItem: string;
    fieldValue: string;
    fieldQty: string;
    fieldMonth: string;
    fieldRep: string;
    fieldLine: string;
    fieldUniqueId: string;
    fieldUniqueIdHint: string;
  };
  dashboard: {
    areasAnalyzed: string;
    inDecline: string;
    pattern: string;
    lineWide: string;
    localized: string;
    stable: string;
    decisionsRaised: string;
    comparingMonth: (a: number, b: number) => string;
    systemicDetected: string;
    noSystemicPattern: string;
    decision: string;
    biggestMovers: string;
    tapArea: string;
    itemComparison: string;
    decline: string;
    growth: string;
    moreInList: (n: number) => string;
    showAll: (n: number) => string;
    showLess: string;
    newEntry: string;
    allAreas: string;
    noChangeThisMonth: string;
    partOfLineDrop: string;
    valueLabel: string;
    quantityLabel: string;
    areaMovedVs: (pct: number, lineLabel: string, linePct: number) => string;
    lineWord: string;
    decliningStreak: string;
    yes: string;
    no: string;
    trendLastMonths: (n: number) => string;
    byItem: string;
    allItems: string;
    rootCauseItem: string;
    valueDrop: (n: string) => string;
    byAreaMonth: (m: number) => string;
    top: string;
    lowest: string;
    rootCauseFor: string;
    theLineWideDrop: string;
    theLineWideDropIn: (c: string) => string;
    noDatasets: string;
    couldNotLoad: string;
    deleteDatasetConfirm: (name: string) => string;
    byRep: string;
    repComparison: string;
    repLeaderboard: string;
  };
  chart: {
    thisArea: string;
    lineAvg: string;
    lineAverage: string;
    idx: string;
    repAvg: string;
    allRepsAverage: string;
  };
  findings: {
    inLine: (line: string) => string;
    systemicSummary: (dropping: number, total: number, linePhrase: string, prev: number, latest: number) => string;
    systemicDecision: (family: string) => string;
    localSummary: (area: string, pct: number) => string;
    localDecision: (family: string, area: string) => string;
    transferSummary: (family: string, pct: number, area: string) => string;
    transferDecision: (family: string, area: string) => string;
  };
  org: {
    assignAreasButton: string;
    assignManagersButton: string;
    assignAreasTitle: string;
    assignManagersTitle: string;
    repLabel: string;
    managerLabel: string;
    existingName: string;
    newName: string;
    newNamePlaceholder: string;
    areasLabel: string;
    repsLabel: string;
    selectedCount: (n: number) => string;
    selectAll: string;
    clearAll: string;
    monthsLabel: string;
    save: string;
    saving: string;
    cancel: string;
    noAreas: string;
    noReps: string;
    pickRep: string;
    pickManager: string;
    pickAtLeastOneArea: string;
    pickAtLeastOneRep: string;
    assignedAreas: (n: number, rep: string) => string;
    assignedReps: (n: number, manager: string) => string;
    managersTitle: string;
    managersSubtitle: string;
    repCount: (n: number) => string;
    teamTotal: string;
    noManagers: string;
    coversMonths: (months: string) => string;
    noAreasForRep: string;
    itemsUnderManager: string;
    managerOf: (manager: string) => string;
    reassignWarning: (rep: string, manager: string) => string;
    remove: string;
    pastCoverage: string;
  };
  units: {
    units: string;
    value: string;
    unitsNote: string;
    valueNote: string;
  };
  search: {
    placeholder: string;
    areasGroup: string;
    itemsGroup: string;
    repsGroup: string;
    marketGroup: string;
    noResults: (query: string) => string;
  };
  install: {
    bannerTitle: string;
    bannerBody: string;
    installButton: string;
    later: string;
    sidebarLink: string;
    modalTitle: string;
    androidTitle: string;
    androidStep1: string;
    androidStep2: string;
    androidStep3: string;
    iosTitle: string;
    iosStep1: string;
    iosStep2: string;
    iosStep3: string;
    alreadyInstalled: string;
    close: string;
  };
};

const en: Translations = {
  common: {
    appName: "Lumen",
    tagline: "Territory Decision Engine",
    signOut: "Sign out",
    cancel: "Cancel",
    continueLabel: "Continue",
    hide: "Hide",
    details: "Details",
    none: "(none)",
    month: (n) => `Month ${n}`,
  },
  login: {
    title: "Territory Decision Engine",
    subtitle: "Upload your monthly sales export, get territory-level decisions.",
    email: "Email",
    password: "Password",
    pleaseWait: "Please wait…",
    signIn: "Sign in",
    createAccount: "Create account",
    noAccount: "Don't have an account?",
    signUpFree: "Sign up free",
    haveAccount: "Already have an account?",
    checkEmail: "Check your email to confirm your account before signing in.",
    domainNotAllowed: "This email address isn't allowed to sign up. Use your company email, or ask the administrator to approve your domain.",
    forgotPassword: "Forgot password?",
    resetTitle: "Reset your password",
    resetSubtitle: "Enter your email and we'll send you a link to set a new password.",
    sendResetLink: "Send reset link",
    resetLinkSent: "Check your email for a link to reset your password.",
    backToSignIn: "Back to sign in",
  },
  resetPassword: {
    title: "Set a new password",
    subtitle: "Choose a new password for your account.",
    newPassword: "New password",
    updateButton: "Update password",
    successTitle: "Password updated",
    successBody: "Your password has been changed. You're signed in now.",
    continueToApp: "Continue to Lumen",
  },
  home: {
    tagline:
      "More data, simpler decisions. Upload your monthly sales export and turn territory numbers into clear, confident actions.",
    trendTitle: "Trend-aware",
    trendDesc: "Compares the last 3 months, not just one, before calling anything a real move.",
    rootCauseTitle: "Root cause",
    rootCauseDesc: "Breaks every change down by product family to find what's actually driving it.",
    decisionsTitle: "Real decisions",
    decisionsDesc: "Every finding ends in one concrete action, never just a number.",
    startAnalysis: "Start analysis",
  },
  sidebar: {
    upload: "+ Upload monthly file",
    uploading: "Uploading…",
    year: "Year",
    analyze: "Analyze",
    loading: "Loading…",
    datasets: "Datasets",
    deleteDataset: (name) => `Delete ${name}`,
    uploadTargets: "+ Upload targets",
  },
  targets: {
    uploadButton: "+ Upload targets",
    modalTitle: (fileName) => `Upload targets — ${fileName}`,
    subtitle:
      "Match each column to what it means. Uploading replaces every existing target for this dataset and year.",
    fieldTargetValue: "Target value",
    atLeastOneRequired: "Map at least one of Area, Rep, or Item so targets can be matched to actuals.",
    replaceWarning: "This replaces all existing targets for this dataset. This cannot be undone.",
    ofTarget: (pct) => `${pct}% of target`,
    underTarget: "Under target",
    underTargetBy: (pct) => `Under target by ${pct}%`,
    thresholdLabel: "Alert threshold",
    uploadSuccess: (n) => `Uploaded ${n} target rows.`,
    monthMismatch: (targetMonths, latestMonth) =>
      `Targets were uploaded for month ${targetMonths}, but the latest month with sales is ${latestMonth} — so there is nothing to compare them against and no target figures are shown. Upload targets for month ${latestMonth}, or add that month's sales.`,
  },
  export: {
    button: "Export",
    modalTitle: "Export report",
    formatLabel: "Format",
    formatPdf: "PDF",
    formatPptx: "PowerPoint",
    selectAll: "Select all",
    deselectAll: "Deselect all",
    groupSummary: "Summary",
    groupAreas: "Areas",
    groupItems: "Items",
    groupMarket: "Market Insights",
    groupDecisions: "Decisions",
    groupCharts: "Charts",
    groupSections: "Other sections",
    itemSummary: "Overview stats",
    itemSystemic: "Systemic finding",
    itemDecision: "Decision",
    itemTargets: "Target vs Actual",
    exportButton: "Export",
    exporting: "Exporting…",
    noItemsSelected: "Select at least one item to export.",
    generatedOn: (date) => `Generated on ${date}`,
    valueLabel: "Value",
    changeLabel: "Change",
    ofTargetLabel: "% of target",
  },
  corrections: {
    logTitle: "Correction log",
    logButton: "📋 Correction log",
  },
  editMapping: {
    editSalesButton: "Edit mapping",
    editSalesTitle: "Edit sales column mapping",
    editSalesWarning: "This only affects new uploads to this dataset — it doesn't change numbers already uploaded. To fix a month you already uploaded, re-upload it instead.",
    editLinkButton: "Edit link",
    editLinkTitle: "Edit how this file is linked",
    save: "Save",
  },
  inlineEdit: {
    editHint: "Click to edit",
    renameHint: "Click to rename — this updates every place this name appears",
    editedTitle: (editor, date) => `Edited by ${editor} on ${date}`,
    saveFailed: "Could not save that edit.",
    logSectionTitle: "Edit history",
    logEmpty: "No values have been edited in this dataset yet.",
    changedFrom: (oldValue, newValue) => `${oldValue} → ${newValue}`,
    undoToastMessage: "Value updated.",
    undoButton: "Undo",
    undoneBadge: "↺ Undone",
  },
  linkedFiles: {
    panelTitle: "Linked files",
    addButton: "+ Add linked file",
    fileTypeLabel: "File type",
    typeAchievement: "Achievement",
    typeKpis: "KPIs",
    typeOther: "Other",
    displayNameLabel: "Display name",
    mappingHelp: "Match this file's columns to the dimensions that link it back to your sales data.",
    joinKeysLabel: "Link this file by",
    joinKeyArea: "Area",
    joinKeyRep: "Rep",
    joinKeyLine: "Line",
    joinKeyMonth: "Month",
    joinKeysHint: "Pick which columns connect this file to the same areas and months as your sales data.",
    atLeastOneJoinKey: "Month must be linked, along with at least one of Area, Rep, or Line.",
    replaceButton: "Replace",
    deleteButton: "Delete",
    deleteConfirm: (name) => `Delete "${name}"? This permanently removes all of its data. This cannot be undone.`,
    modalTitle: (fileName) => `Add linked file — ${fileName}`,
    replaceModalTitle: (fileName) => `Replace with ${fileName}`,
    uploadSuccess: (n) => `Uploaded ${n} rows.`,
    linkedContextTitle: "Linked data",
  },
  ims: {
    tabLabel: "Market Insights",
    salesTabLabel: "Sales",
    emptyTitle: "No IMS data yet",
    emptyBody:
      "Upload an IQVIA Market Share (IMS) or marketing file to see market-share trends, competitor comparisons, and share-change insights for this dataset — completely separate from the sales analysis above.",
    uploadButton: "+ Upload IMS file",
    modalTitle: (fileName) => `Map columns for ${fileName}`,
    fieldArea: "Area",
    fieldProduct: "Product",
    fieldMarketShare: "Market share",
    fieldMonth: "Month",
    fieldCompany: "Company (optional)",
    fieldCompanyHint: "Only needed if this file lists more than one company's share per area/product/month.",
    fieldGrowthRate: "Growth rate (optional)",
    fieldGrowthRateHint: "If this file has its own growth-rate column (e.g. \"GR\"), map it here to get real growth figures instead of \"not available\".",
    atLeastOneOfAreaProduct: "Map at least one of Area or Product — whichever this file actually has.",
    fixedMonthLabel: "This file is for month",
    fixedMonthPlaceholder: "e.g. 6",
    fixedMonthHint: "No Month column mapped — this file will be treated as a single-point snapshot for the month number you enter here.",
    fixedProductLabel: "This table is for product",
    fixedProductPlaceholder: "e.g. Lezberg Amlo",
    fixedProductHint: "No Product column mapped — every row (e.g. each competing company) will be recorded under this one product name.",
    ownCompanyLabel: "Which value in that column is us?",
    ownCompanyHint: "Everything else in that column is treated as a competitor.",
    pdfExtracting: "Reading the PDF…",
    pdfExtractFailed: (err) => `Could not read that PDF: ${err}`,
    pdfPageImageWarning: "This page's content looks like an image, not extractable text — we can't read a table from it automatically.",
    pdfPageNoTableWarning: "Couldn't find a clear table on this page.",
    pdfSkip: "Skip this page",
    pdfEnterManually: "Enter its data manually",
    pdfManualHint: "First line = column names. Separate values with commas or tabs.",
    pdfManualPlaceholder: "Area,Product,Market Share,Month\nDomiat 1,Drug A,24.5,1",
    pdfUseManual: "Use this data",
    pdfUseTable: "Use this table",
    pdfPageLabel: (n) => `Page ${n}`,
    pdfTablesFound: (n) => `${n} table${n === 1 ? "" : "s"} found`,
    pdfNoTablesAtAll: "No tables could be confidently extracted from this PDF. Every page can still be entered manually below.",
    pdfBackToPages: "← Back to pages",
    pdfSelectAll: "Select all tables",
    pdfSelectedCount: (n) => `${n} table${n === 1 ? "" : "s"} selected`,
    pdfContinueWithSelected: (n) => `Continue with ${n} table${n === 1 ? "" : "s"}`,
    pdfMappingStepOf: (i, n) => `Table ${i} of ${n}`,
    pdfManualAdded: "✓ Added to selection",
    pdfRemove: "Remove",
    pdfApplyToAllSimilar: (n) => `Apply to all ${n} similar table${n === 1 ? "" : "s"}`,
    pdfAppliedToSimilar: (n) => `Applied to ${n} similar table${n === 1 ? "" : "s"} too.`,
    save: "Save",
    uploadSuccess: (n) => `Uploaded ${n} rows.`,
    deleteButton: "Delete",
    deleteConfirm: (name) => `Delete "${name}"? This will permanently delete all its uploaded data.`,
    filesTitle: "IMS files",
    byAreaProduct: "Market share by area & product",
    latestShare: "Latest share",
    change: "Change",
    vsMonthsAgo: (n) => `vs ${n} month${n === 1 ? "" : "s"} ago`,
    topCompetitor: "Top competitor",
    noCompetitorData: "No competitor data",
    findingsTitle: "Findings",
    noFindings: "No significant market-share moves detected.",
    shareDropSummary: (product, area, pct, months) => {
      const entity = product && area ? `${product} share in ${area}` : `${product ?? area} share`;
      return `${entity} dropped ${Math.abs(pct)} point${Math.abs(pct) === 1 ? "" : "s"} over the last ${months} month${months === 1 ? "" : "s"}.`;
    },
    shareGainSummary: (product, area, pct, months) => {
      const entity = product && area ? `${product} share in ${area}` : `${product ?? area} share`;
      return `${entity} grew ${pct} point${pct === 1 ? "" : "s"} over the last ${months} month${months === 1 ? "" : "s"}.`;
    },
    competitorMoveNote: (company, pct) =>
      ` Meanwhile, ${company} ${pct > 0 ? "gained" : "lost"} ${Math.abs(pct)} point${Math.abs(pct) === 1 ? "" : "s"} in the same window.`,
    marketOutpacingUs: (area, salesPct, sharePct) =>
      `${area}: our sales moved ${salesPct}% but our share moved ${sharePct} points — the market itself is growing faster than we are.`,
    weOutpacingMarket: (area, salesPct, sharePct) =>
      `${area}: our sales moved ${salesPct}% but our share moved ${sharePct} points — we're outperforming a shrinking or slower market.`,
    notAvailable: "Not available",
    ytdMarketShare: "YTD Market Share",
    rankInCategory: (rank, total) => `Rank #${rank} of ${total} in category`,
    rankByShare: (rank, total) => `Rank #${rank} of ${total} by share`,
    ourGrowth: "Our Growth",
    ourGrowthSubtitle: "Latest period",
    marketGrowthLabel: "Market Growth",
    marketGrowthSubtitle: "Category average, latest period",
    shareGainLossLabel: "Share Gain/Loss",
    shareGainLossSubtitle: "Market share point change",
    marketRankingTitle: "Market Ranking",
    monthlyTrendTitle: "Monthly Trend — Us vs Top Competitors",
    analysisTitleLabel: "Analysis",
    positionShareLine: (share, rank) => `Latest share: ${share} — ${rank}.`,
    positionGrowthLine: (ourGrowth, marketGrowth) => `Our growth: ${ourGrowth} vs the market's ${marketGrowth}.`,
    competitorsTitle: "Competitors",
  },
  repHistory: {
    title: "Rep history",
    addPeriod: "+ Add period",
    startMonth: "From month",
    endMonth: "To month",
    repNameLabel: "Rep",
    vacantPlaceholder: "Vacant (leave empty)",
    vacant: "Vacant",
    save: "Save",
    invalidRange: "End month must be on or after the start month.",
    responsibleInMonth: (month, rep) => `Responsible in ${month}: ${rep}`,
    deletePeriod: "Delete this period",
  },
  wizard: {
    uploadTitle: (fileName) => `Upload ${fileName}`,
    subtitle: "Choose where this file's data goes.",
    addToExisting: "Add to existing dataset",
    createNew: "Create new dataset",
    datasetLabel: "Dataset",
    datasetNameLabel: "Dataset name",
    mappingHelp: "Match each column from your file to what it means. Required fields are marked *.",
    selectColumn: "Select a column…",
    mismatch: (name, missing) =>
      `This file doesn't match "${name}"'s saved column mapping — missing: ${missing}. Pick a different dataset, or create a new one instead.`,
    multiFileNote: (n) => `+${n} more file${n === 1 ? "" : "s"} selected — they'll use this same mapping and dataset.`,
    fieldArea: "Area / Region",
    fieldItem: "Item / Product",
    fieldValue: "Value",
    fieldQty: "Quantity",
    fieldMonth: "Month",
    fieldRep: "Rep",
    fieldLine: "Line",
    fieldUniqueId: "Unique row ID (optional)",
    fieldUniqueIdHint:
      "Mapping a Customer ID, invoice, or transaction number here lets an exact repeated row be removed automatically on upload instead of blocking it — without this, two different customers who happen to order the same quantity at the same price would otherwise look identical.",
  },
  dashboard: {
    areasAnalyzed: "Areas analyzed",
    inDecline: "In decline",
    pattern: "Pattern",
    lineWide: "Line-wide",
    localized: "Localized",
    stable: "Stable",
    decisionsRaised: "Decisions raised",
    comparingMonth: (a, b) => `Comparing month ${a} → ${b}`,
    systemicDetected: "line-wide drop detected",
    noSystemicPattern: "no systemic pattern",
    decision: "Decision:",
    biggestMovers: "Biggest movers",
    tapArea: "Tap an area to see its full breakdown below.",
    itemComparison: "Item comparison",
    decline: "Decline",
    growth: "Growth",
    moreInList: (n) => `+${n} more in the list below.`,
    showAll: (n) => `Show all ${n}`,
    showLess: "Show less",
    newEntry: "New",
    allAreas: "All areas",
    noChangeThisMonth: "No significant change this month.",
    partOfLineDrop: "Part of the line-wide drop — see the systemic finding above.",
    valueLabel: "Value:",
    quantityLabel: "Quantity:",
    areaMovedVs: (pct, lineLabel, linePct) =>
      `This area moved ${pct}% vs the ${lineLabel} average of ${linePct}% over the same month.`,
    lineWord: "line",
    decliningStreak: "3-month declining streak",
    yes: "Yes",
    no: "No",
    trendLastMonths: (n) => `Trend — last ${n} months`,
    byItem: "By item",
    allItems: "All items",
    rootCauseItem: "Root cause item:",
    valueDrop: (n) => `${n} value drop`,
    byAreaMonth: (m) => `By area — Month ${m}`,
    top: "Top",
    lowest: "Lowest",
    rootCauseFor: "Root cause for:",
    theLineWideDrop: "the line-wide drop",
    theLineWideDropIn: (c) => `the line-wide drop in ${c}`,
    noDatasets: "No datasets yet — upload a file to get started.",
    couldNotLoad: "Could not load the report.",
    deleteDatasetConfirm: (name) =>
      `Delete "${name}"? This permanently removes all of its uploaded data. This cannot be undone.`,
    byRep: "By rep",
    repComparison: "Rep comparison",
    repLeaderboard: "Rep leaderboard",
  },
  chart: {
    thisArea: "This area:",
    lineAvg: "Line avg:",
    lineAverage: "Line average",
    idx: "(idx)",
    repAvg: "Rep avg:",
    allRepsAverage: "Average across reps",
  },
  findings: {
    inLine: (line) => ` in ${line}`,
    systemicSummary: (dropping, total, linePhrase, prev, latest) =>
      `${dropping} of ${total} areas${linePhrase} dropped together from month ${prev} to ${latest} — this is a line-wide move, not an individual area failing.`,
    systemicDecision: (family) =>
      `Investigate ${family} specifically (stock availability, pricing change, competitor activity) before reviewing any single area's performance.`,
    localSummary: (area, pct) => `${area} dropped ${pct}% and did not move with the rest of the line.`,
    localDecision: (family, area) => `Review the ${family} visit plan and customer coverage specifically in ${area}.`,
    transferSummary: (family, pct, area) => `${family} grew ${pct}% in ${area} while the line overall declined.`,
    transferDecision: (family, area) =>
      `Review what worked for ${family} in ${area} and check whether the same approach applies to similar customers in other areas.`,
  },
  org: {
    assignAreasButton: "Assign areas to reps",
    assignManagersButton: "Assign reps to managers",
    assignAreasTitle: "Assign areas to a rep",
    assignManagersTitle: "Assign reps to a district manager",
    repLabel: "Rep",
    managerLabel: "District manager",
    existingName: "Existing",
    newName: "Add new",
    newNamePlaceholder: "Type a name",
    areasLabel: "Areas",
    repsLabel: "Reps",
    selectedCount: (n) => `${n} selected`,
    selectAll: "Select all",
    clearAll: "Clear",
    monthsLabel: "Months covered",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    noAreas: "No areas in this dataset yet.",
    noReps: "No reps yet — assign areas to a rep first.",
    pickRep: "Choose or type a rep name.",
    pickManager: "Choose or type a manager name.",
    pickAtLeastOneArea: "Pick at least one area.",
    pickAtLeastOneRep: "Pick at least one rep.",
    assignedAreas: (n, rep) => `Assigned ${n} area(s) to ${rep}.`,
    assignedReps: (n, manager) => `${n} rep(s) now report to ${manager}.`,
    managersTitle: "District managers",
    managersSubtitle: "Tap a manager to see their whole team.",
    repCount: (n) => `${n} rep${n === 1 ? "" : "s"}`,
    teamTotal: "Team total, latest month",
    noManagers: "No district managers yet. Use \"Assign reps to managers\" to build the structure.",
    coversMonths: (months) => `Months ${months}`,
    noAreasForRep: "No areas assigned yet.",
    itemsUnderManager: "Items across this team",
    managerOf: (manager) => `Manager: ${manager}`,
    reassignWarning: (rep, manager) => `${rep} currently reports to ${manager} and will be moved.`,
    remove: "Remove",
    pastCoverage: "no longer held",
  },
  units: {
    units: "Units",
    value: "Value",
    unitsNote: "Item charts show units sold.",
    valueNote: "This dataset has no quantity column, so item charts show value, not units.",
  },
  search: {
    placeholder: "Search areas, items, reps, market groups...",
    areasGroup: "Areas",
    itemsGroup: "Items / Drugs",
    repsGroup: "Reps",
    marketGroup: "Market Insights",
    noResults: (query) => `No results for "${query}"`,
  },
  install: {
    bannerTitle: "Install Lumen on this device",
    bannerBody: "Add it to your home screen for one-tap access, like a regular app.",
    installButton: "Install",
    later: "Maybe later",
    sidebarLink: "Add to Home Screen",
    modalTitle: "Add Lumen to your Home Screen",
    androidTitle: "Android (Chrome)",
    androidStep1: "Tap the ⋮ menu in the top-right corner of Chrome.",
    androidStep2: "Tap \"Install app\" or \"Add to Home screen\".",
    androidStep3: "Confirm — Lumen will open like a standalone app from now on.",
    iosTitle: "iPhone / iPad (Safari)",
    iosStep1: "Tap the Share icon (square with an arrow) in Safari's toolbar.",
    iosStep2: "Scroll down and tap \"Add to Home Screen\".",
    iosStep3: "Tap \"Add\" — Lumen's icon will appear on your Home Screen.",
    alreadyInstalled: "Lumen is already installed on this device.",
    close: "Close",
  },
};

const ar: Translations = {
  common: {
    appName: "Lumen",
    tagline: "محرك قرارات المناطق",
    signOut: "تسجيل الخروج",
    cancel: "إلغاء",
    continueLabel: "متابعة",
    hide: "إخفاء",
    details: "التفاصيل",
    none: "(بدون)",
    month: (n) => `شهر ${n}`,
  },
  login: {
    title: "محرك قرارات المناطق",
    subtitle: "ارفع تقرير المبيعات الشهري واحصل على قرارات على مستوى المناطق.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    pleaseWait: "لحظة من فضلك…",
    signIn: "تسجيل الدخول",
    createAccount: "إنشاء حساب",
    noAccount: "ليس لديك حساب؟",
    signUpFree: "سجّل مجانًا",
    haveAccount: "لديك حساب بالفعل؟",
    checkEmail: "تحقق من بريدك الإلكتروني لتأكيد حسابك قبل تسجيل الدخول.",
    domainNotAllowed: "الإيميل ده غير مسموح له بإنشاء حساب. استخدم إيميل الشركة، أو اطلب من المسؤول إضافة نطاقك.",
    forgotPassword: "نسيت كلمة المرور؟",
    resetTitle: "إعادة تعيين كلمة المرور",
    resetSubtitle: "اكتب بريدك الإلكتروني وهنبعتلك رابط لتحديد كلمة مرور جديدة.",
    sendResetLink: "إرسال رابط إعادة التعيين",
    resetLinkSent: "تحقق من بريدك الإلكتروني عشان تلاقي رابط إعادة تعيين كلمة المرور.",
    backToSignIn: "الرجوع لتسجيل الدخول",
  },
  resetPassword: {
    title: "حدد كلمة مرور جديدة",
    subtitle: "اختار كلمة مرور جديدة لحسابك.",
    newPassword: "كلمة المرور الجديدة",
    updateButton: "تحديث كلمة المرور",
    successTitle: "تم تحديث كلمة المرور",
    successBody: "اتغيرت كلمة المرور بنجاح. انت مسجل دخول دلوقتي.",
    continueToApp: "الدخول لـ Lumen",
  },
  home: {
    tagline: "بيانات أكتر، قرارات أبسط. ارفع ملف مبيعاتك الشهري وحوّل أرقام المناطق لإجراءات واضحة وواثقة.",
    trendTitle: "متابعة الاتجاه",
    trendDesc: "بيقارن آخر 3 شهور مش شهر واحد بس، قبل ما يعتبر أي حاجة تغيّر حقيقي.",
    rootCauseTitle: "السبب الجذري",
    rootCauseDesc: "بيفكك كل تغيير حسب مجموعة المنتج عشان يلاقي السبب الحقيقي وراه.",
    decisionsTitle: "قرارات فعلية",
    decisionsDesc: "كل نتيجة بتنتهي بإجراء واحد واضح، مش مجرد رقم.",
    startAnalysis: "ابدأ التحليل",
  },
  sidebar: {
    upload: "+ رفع ملف شهري",
    uploading: "جاري الرفع…",
    year: "السنة",
    analyze: "تحليل",
    loading: "جاري التحميل…",
    datasets: "مجموعات البيانات",
    deleteDataset: (name) => `حذف ${name}`,
    uploadTargets: "+ رفع الأهداف",
  },
  targets: {
    uploadButton: "+ رفع الأهداف",
    modalTitle: (fileName) => `رفع أهداف — ${fileName}`,
    subtitle: "اربط كل عمود بمعناه. الرفع ده هيستبدل كل الأهداف الحالية لمجموعة البيانات والسنة دي.",
    fieldTargetValue: "قيمة الهدف",
    atLeastOneRequired: "اربط عمود واحد على الأقل من المنطقة أو المندوب أو الصنف عشان الأهداف تتطابق مع الفعلي.",
    replaceWarning: "ده هيستبدل كل الأهداف الحالية لمجموعة البيانات دي. الخطوة دي مينفعش نرجع فيها.",
    ofTarget: (pct) => `${pct}% من الهدف`,
    underTarget: "تحت الهدف",
    underTargetBy: (pct) => `تحت الهدف بنسبة ${pct}%`,
    thresholdLabel: "نسبة التنبيه",
    uploadSuccess: (n) => `تم رفع ${n} صف هدف.`,
    monthMismatch: (targetMonths, latestMonth) =>
      `الأهداف اترفعت لشهر ${targetMonths}، لكن آخر شهر فيه مبيعات هو ${latestMonth} — فمفيش حاجة تتقارن بيها ومش هتظهر أي أرقام أهداف. ارفع أهداف لشهر ${latestMonth}، أو ضيف مبيعات الشهر ده.`,
  },
  export: {
    button: "تصدير",
    modalTitle: "تصدير التقرير",
    formatLabel: "الصيغة",
    formatPdf: "PDF",
    formatPptx: "PowerPoint",
    selectAll: "تحديد الكل",
    deselectAll: "إلغاء تحديد الكل",
    groupSummary: "الملخص",
    groupAreas: "المناطق",
    groupItems: "الأصناف",
    groupMarket: "رؤى السوق",
    groupDecisions: "القرارات",
    groupCharts: "الرسوم البيانية",
    groupSections: "أقسام تانية",
    itemSummary: "إحصائيات عامة",
    itemSystemic: "نتيجة جماعية",
    itemDecision: "قرار",
    itemTargets: "الهدف مقابل الفعلي",
    exportButton: "تصدير",
    exporting: "جاري التصدير…",
    noItemsSelected: "اختار عنصر واحد على الأقل عشان تصدّر.",
    generatedOn: (date) => `تم الإنشاء في ${date}`,
    valueLabel: "القيمة",
    changeLabel: "التغيير",
    ofTargetLabel: "% من الهدف",
  },
  corrections: {
    logTitle: "سجل التصحيحات",
    logButton: "📋 سجل التصحيحات",
  },
  editMapping: {
    editSalesButton: "تعديل الربط",
    editSalesTitle: "تعديل ربط أعمدة المبيعات",
    editSalesWarning: "ده هيأثر بس على الملفات الجديدة اللي هترفعها لمجموعة البيانات دي — مش هيغيّر أرقام اترفعت قبل كده. لو عايز تصلح شهر سبق رفعه، ارفعه تاني بدل كده.",
    editLinkButton: "تعديل الربط",
    editLinkTitle: "تعديل طريقة ربط الملف ده",
    save: "حفظ",
  },
  inlineEdit: {
    editHint: "دوس عشان تعدّل",
    renameHint: "دوس عشان تغيّر الاسم — التغيير ده هيتحدث في كل مكان الاسم ده ظاهر فيه",
    editedTitle: (editor, date) => `اتعدّل بواسطة ${editor} في ${date}`,
    saveFailed: "التعديل ده معملوش حفظ.",
    logSectionTitle: "سجل التعديلات",
    logEmpty: "لسه مفيش أرقام اتعدّلت في مجموعة البيانات دي.",
    changedFrom: (oldValue, newValue) => `${oldValue} ← ${newValue}`,
    undoToastMessage: "اتعدّلت القيمة.",
    undoButton: "تراجع",
    undoneBadge: "↺ اتراجع عنه",
  },
  linkedFiles: {
    panelTitle: "الملفات المرتبطة",
    addButton: "+ إضافة ملف مرتبط",
    fileTypeLabel: "نوع الملف",
    typeAchievement: "التحقيق (Achievement)",
    typeKpis: "مؤشرات الأداء (KPIs)",
    typeOther: "تاني",
    displayNameLabel: "اسم العرض",
    mappingHelp: "اربط أعمدة الملف ده بالأبعاد اللي هتوصله ببيانات المبيعات.",
    joinKeysLabel: "اربط الملف ده عن طريق",
    joinKeyArea: "المنطقة",
    joinKeyRep: "المندوب",
    joinKeyLine: "الخط",
    joinKeyMonth: "الشهر",
    joinKeysHint: "اختار الأعمدة اللي هتوصل الملف ده بنفس المناطق والشهور بتاعة بيانات المبيعات.",
    atLeastOneJoinKey: "الشهر لازم يتربط، بالإضافة لواحد على الأقل من المنطقة أو المندوب أو الخط.",
    replaceButton: "استبدال",
    deleteButton: "حذف",
    deleteConfirm: (name) => `حذف "${name}"؟ ده هيمسح كل بياناته نهائيًا. الخطوة دي مينفعش نرجع فيها.`,
    modalTitle: (fileName) => `إضافة ملف مرتبط — ${fileName}`,
    replaceModalTitle: (fileName) => `استبدال بـ ${fileName}`,
    uploadSuccess: (n) => `تم رفع ${n} صف.`,
    linkedContextTitle: "بيانات مرتبطة",
  },
  ims: {
    tabLabel: "رؤى السوق (IMS)",
    salesTabLabel: "المبيعات",
    emptyTitle: "لسه مفيش بيانات IMS",
    emptyBody:
      "ارفع ملف حصة سوقية (IQVIA IMS) أو بيانات ماركتنج عشان تشوف اتجاهات الحصة السوقية، مقارنة بالمنافسين، وملاحظات على أي تغيير كبير في الحصة — منفصل تمامًا عن تحليل المبيعات فوق.",
    uploadButton: "+ رفع ملف IMS",
    modalTitle: (fileName) => `تحديد أعمدة ${fileName}`,
    fieldArea: "المنطقة",
    fieldProduct: "المنتج",
    fieldMarketShare: "الحصة السوقية",
    fieldMonth: "الشهر",
    fieldCompany: "الشركة (اختياري)",
    fieldCompanyHint: "محتاجه بس لو الملف فيه حصة أكتر من شركة لكل منطقة/منتج/شهر.",
    fieldGrowthRate: "معدل النمو (اختياري)",
    fieldGrowthRateHint: "لو الملف ده فيه عمود نمو خاص بيه (زي \"GR\")، حدده هنا عشان تطلع أرقام نمو حقيقية بدل \"غير متاح\".",
    atLeastOneOfAreaProduct: "حدد عمود واحد على الأقل من المنطقة أو المنتج — أنهي واحد فيهم موجود فعلاً في الملف.",
    fixedMonthLabel: "الملف ده بتاع شهر",
    fixedMonthPlaceholder: "مثلاً 6",
    fixedMonthHint: "مفيش عمود شهر محدد — الملف ده هيتعامل معاه كلقطة (snapshot) لشهر واحد بالرقم اللي هتكتبه هنا.",
    fixedProductLabel: "الجدول ده بتاع منتج",
    fixedProductPlaceholder: "مثلاً Lezberg Amlo",
    fixedProductHint: "مفيش عمود منتج محدد — كل صف (زي كل شركة منافسة) هيتسجل تحت اسم المنتج ده.",
    ownCompanyLabel: "أنهي قيمة في العمود ده هي إحنا؟",
    ownCompanyHint: "أي قيمة تانية في العمود ده هتتحسب منافس.",
    pdfExtracting: "بيتم قراءة ملف PDF…",
    pdfExtractFailed: (err) => `تعذّرت قراءة ملف الـ PDF: ${err}`,
    pdfPageImageWarning: "محتوى الصفحة دي شكله صورة مش نص قابل للاستخراج — مقدرناش نستخرج جدول منها تلقائيًا.",
    pdfPageNoTableWarning: "مقدرناش نلاقي جدول واضح في الصفحة دي.",
    pdfSkip: "تجاهل الصفحة دي",
    pdfEnterManually: "دخّل بياناتها يدويًا",
    pdfManualHint: "السطر الأول = أسماء الأعمدة. افصل القيم بفاصلة أو Tab.",
    pdfManualPlaceholder: "المنطقة,المنتج,الحصة السوقية,الشهر\nDomiat 1,Drug A,24.5,1",
    pdfUseManual: "استخدم البيانات دي",
    pdfUseTable: "استخدم الجدول ده",
    pdfPageLabel: (n) => `صفحة ${n}`,
    pdfTablesFound: (n) => `${n} جدول اتلاقى`,
    pdfNoTablesAtAll: "مقدرناش نستخرج أي جدول بثقة من ملف الـ PDF ده. تقدر تدخّل بيانات أي صفحة يدويًا تحت.",
    pdfBackToPages: "→ رجوع للصفحات",
    pdfSelectAll: "اختار كل الجداول",
    pdfSelectedCount: (n) => `${n} جدول متختار`,
    pdfContinueWithSelected: (n) => `متابعة بـ ${n} جدول`,
    pdfMappingStepOf: (i, n) => `جدول ${i} من ${n}`,
    pdfManualAdded: "✓ اتضاف للاختيار",
    pdfRemove: "إزالة",
    pdfApplyToAllSimilar: (n) => `طبّق على ${n} جدول مشابه كمان`,
    pdfAppliedToSimilar: (n) => `اتطبّق على ${n} جدول مشابه كمان.`,
    save: "حفظ",
    uploadSuccess: (n) => `تم رفع ${n} صف.`,
    deleteButton: "حذف",
    deleteConfirm: (name) => `حذف "${name}"؟ ده هيمسح كل بياناته المرفوعة نهائيًا.`,
    filesTitle: "ملفات IMS",
    byAreaProduct: "الحصة السوقية حسب المنطقة والمنتج",
    latestShare: "آخر حصة",
    change: "التغيير",
    vsMonthsAgo: (n) => `مقابل ${n} شهر قبل كده`,
    topCompetitor: "أقوى منافس",
    noCompetitorData: "مفيش بيانات منافسين",
    findingsTitle: "الملاحظات",
    noFindings: "مفيش تغييرات كبيرة في الحصة السوقية.",
    shareDropSummary: (product, area, pct, months) => {
      const entity = product && area ? `حصة ${product} في ${area}` : `حصة ${product ?? area}`;
      return `${entity} قلت ${Math.abs(pct)} نقطة خلال آخر ${months} شهر.`;
    },
    shareGainSummary: (product, area, pct, months) => {
      const entity = product && area ? `حصة ${product} في ${area}` : `حصة ${product ?? area}`;
      return `${entity} زادت ${pct} نقطة خلال آخر ${months} شهر.`;
    },
    competitorMoveNote: (company, pct) =>
      ` في نفس الوقت، ${company} ${pct > 0 ? "كسب" : "خسر"} ${Math.abs(pct)} نقطة.`,
    marketOutpacingUs: (area, salesPct, sharePct) =>
      `${area}: مبيعاتنا تحركت ${salesPct}% بس حصتنا تحركت ${sharePct} نقطة — السوق كله بيكبر أسرع مننا.`,
    weOutpacingMarket: (area, salesPct, sharePct) =>
      `${area}: مبيعاتنا تحركت ${salesPct}% بس حصتنا تحركت ${sharePct} نقطة — إحنا بنتفوق على سوق بيصغر أو بيتباطأ.`,
    notAvailable: "غير متاح",
    ytdMarketShare: "الحصة السوقية (YTD)",
    rankInCategory: (rank, total) => `الترتيب #${rank} من ${total} في الفئة`,
    rankByShare: (rank, total) => `الترتيب #${rank} من ${total} حسب الحصة`,
    ourGrowth: "نمونا",
    ourGrowthSubtitle: "آخر فترة",
    marketGrowthLabel: "نمو السوق",
    marketGrowthSubtitle: "متوسط الفئة، آخر فترة",
    shareGainLossLabel: "كسب/خسارة الحصة",
    shareGainLossSubtitle: "التغير في نقاط الحصة السوقية",
    marketRankingTitle: "ترتيب السوق",
    monthlyTrendTitle: "الاتجاه الشهري — إحنا مقابل أكبر المنافسين",
    analysisTitleLabel: "تحليل",
    positionShareLine: (share, rank) => `آخر حصة: ${share} — ${rank}.`,
    positionGrowthLine: (ourGrowth, marketGrowth) => `نمونا: ${ourGrowth} مقابل نمو السوق: ${marketGrowth}.`,
    competitorsTitle: "المنافسون",
  },
  repHistory: {
    title: "سجل المناديب",
    addPeriod: "+ إضافة فترة",
    startMonth: "من شهر",
    endMonth: "لشهر",
    repNameLabel: "المندوب",
    vacantPlaceholder: "شاغرة (اتركه فارغًا)",
    vacant: "شاغرة",
    save: "حفظ",
    invalidRange: "شهر النهاية لازم يكون بعد أو نفس شهر البداية.",
    responsibleInMonth: (month, rep) => `المسؤول في ${month}: ${rep}`,
    deletePeriod: "حذف الفترة دي",
  },
  wizard: {
    uploadTitle: (fileName) => `رفع ${fileName}`,
    subtitle: "اختار بيانات الملف ده هتروح فين.",
    addToExisting: "إضافة لمجموعة بيانات موجودة",
    createNew: "إنشاء مجموعة بيانات جديدة",
    datasetLabel: "مجموعة البيانات",
    datasetNameLabel: "اسم مجموعة البيانات",
    mappingHelp: "اربط كل عمود في ملفك بمعناه. الحقول المطلوبة عليها علامة *.",
    selectColumn: "اختر عمود…",
    mismatch: (name, missing) =>
      `الملف ده مش مطابق للأعمدة المحفوظة في "${name}" — ناقص: ${missing}. اختار مجموعة بيانات تانية، أو أنشئ مجموعة جديدة بدل كده.`,
    multiFileNote: (n) => `+${n} ملف تاني متختار — هيستخدموا نفس الربط ونفس مجموعة البيانات دي.`,
    fieldArea: "المنطقة / الإقليم",
    fieldItem: "الصنف / المنتج",
    fieldValue: "القيمة",
    fieldQty: "الكمية",
    fieldMonth: "الشهر",
    fieldRep: "المندوب",
    fieldLine: "الخط",
    fieldUniqueId: "معرّف فريد للصف (اختياري)",
    fieldUniqueIdHint:
      "لو ربطت عمود زي رقم العميل (Customer ID) أو رقم الفاتورة هنا، أي صف متطابق تمامًا هيتشال تلقائيًا وقت الرفع من غير ما يوقف الرفع — من غيره، عميلين مختلفين طلبوا نفس الكمية بنفس السعر هيبانوا وكأنهم نفس الصف.",
  },
  dashboard: {
    areasAnalyzed: "المناطق المحللة",
    inDecline: "في انخفاض",
    pattern: "النمط",
    lineWide: "على مستوى الخط",
    localized: "محلي",
    stable: "مستقر",
    decisionsRaised: "القرارات المطروحة",
    comparingMonth: (a, b) => `مقارنة شهر ${a} → ${b}`,
    systemicDetected: "تم رصد انخفاض جماعي",
    noSystemicPattern: "لا يوجد نمط جماعي",
    decision: "القرار:",
    biggestMovers: "أكبر التحركات",
    tapArea: "دوس على منطقة عشان تشوف تفاصيلها كاملة تحت.",
    itemComparison: "مقارنة الأصناف",
    decline: "انخفاض",
    growth: "نمو",
    moreInList: (n) => `+${n} كمان في القائمة تحت.`,
    showAll: (n) => `اعرض كل الـ ${n}`,
    showLess: "اعرض أقل",
    newEntry: "جديد",
    allAreas: "كل المناطق",
    noChangeThisMonth: "مفيش تغيير ملحوظ الشهر ده.",
    partOfLineDrop: "جزء من الانخفاض الجماعي — شوف النتيجة الرئيسية فوق.",
    valueLabel: "القيمة:",
    quantityLabel: "الكمية:",
    areaMovedVs: (pct, lineLabel, linePct) =>
      `المنطقة دي تحركت ${pct}% مقابل متوسط ${lineLabel} اللي كان ${linePct}% في نفس الشهر.`,
    lineWord: "الخط",
    decliningStreak: "انخفاض متواصل لـ 3 شهور",
    yes: "نعم",
    no: "لا",
    trendLastMonths: (n) => `الاتجاه — آخر ${n} شهور`,
    byItem: "حسب الصنف",
    allItems: "كل الأصناف",
    rootCauseItem: "الصنف السبب:",
    valueDrop: (n) => `انخفاض قيمة ${n}`,
    byAreaMonth: (m) => `حسب المنطقة — شهر ${m}`,
    top: "الأعلى",
    lowest: "الأقل",
    rootCauseFor: "سبب الانخفاض في:",
    theLineWideDrop: "الانخفاض الجماعي",
    theLineWideDropIn: (c) => `الانخفاض الجماعي في ${c}`,
    noDatasets: "لسه مفيش مجموعات بيانات — ارفع ملف عشان تبدأ.",
    couldNotLoad: "معرفناش نجيب التقرير.",
    deleteDatasetConfirm: (name) =>
      `حذف "${name}"؟ ده هيمسح كل البيانات اللي اترفعت فيها نهائيًا. الخطوة دي مينفعش نرجع فيها.`,
    byRep: "حسب المندوب",
    repComparison: "مقارنة المناديب",
    repLeaderboard: "ترتيب المناديب",
  },
  chart: {
    thisArea: "المنطقة دي:",
    lineAvg: "متوسط الخط:",
    lineAverage: "متوسط الخط",
    idx: "(مؤشر)",
    repAvg: "متوسط المناديب:",
    allRepsAverage: "متوسط كل المناديب",
  },
  findings: {
    inLine: (line) => ` في ${line}`,
    systemicSummary: (dropping, total, linePhrase, prev, latest) =>
      `${dropping} من ${total} مناطق${linePhrase} نزلوا مع بعض من شهر ${prev} لشهر ${latest} — ده تحرك جماعي، مش فشل منطقة واحدة بس.`,
    systemicDecision: (family) =>
      `افحص ${family} تحديدًا (توافر المخزون، تغيير السعر، نشاط المنافسين) قبل ما تراجع أداء أي منطقة لوحدها.`,
    localSummary: (area, pct) => `${area} نزلت ${pct}% ومتحركتش مع باقي الخط.`,
    localDecision: (family, area) => `راجع خطة زيارات ${family} وتغطية العملاء تحديدًا في ${area}.`,
    transferSummary: (family, pct, area) => `${family} زاد ${pct}% في ${area} في حين إن الخط ككل نزل.`,
    transferDecision: (family, area) =>
      `راجع إيه اللي نجح مع ${family} في ${area} وشوف لو نفس الأسلوب ينفع مع عملاء مشابهين في مناطق تانية.`,
  },
  org: {
    assignAreasButton: "ربط المناطق بالمناديب",
    assignManagersButton: "ربط المناديب بالمديرين",
    assignAreasTitle: "ربط مناطق بمندوب",
    assignManagersTitle: "ربط مناديب بمدير منطقة",
    repLabel: "المندوب",
    managerLabel: "مدير المنطقة",
    existingName: "موجود",
    newName: "إضافة جديد",
    newNamePlaceholder: "اكتب الاسم",
    areasLabel: "المناطق",
    repsLabel: "المناديب",
    selectedCount: (n) => `${n} مختارة`,
    selectAll: "اختيار الكل",
    clearAll: "مسح",
    monthsLabel: "الشهور المغطاة",
    save: "حفظ",
    saving: "جاري الحفظ…",
    cancel: "إلغاء",
    noAreas: "مفيش مناطق في مجموعة البيانات دي لسه.",
    noReps: "مفيش مناديب لسه — اربط مناطق بمندوب الأول.",
    pickRep: "اختار أو اكتب اسم مندوب.",
    pickManager: "اختار أو اكتب اسم مدير.",
    pickAtLeastOneArea: "اختار منطقة واحدة على الأقل.",
    pickAtLeastOneRep: "اختار مندوب واحد على الأقل.",
    assignedAreas: (n, rep) => `تم ربط ${n} منطقة بـ${rep}.`,
    assignedReps: (n, manager) => `${n} مندوب بقوا تحت ${manager}.`,
    managersTitle: "مديرو المناطق",
    managersSubtitle: "اضغط على مدير عشان تشوف فريقه كامل.",
    repCount: (n) => `${n} مندوب`,
    teamTotal: "إجمالي الفريق، آخر شهر",
    noManagers: "مفيش مديرين لسه. استخدم \"ربط المناديب بالمديرين\" عشان تبني الهيكل.",
    coversMonths: (months) => `شهور ${months}`,
    noAreasForRep: "مفيش مناطق مربوطة لسه.",
    itemsUnderManager: "الأصناف عبر الفريق ده",
    managerOf: (manager) => `المدير: ${manager}`,
    reassignWarning: (rep, manager) => `${rep} تابع حالياً لـ${manager} وهيتنقل.`,
    remove: "إزالة",
    pastCoverage: "مش تابعة له حالياً",
  },
  units: {
    units: "وحدات",
    value: "قيمة",
    unitsNote: "شارتس الأصناف بتعرض عدد الوحدات المباعة.",
    valueNote: "مجموعة البيانات دي مفيهاش عمود كمية، فشارتس الأصناف بتعرض القيمة المالية مش الوحدات.",
  },
  search: {
    placeholder: "دوّر على منطقة، صنف، مندوب، مجموعة سوق...",
    areasGroup: "مناطق",
    itemsGroup: "أصناف / أدوية",
    repsGroup: "مناديب",
    marketGroup: "رؤى السوق",
    noResults: (query) => `مفيش نتائج لـ "${query}"`,
  },
  install: {
    bannerTitle: "ثبّت Lumen على جهازك",
    bannerBody: "ضيفه للشاشة الرئيسية عشان توصله بلمسة واحدة، زي أي تطبيق عادي.",
    installButton: "تثبيت",
    later: "لاحقًا",
    sidebarLink: "إضافة للشاشة الرئيسية",
    modalTitle: "إضافة Lumen للشاشة الرئيسية",
    androidTitle: "أندرويد (Chrome)",
    androidStep1: "اضغط على قائمة ⋮ في أعلى يمين Chrome.",
    androidStep2: "اضغط \"تثبيت التطبيق\" أو \"إضافة إلى الشاشة الرئيسية\".",
    androidStep3: "أكّد — هيفتح Lumen من دلوقتي زي تطبيق مستقل.",
    iosTitle: "آيفون / آيباد (Safari)",
    iosStep1: "اضغط على أيقونة المشاركة (مربع بسهم) في شريط أدوات Safari.",
    iosStep2: "انزل لتحت واضغط \"إضافة إلى الشاشة الرئيسية\".",
    iosStep3: "اضغط \"إضافة\" — هتظهر أيقونة Lumen على شاشتك الرئيسية.",
    alreadyInstalled: "Lumen متثبت بالفعل على الجهاز ده.",
    close: "إغلاق",
  },
};

export const translations: Record<Lang, Translations> = { en, ar };
