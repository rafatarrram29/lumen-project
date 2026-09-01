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
    pendingReviewNotice: string;
    generatedOn: (date: string) => string;
    valueLabel: string;
    changeLabel: string;
    ofTargetLabel: string;
  };
  corrections: {
    flagButton: string;
    modalTitle: string;
    issueTypeLabel: string;
    typeWrongNumber: string;
    typeWrongLink: string;
    typeBadDecision: string;
    typeOther: string;
    commentLabel: string;
    commentPlaceholder: string;
    submit: string;
    submitSuccess: string;
    logTitle: string;
    logButton: string;
    logEmpty: string;
    statusOpen: string;
    statusResolved: string;
    markResolved: string;
    markOpen: string;
  };
  editMapping: {
    editSalesButton: string;
    editSalesTitle: string;
    editSalesWarning: string;
    editLinkButton: string;
    editLinkTitle: string;
    save: string;
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
    joinKeyCluster: string;
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
    fieldCluster: string;
  };
  dashboard: {
    areasAnalyzed: string;
    inDecline: string;
    pattern: string;
    clusterWide: string;
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
    allAreas: string;
    noChangeThisMonth: string;
    partOfClusterDrop: string;
    valueLabel: string;
    quantityLabel: string;
    areaMovedVs: (pct: number, clusterLabel: string, clusterPct: number) => string;
    clusterWord: string;
    decliningStreak: string;
    yes: string;
    no: string;
    valueExplainer: string;
    trendLastMonths: (n: number) => string;
    byItem: string;
    rootCauseItem: string;
    valueDrop: (n: string) => string;
    byAreaMonth: (m: number) => string;
    top: string;
    lowest: string;
    rootCauseFor: string;
    theClusterWideDrop: string;
    theClusterWideDropIn: (c: string) => string;
    noDatasets: string;
    couldNotLoad: string;
    deleteDatasetConfirm: (name: string) => string;
    byRep: string;
    repComparison: string;
    repLeaderboard: string;
  };
  chart: {
    indexedCaption: (areaLabel: string, compareLabel: string) => string;
    thisArea: string;
    clusterAvg: string;
    clusterAverage: string;
    idx: string;
    repAvg: string;
    allRepsAverage: string;
  };
  findings: {
    inCluster: (cluster: string) => string;
    systemicSummary: (dropping: number, total: number, clusterPhrase: string, prev: number, latest: number) => string;
    systemicDecision: (family: string) => string;
    localSummary: (area: string, pct: number) => string;
    localDecision: (family: string, area: string) => string;
    transferSummary: (family: string, pct: number, area: string) => string;
    transferDecision: (family: string, area: string) => string;
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
    pendingReviewNotice: "Some findings in this report are still under review.",
    generatedOn: (date) => `Generated on ${date}`,
    valueLabel: "Value",
    changeLabel: "Change",
    ofTargetLabel: "% of target",
  },
  corrections: {
    flagButton: "🚩 Flag issue",
    modalTitle: "Flag an issue",
    issueTypeLabel: "What's wrong?",
    typeWrongNumber: "Wrong number",
    typeWrongLink: "Files linked incorrectly",
    typeBadDecision: "Decision doesn't make sense",
    typeOther: "Something else",
    commentLabel: "Describe the issue",
    commentPlaceholder: "What looks wrong, and what did you expect instead?",
    submit: "Submit",
    submitSuccess: "Thanks — logged.",
    logTitle: "Correction log",
    logButton: "📋 Correction log",
    logEmpty: "No issues flagged for this dataset yet.",
    statusOpen: "Open",
    statusResolved: "Resolved",
    markResolved: "Mark resolved",
    markOpen: "Reopen",
  },
  editMapping: {
    editSalesButton: "Edit mapping",
    editSalesTitle: "Edit sales column mapping",
    editSalesWarning: "This only affects new uploads to this dataset — it doesn't change numbers already uploaded. To fix a month you already uploaded, re-upload it instead.",
    editLinkButton: "Edit link",
    editLinkTitle: "Edit how this file is linked",
    save: "Save",
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
    joinKeyCluster: "Cluster",
    joinKeyMonth: "Month",
    joinKeysHint: "Pick which columns connect this file to the same areas and months as your sales data.",
    atLeastOneJoinKey: "Month must be linked, along with at least one of Area, Rep, or Cluster.",
    replaceButton: "Replace",
    deleteButton: "Delete",
    deleteConfirm: (name) => `Delete "${name}"? This permanently removes all of its data. This cannot be undone.`,
    modalTitle: (fileName) => `Add linked file — ${fileName}`,
    replaceModalTitle: (fileName) => `Replace with ${fileName}`,
    uploadSuccess: (n) => `Uploaded ${n} rows.`,
    linkedContextTitle: "Linked data",
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
    fieldCluster: "Cluster",
  },
  dashboard: {
    areasAnalyzed: "Areas analyzed",
    inDecline: "In decline",
    pattern: "Pattern",
    clusterWide: "Cluster-wide",
    localized: "Localized",
    stable: "Stable",
    decisionsRaised: "Decisions raised",
    comparingMonth: (a, b) => `Comparing month ${a} → ${b}`,
    systemicDetected: "cluster-wide drop detected",
    noSystemicPattern: "no systemic pattern",
    decision: "Decision:",
    biggestMovers: "Biggest movers",
    tapArea: "Tap an area to see its full breakdown below.",
    itemComparison: "Item comparison",
    decline: "Decline",
    growth: "Growth",
    moreInList: (n) => `+${n} more in the list below.`,
    allAreas: "All areas",
    noChangeThisMonth: "No significant change this month.",
    partOfClusterDrop: "Part of the cluster-wide drop — see the systemic finding above.",
    valueLabel: "Value:",
    quantityLabel: "Quantity:",
    areaMovedVs: (pct, clusterLabel, clusterPct) =>
      `This area moved ${pct}% vs the ${clusterLabel} average of ${clusterPct}% over the same month.`,
    clusterWord: "cluster",
    decliningStreak: "3-month declining streak",
    yes: "Yes",
    no: "No",
    valueExplainer:
      '"Value" is the sum of the mapped Value column from your uploaded file (all items combined, no currency conversion). "Quantity" is the sum of the mapped Quantity column for the same area and month.',
    trendLastMonths: (n) => `Trend — last ${n} months`,
    byItem: "By item",
    rootCauseItem: "Root cause item:",
    valueDrop: (n) => `${n} value drop`,
    byAreaMonth: (m) => `By area — Month ${m}`,
    top: "Top",
    lowest: "Lowest",
    rootCauseFor: "Root cause for:",
    theClusterWideDrop: "the cluster-wide drop",
    theClusterWideDropIn: (c) => `the cluster-wide drop in ${c}`,
    noDatasets: "No datasets yet — upload a file to get started.",
    couldNotLoad: "Could not load the report.",
    deleteDatasetConfirm: (name) =>
      `Delete "${name}"? This permanently removes all of its uploaded data. This cannot be undone.`,
    byRep: "By rep",
    repComparison: "Rep comparison",
    repLeaderboard: "Rep leaderboard",
  },
  chart: {
    indexedCaption: (areaLabel, compareLabel) =>
      `Indexed to 100 at the first month shown, so ${areaLabel} and the ${compareLabel.toLowerCase()} are comparable regardless of scale.`,
    thisArea: "This area:",
    clusterAvg: "Cluster avg:",
    clusterAverage: "Cluster average",
    idx: "(idx)",
    repAvg: "Rep avg:",
    allRepsAverage: "Average across reps",
  },
  findings: {
    inCluster: (cluster) => ` in ${cluster}`,
    systemicSummary: (dropping, total, clusterPhrase, prev, latest) =>
      `${dropping} of ${total} areas${clusterPhrase} dropped together from month ${prev} to ${latest} — this is a cluster-wide move, not an individual area failing.`,
    systemicDecision: (family) =>
      `Investigate ${family} specifically (stock availability, pricing change, competitor activity) before reviewing any single area's performance.`,
    localSummary: (area, pct) => `${area} dropped ${pct}% and did not move with the rest of the cluster.`,
    localDecision: (family, area) => `Review the ${family} visit plan and customer coverage specifically in ${area}.`,
    transferSummary: (family, pct, area) => `${family} grew ${pct}% in ${area} while the cluster overall declined.`,
    transferDecision: (family, area) =>
      `Review what worked for ${family} in ${area} and check whether the same approach applies to similar customers in other areas.`,
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
    pendingReviewNotice: "بعض النتائج في التقرير ده لسه قيد المراجعة.",
    generatedOn: (date) => `تم الإنشاء في ${date}`,
    valueLabel: "القيمة",
    changeLabel: "التغيير",
    ofTargetLabel: "% من الهدف",
  },
  corrections: {
    flagButton: "🚩 الإبلاغ عن مشكلة",
    modalTitle: "الإبلاغ عن مشكلة",
    issueTypeLabel: "إيه المشكلة؟",
    typeWrongNumber: "رقم غلط",
    typeWrongLink: "ربط ملفات غلط",
    typeBadDecision: "القرار مش منطقي",
    typeOther: "حاجة تانية",
    commentLabel: "اوصف المشكلة",
    commentPlaceholder: "إيه اللي شكله غلط، وإيه اللي كنت متوقعه بدل كده؟",
    submit: "إرسال",
    submitSuccess: "شكرًا — اتسجلت.",
    logTitle: "سجل التصحيحات",
    logButton: "📋 سجل التصحيحات",
    logEmpty: "لسه مفيش مشاكل متبلّغ عنها في مجموعة البيانات دي.",
    statusOpen: "مفتوحة",
    statusResolved: "اتحلت",
    markResolved: "تحديد كمُتحلة",
    markOpen: "إعادة فتح",
  },
  editMapping: {
    editSalesButton: "تعديل الربط",
    editSalesTitle: "تعديل ربط أعمدة المبيعات",
    editSalesWarning: "ده هيأثر بس على الملفات الجديدة اللي هترفعها لمجموعة البيانات دي — مش هيغيّر أرقام اترفعت قبل كده. لو عايز تصلح شهر سبق رفعه، ارفعه تاني بدل كده.",
    editLinkButton: "تعديل الربط",
    editLinkTitle: "تعديل طريقة ربط الملف ده",
    save: "حفظ",
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
    joinKeyCluster: "الكلستر",
    joinKeyMonth: "الشهر",
    joinKeysHint: "اختار الأعمدة اللي هتوصل الملف ده بنفس المناطق والشهور بتاعة بيانات المبيعات.",
    atLeastOneJoinKey: "الشهر لازم يتربط، بالإضافة لواحد على الأقل من المنطقة أو المندوب أو الكلستر.",
    replaceButton: "استبدال",
    deleteButton: "حذف",
    deleteConfirm: (name) => `حذف "${name}"؟ ده هيمسح كل بياناته نهائيًا. الخطوة دي مينفعش نرجع فيها.`,
    modalTitle: (fileName) => `إضافة ملف مرتبط — ${fileName}`,
    replaceModalTitle: (fileName) => `استبدال بـ ${fileName}`,
    uploadSuccess: (n) => `تم رفع ${n} صف.`,
    linkedContextTitle: "بيانات مرتبطة",
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
    fieldCluster: "الكلستر",
  },
  dashboard: {
    areasAnalyzed: "المناطق المحللة",
    inDecline: "في انخفاض",
    pattern: "النمط",
    clusterWide: "على مستوى الكلستر",
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
    allAreas: "كل المناطق",
    noChangeThisMonth: "مفيش تغيير ملحوظ الشهر ده.",
    partOfClusterDrop: "جزء من الانخفاض الجماعي — شوف النتيجة الرئيسية فوق.",
    valueLabel: "القيمة:",
    quantityLabel: "الكمية:",
    areaMovedVs: (pct, clusterLabel, clusterPct) =>
      `المنطقة دي تحركت ${pct}% مقابل متوسط ${clusterLabel} اللي كان ${clusterPct}% في نفس الشهر.`,
    clusterWord: "الكلستر",
    decliningStreak: "انخفاض متواصل لـ 3 شهور",
    yes: "نعم",
    no: "لا",
    valueExplainer:
      '"القيمة" هي مجموع عمود القيمة المحدد من ملفك (كل الأصناف مع بعض، من غير تحويل عملة). "الكمية" هي مجموع عمود الكمية المحدد لنفس المنطقة والشهر.',
    trendLastMonths: (n) => `الاتجاه — آخر ${n} شهور`,
    byItem: "حسب الصنف",
    rootCauseItem: "الصنف السبب:",
    valueDrop: (n) => `انخفاض قيمة ${n}`,
    byAreaMonth: (m) => `حسب المنطقة — شهر ${m}`,
    top: "الأعلى",
    lowest: "الأقل",
    rootCauseFor: "سبب الانخفاض في:",
    theClusterWideDrop: "الانخفاض الجماعي",
    theClusterWideDropIn: (c) => `الانخفاض الجماعي في ${c}`,
    noDatasets: "لسه مفيش مجموعات بيانات — ارفع ملف عشان تبدأ.",
    couldNotLoad: "معرفناش نجيب التقرير.",
    deleteDatasetConfirm: (name) =>
      `حذف "${name}"؟ ده هيمسح كل البيانات اللي اترفعت فيها نهائيًا. الخطوة دي مينفعش نرجع فيها.`,
    byRep: "حسب المندوب",
    repComparison: "مقارنة المناديب",
    repLeaderboard: "ترتيب المناديب",
  },
  chart: {
    indexedCaption: (areaLabel, compareLabel) =>
      `الأرقام محسوبة كمؤشر يبدأ من 100 في أول شهر، عشان ${areaLabel} و${compareLabel} يبقوا قابلين للمقارنة مهما اختلف حجم الأرقام.`,
    thisArea: "المنطقة دي:",
    clusterAvg: "متوسط الكلستر:",
    clusterAverage: "متوسط الكلستر",
    idx: "(مؤشر)",
    repAvg: "متوسط المناديب:",
    allRepsAverage: "متوسط كل المناديب",
  },
  findings: {
    inCluster: (cluster) => ` في ${cluster}`,
    systemicSummary: (dropping, total, clusterPhrase, prev, latest) =>
      `${dropping} من ${total} مناطق${clusterPhrase} نزلوا مع بعض من شهر ${prev} لشهر ${latest} — ده تحرك جماعي، مش فشل منطقة واحدة بس.`,
    systemicDecision: (family) =>
      `افحص ${family} تحديدًا (توافر المخزون، تغيير السعر، نشاط المنافسين) قبل ما تراجع أداء أي منطقة لوحدها.`,
    localSummary: (area, pct) => `${area} نزلت ${pct}% ومتحركتش مع باقي الكلستر.`,
    localDecision: (family, area) => `راجع خطة زيارات ${family} وتغطية العملاء تحديدًا في ${area}.`,
    transferSummary: (family, pct, area) => `${family} زاد ${pct}% في ${area} في حين إن الكلستر ككل نزل.`,
    transferDecision: (family, area) =>
      `راجع إيه اللي نجح مع ${family} في ${area} وشوف لو نفس الأسلوب ينفع مع عملاء مشابهين في مناطق تانية.`,
  },
};

export const translations: Record<Lang, Translations> = { en, ar };
