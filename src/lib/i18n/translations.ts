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
  };
  chart: {
    indexedCaption: (areaLabel: string) => string;
    thisArea: string;
    clusterAvg: string;
    clusterAverage: string;
    idx: string;
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
  },
  chart: {
    indexedCaption: (areaLabel) =>
      `Indexed to 100 at the first month shown, so ${areaLabel} and the cluster average are comparable regardless of scale.`,
    thisArea: "This area:",
    clusterAvg: "Cluster avg:",
    clusterAverage: "Cluster average",
    idx: "(idx)",
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
    clusterWide: "جماعي",
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
  },
  chart: {
    indexedCaption: (areaLabel) =>
      `الأرقام محسوبة كمؤشر يبدأ من 100 في أول شهر، عشان ${areaLabel} ومتوسط الكلستر يبقوا قابلين للمقارنة مهما اختلف حجم الأرقام.`,
    thisArea: "المنطقة دي:",
    clusterAvg: "متوسط الكلستر:",
    clusterAverage: "متوسط الكلستر",
    idx: "(مؤشر)",
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
