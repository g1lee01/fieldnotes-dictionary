const STORAGE = {
  terms: "fieldnotes-terms-v1",
  saved: "fieldnotes-saved-v1",
  answerLanguage: "fieldnotes-answer-language-v1",
  mode: "fieldnotes-mode-v1",
};
const categories = window.FIELDNOTES_CATEGORIES;
const seedTerms = window.FIELDNOTES_SEED;
const seedAdditions = window.FIELDNOTES_SEED_ADDITIONS;
const collections = window.FIELDNOTES_COLLECTIONS;
const definitionKeyTerms = window.FIELDNOTES_DEFINITION_KEY_TERMS;
const followUpPattern = /\b(it|that|this|they|them|what about|then|and|difference|compare)\b|그럼|그러면|이 경우|그 경우|그건|그것|위의|방금|차이는|차이점|더 자세히|자세히|후속|추가로/i;
const comparePattern = /\b(compare|comparison|vs\.?|versus|difference|differentiate)\b|비교|차이|구분해|어떤 게 다르/i;
const actionPattern = /어떻게|절차|방법|해야|할까요|가능|상황|경우|준비|확인|인도|대응|처리|실무|handle|respond|deal with|how (do|can|should)|what should|what happens|in practice|examples|steps|process|scenario|without|release/i;
const jargonGlossary = [
  { term: "UCP 600", ko: "신용장통일규칙", en: "Uniform Customs and Practice for Documentary Credits" },
  { term: "HS Code", ko: "국제통일상품분류 코드", en: "Harmonized System Code" },
  { term: "D/P", ko: "지급인도", en: "Documents against Payment" },
  { term: "D/A", ko: "인수인도", en: "Documents against Acceptance" },
  { term: "B/L", ko: "선하증권", en: "Bill of Lading" },
  { term: "L/C", ko: "신용장", en: "Letter of Credit" },
  { term: "CIF", ko: "운임·보험료 포함 조건", en: "Cost, Insurance and Freight" },
  { term: "FOB", ko: "본선 인도 조건", en: "Free On Board" },
  { term: "FCA", ko: "운송인 인도 조건", en: "Free Carrier" },
  { term: "MRL", ko: "최대 잔류허용기준", en: "Maximum Residue Limit" },
  { term: "SDS", ko: "안전보건자료", en: "Safety Data Sheet" },
  { term: "NDA", ko: "비밀유지계약", en: "Non-Disclosure Agreement" },
  { term: "MOQ", ko: "최소 주문 수량", en: "Minimum Order Quantity" },
  { term: "EC", ko: "유화제", en: "Emulsifiable Concentrate" },
  { term: "SC", ko: "액상수화제", en: "Suspension Concentrate" },
  { term: "WP", ko: "수화제", en: "Wettable Powder" },
  { term: "Incoterms", ko: "국제상업회의소 무역거래조건", en: "International Commercial Terms" },
];

let terms = loadJson(STORAGE.terms, seedTerms).map(normalizeTerm);
let savedAnswers = loadJson(STORAGE.saved, []);
const localTerms = terms;
const localSavedAnswers = savedAnswers;
const sharedTerms = seedTerms.map(normalizeTerm);
const sharedTermIds = new Set(sharedTerms.map((term) => term.id));
const supabaseConfig = window.FIELDNOTES_SUPABASE_CONFIG || {};
const supabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey && window.supabase?.createClient);
const supabaseClient = supabaseConfigured
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
let authUser = null;
let authMode = "sign-in";
let isPasswordRecovery = false;
let accountLoading = false;
let accountLoadVersion = 0;
let selectedCategory = "all";
let currentMode = loadJson(STORAGE.mode, "beginner");
if (currentMode !== "beginner" && currentMode !== "expert") currentMode = "beginner";
let answerLanguage = loadJson(STORAGE.answerLanguage, "ko");
if (!["ko", "en"].includes(answerLanguage)) answerLanguage = "ko";
let openCollectionId = null;
let currentAnswer = null;
let lastQuestion = "";
let browseQuery = "";
let activeView = "home";
let isHomeLanding = true;

const $ = (selector) => document.querySelector(selector);
const askForm = $("#ask-form");
const questionInput = $("#question");
const answerArea = $("#answer-area");
const answerContent = $("#answer-content");
const toast = $("#toast");
let toastTimer;

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return structuredClone(fallback);
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) throw new Error("저장된 데이터 형식이 올바르지 않습니다.");
    if (!Array.isArray(fallback) && fallback !== null && typeof fallback === "object" && (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))) {
      throw new Error("저장된 데이터 형식이 올바르지 않습니다.");
    }
    if ((fallback === null || typeof fallback !== "object") && typeof parsed !== typeof fallback) {
      throw new Error("저장된 데이터 형식이 올바르지 않습니다.");
    }
    return parsed;
  } catch (error) {
    console.error(`저장 데이터 ${key}를 불러오지 못했습니다.`, error);
    return structuredClone(fallback);
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`저장 데이터 ${key}를 기록하지 못했습니다.`, error);
    notify("브라우저 저장 공간에 기록하지 못했습니다. 저장 공간을 확인해 주세요.", true);
    return false;
  }
}

function isSharedTerm(term) {
  return sharedTermIds.has(term.id);
}

function refreshDictionary() {
  renderSavedCount();
  renderTerms();
  if (currentAnswer && !answerArea.hidden) {
    runQuestion(currentAnswer.question, {
      noHistory: true,
      noScroll: true,
      contextual: currentAnswer.contextual,
      searchQuery: currentAnswer.searchQuery,
    });
  }
}

function updateAccountUI() {
  const accountLabel = $("#account-label");
  const storageNote = $("#storage-note");
  const authDialog = $("#auth-dialog");
  $("#account-open").setAttribute("aria-label", authUser ? `계정 ${authUser.email}` : "로그인 또는 가입");
  accountLabel.textContent = authUser ? authUser.email : "로그인 / 가입";
  accountLabel.classList.toggle("account-email", Boolean(authUser));
  storageNote.querySelector("small").textContent = authUser
    ? "개인 데이터가 계정에 동기화됩니다"
    : "로그인하면 개인 데이터가 동기화됩니다";
  $("#auth-form").hidden = Boolean(authUser) && !isPasswordRecovery;
  $(".auth-actions").hidden = Boolean(authUser) || isPasswordRecovery;
  $("#auth-signed-in").hidden = !authUser || isPasswordRecovery;
  $("#auth-user-email").textContent = authUser?.email || "";
  $("#auth-setup-notice").hidden = supabaseConfigured;
  $("#auth-setup-notice").textContent = supabaseConfigured
    ? ""
    : supabaseConfig.url && supabaseConfig.anonKey
      ? "Supabase 클라이언트를 불러오지 못했습니다. 인터넷 연결이나 CDN 접근을 확인한 뒤 새로고침해 주세요."
      : "Supabase 설정이 필요합니다. supabase-config.js에 프로젝트 URL과 anon key를 넣고, Supabase SQL Editor에서 supabase-schema.sql을 실행하세요. 이 앱은 file://로 열지 말고 로컬 또는 웹 서버에서 실행해야 이메일 인증 링크가 동작합니다.";
  $("#auth-submit").disabled = !supabaseConfigured;
  $("#auth-reset-password").disabled = !supabaseConfigured;
  $("#auth-sign-out").disabled = !supabaseConfigured;
  $("#admin-open").title = authUser
    ? "기본 사전은 읽기 전용이며 직접 추가한 용어만 본인 계정에 저장됩니다."
    : "로그인 전 추가·수정한 데이터는 이 브라우저에만 저장됩니다.";
  $("#admin-open").disabled = accountLoading;
  $("#favorites-link").disabled = accountLoading;
  $("#save-answer").disabled = accountLoading;
  $("#edit-knowledge").disabled = accountLoading;
  authDialog.dataset.mode = authMode;
  $("#auth-title").textContent = isPasswordRecovery ? "새 비밀번호 설정" : authUser ? "계정" : authMode === "sign-up" ? "계정 만들기" : "로그인";
  $("#auth-submit").textContent = isPasswordRecovery ? "비밀번호 변경" : authMode === "sign-up" ? "계정 만들기" : "로그인";
  $("#auth-toggle-mode").textContent = authMode === "sign-up"
    ? "이미 계정이 있나요? 로그인"
    : "처음이신가요? 계정 만들기";
  $("#auth-password").autocomplete = authMode === "sign-up" || isPasswordRecovery ? "new-password" : "current-password";
}

async function loadAccountData(user) {
  const version = ++accountLoadVersion;
  authUser = user;
  accountLoading = true;
  terms = sharedTerms;
  savedAnswers = [];
  updateAccountUI();
  refreshDictionary();
  try {
    if (!user || !supabaseClient) return;
    const [termsResult, savedResult] = await Promise.all([
      supabaseClient.from("personal_terms").select("term_id, term_data").eq("user_id", user.id),
      supabaseClient.from("saved_answers").select("question, summary, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (version !== accountLoadVersion) return;
    if (termsResult.error) throw termsResult.error;
    if (savedResult.error) throw savedResult.error;

    const personalTerms = (termsResult.data || []).map((row) => {
      const term = normalizeTerm({ ...row.term_data, id: row.term_id });
      if (!term.term || !term.definition || !categories.some((item) => item.id === term.category)) {
        throw new Error(`저장된 개인 용어(${row.term_id})의 데이터가 올바르지 않습니다.`);
      }
      if (sharedTermIds.has(term.id)) throw new Error(`개인 용어 ID가 공용 용어와 충돌합니다: ${term.id}`);
      return term;
    });
    terms = [...sharedTerms, ...personalTerms];
    savedAnswers = (savedResult.data || []).map((row) => ({
      question: row.question,
      summary: row.summary,
      time: Date.parse(row.created_at),
    }));
    refreshDictionary();
  } finally {
    if (version === accountLoadVersion) {
      accountLoading = false;
      updateAccountUI();
    }
  }
}

function restoreLocalData() {
  terms = localTerms;
  savedAnswers = localSavedAnswers;
  refreshDictionary();
}

async function savePersonalTerm(term) {
  if (authUser && supabaseClient) {
    const { error } = await supabaseClient.from("personal_terms").upsert({
      user_id: authUser.id,
      term_id: term.id,
      term_data: term,
    }, { onConflict: "user_id,term_id" });
    if (error) throw error;
    return;
  }
  if (!persist(STORAGE.terms, terms)) throw new Error("브라우저 저장 공간에 기록하지 못했습니다.");
}

async function deletePersonalTerm(termId) {
  if (authUser && supabaseClient) {
    const { error } = await supabaseClient.from("personal_terms")
      .delete()
      .eq("user_id", authUser.id)
      .eq("term_id", termId);
    if (error) throw error;
    return;
  }
  const remainingTerms = terms.filter((term) => term.id !== termId);
  if (!persist(STORAGE.terms, remainingTerms)) throw new Error("브라우저 저장 공간에 기록하지 못했습니다.");
}

async function saveAnswerToAccount(answer) {
  const { error } = await supabaseClient.from("saved_answers").insert({
    user_id: authUser.id,
    question: answer.question,
    summary: answer.summary,
  });
  if (error) throw error;
}

async function removeSavedAnswerFromAccount(question) {
  const { error } = await supabaseClient.from("saved_answers")
    .delete()
    .eq("user_id", authUser.id)
    .eq("question", question);
  if (error) throw error;
}

function normalize(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokens(value) {
  const stopWords = new Set([
    "what", "is", "a", "an", "the", "and", "or", "of", "to", "for", "with", "how", "can", "do", "does",
    "should", "would", "could", "are", "was", "were", "be", "about", "who", "when", "where", "which",
    "then", "have", "has", "had", "that", "this", "it", "my", "we", "you", "your", "they", "them",
    "i", "me", "in", "on", "at", "from", "by", "as", "please", "tell", "explain", "difference", "differences",
    "어떻게", "해야", "해", "해요", "할까요", "인가요", "인가", "있나요", "있어", "있어요", "무엇", "무슨",
    "누가", "왜", "어떤", "그럼", "그러면", "이", "그", "두", "방식", "차이", "차이는", "비교", "대해",
    "알려줘", "알려주세요", "설명해", "설명해줘", "해주세요", "해줘", "가능한가요", "싶다고", "하는데",
  ]);
  return normalize(value).split(/\s+/).filter((part) => part.length > 1 && !stopWords.has(part));
}

function escapeText(value) {
  return String(value || "");
}

function notify(message, error = false) {
  toast.textContent = message;
  toast.classList.toggle("is-error", error);
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}

function categoryLabel(id) {
  return categories.find((category) => category.id === id)?.label || id;
}

function normalizeTerm(term) {
  const id = String(term.id || crypto.randomUUID());
  const translations = { ...(window.FIELDNOTES_EN?.[id] || {}), ...(term.translations || {}) };
  const englishFields = { definition: "definition_en", simple: "simple_en", scenario: "scenario_en", steps: "steps_en", cautions: "cautions_en", sources: "sources_en" };
  const listFields = new Set(["steps", "sources"]);
  Object.entries(englishFields).forEach(([key, field]) => {
    if (term[field]) translations[key] = listFields.has(key) ? splitList(term[field]) : String(term[field]).trim();
  });
  listFields.forEach((key) => {
    if (translations[key]) translations[key] = splitList(translations[key]);
  });
  return {
    id,
    category: String(term.category || "business"),
    term: String(term.term || "").trim(),
    english: String(term.english || "").trim(),
    aliases: Array.isArray(term.aliases) ? term.aliases : splitList(term.aliases),
    keywords: Array.isArray(term.keywords) ? term.keywords : splitList(term.keywords),
    definition: String(term.definition || "").trim(),
    keyTerms: {
      ko: Array.isArray(term.keyTerms?.ko) ? term.keyTerms.ko : splitList(term.key_terms || term.keyTerms?.ko || definitionKeyTerms[term.id]?.ko),
      en: Array.isArray(term.keyTerms?.en) ? term.keyTerms.en : splitList(term.key_terms_en || term.keyTerms?.en || definitionKeyTerms[term.id]?.en),
    },
    simple: String(term.simple || "").trim(),
    scenario: String(term.scenario || "").trim(),
    steps: Array.isArray(term.steps) ? term.steps : splitList(term.steps),
    cautions: String(term.cautions || "").trim(),
    related: Array.isArray(term.related) ? term.related : splitList(term.related),
    sources: Array.isArray(term.sources) ? term.sources : splitList(term.sources),
    translations,
  };
}

function splitList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : String(value || "").split("|").map((part) => part.trim()).filter(Boolean);
}

function renderCategories() {
  const nav = $("#category-nav");
  const allButton = makeButton("모든 분야", "▦", () => selectCategory("all"), "category-link");
  allButton.dataset.category = "all";
  nav.append(allButton);
  categories.forEach((category) => {
    const button = makeButton(category.label, category.icon, () => selectCategory(category.id), "category-link");
    button.dataset.category = category.id;
    nav.append(button);
  });
  const topicNav = $("#topic-nav");
  topicNav.replaceChildren(...collections.map((collection) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "topic-link";
    button.textContent = answerLanguage === "en" ? collection.titleEn : collection.title;
    button.setAttribute("aria-label", `${button.textContent} ${answerLanguage === "en" ? "topic" : "주제 보기"}`);
    button.addEventListener("click", () => selectCollection(collection.id));
    return button;
  }));
  updateTopicNavigation();
  const select = document.querySelector('#term-form select[name="category"]');
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.label;
    select.append(option);
  });
  document.querySelectorAll(".mode-switch button").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.mode === currentMode);
  });
  updateLanguageSwitch();
  updateModeHint();
}

function updateLanguageSwitch() {
  document.querySelectorAll(".language-switch button").forEach((button) => {
    const selected = button.dataset.language === answerLanguage;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  updateTopicNavigation();
}

function updateTopicNavigation() {
  const topicNav = $("#topic-nav");
  topicNav.querySelectorAll(".topic-link").forEach((button, index) => {
    const collection = collections[index];
    button.textContent = answerLanguage === "en" ? collection.titleEn : collection.title;
    button.setAttribute("aria-label", `${button.textContent} ${answerLanguage === "en" ? "topic" : "주제 보기"}`);
    button.classList.toggle("is-current", collection.id === openCollectionId);
  });
  const toggle = $("#topics-toggle");
  const expanded = !topicNav.hidden;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.classList.toggle("is-current", activeView === "collection");
  toggle.classList.toggle("is-expanded", expanded);
  const label = toggle.querySelector(".topic-toggle-label");
  label.textContent = answerLanguage === "en" ? "Topic collections" : "주제별 모음";
}

function updateModeHint() {
  const expert = currentMode === "expert";
  document.querySelector('[data-mode="beginner"]').title = "쉬운 풀이와 핵심 주의사항을 먼저 보여줍니다.";
  document.querySelector('[data-mode="expert"]').title = "절차, 세부 용어와 출처를 더 자세히 보여줍니다.";
  $("#mode-description").textContent = expert
    ? "전문가 모드 · 업무 확인 절차와 근거를 자세히 볼 수 있어요."
    : "초보자 모드 · 쉬운 풀이와 꼭 알아둘 주의사항부터 보여드려요.";
}

function makeButton(label, icon, onClick, className = "nav-link") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  const iconNode = document.createElement("span");
  iconNode.className = className === "category-link" ? "category-icon" : "nav-icon";
  iconNode.textContent = icon;
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  button.append(iconNode, labelNode);
  button.addEventListener("click", onClick);
  return button;
}

function selectCategory(category) {
  isHomeLanding = false;
  selectedCategory = category;
  openCollectionId = null;
  activeView = "home";
  $("#topic-nav").hidden = true;
  browseQuery = "";
  lastQuestion = "";
  $("#browse-search").value = "";
  $("#welcome").hidden = category !== "all";
  answerArea.hidden = true;
  $("#current-view").textContent = category === "all" ? "AI 업무 도우미" : categoryLabel(category);
  $("#browse-eyebrow").textContent = category === "all" ? "KNOWLEDGE BASE" : "DICTIONARY";
  $("#browse-title").textContent = category === "all" ? "업무 지식 둘러보기" : categoryLabel(category);
  $("#browse-description").textContent = category === "all"
    ? "업무 분야별로 용어와 실무 가이드를 찾아보세요."
    : categories.find((item) => item.id === category)?.description || "";
  document.querySelectorAll(".category-link").forEach((button) => {
    button.classList.toggle("is-current", button.dataset.category === category);
  });
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.remove("is-current"));
  $("#home-link").classList.add("is-current");
  updateTopicNavigation();
  renderTerms();
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome() {
  isHomeLanding = true;
  selectedCategory = "all";
  openCollectionId = null;
  activeView = "home";
  $("#topic-nav").hidden = true;
  browseQuery = "";
  lastQuestion = "";
  $("#browse-search").value = "";
  $("#welcome").hidden = false;
  answerArea.hidden = true;
  questionInput.value = "";
  $("#current-view").textContent = "AI 업무 도우미";
  $("#browse-eyebrow").textContent = answerLanguage === "en" ? "WORK AREAS" : "업무 분야";
  document.querySelectorAll(".category-link").forEach((button) => button.classList.remove("is-current"));
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.remove("is-current"));
  $("#home-link").classList.add("is-current");
  updateTopicNavigation();
  renderTerms();
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectCollection(collectionId) {
  const collection = collections.find((item) => item.id === collectionId);
  if (!collection) return;
  activeView = "collection";
  openCollectionId = collectionId;
  selectedCategory = collection.category;
  browseQuery = "";
  lastQuestion = "";
  $("#browse-search").value = "";
  $("#welcome").hidden = true;
  answerArea.hidden = true;
  $("#current-view").textContent = answerLanguage === "en" ? collection.titleEn : collection.title;
  $("#browse-eyebrow").textContent = answerLanguage === "en" ? "TOPIC COLLECTION" : "TOPIC COLLECTION";
  document.querySelectorAll(".category-link").forEach((button) => button.classList.toggle("is-current", button.dataset.category === selectedCategory));
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.remove("is-current"));
  $("#topic-nav").hidden = false;
  updateTopicNavigation();
  renderTerms();
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function searchScore(term, query) {
  const q = normalize(query);
  const qTokens = tokens(query);
  const fields = [
    { value: term.term, weight: 12 },
    { value: term.english, weight: 10 },
    ...term.aliases.map((value) => ({ value, weight: 9 })),
    ...term.keywords.map((value) => ({ value, weight: 5 })),
    { value: term.definition, weight: 2 },
    { value: term.simple, weight: 2 },
    { value: term.scenario, weight: 2 },
    { value: term.cautions, weight: 1 },
    ...Object.values(term.translations || {}).flatMap((value) => (Array.isArray(value) ? value : [value]).map((text) => ({ value: text, weight: 2 }))),
  ];
  let score = 0;
  for (const field of fields) {
    const value = normalize(field.value);
    if (!value) continue;
    if (value === q) score += field.weight * 3;
    else if (q.length > 2 && value.includes(q)) score += field.weight * 2;
    for (const token of qTokens) {
      if (value.includes(token)) score += field.weight;
    }
  }

  const shortcuts = [
    { pattern: /원본.{0,8}(없이|없는데|없어)|without.{0,12}original|no original.{0,12}b.?l/i, ids: ["surrender-bl", "sea-waybill"] },
    { pattern: /비교|차이|vs\.?|versus|compare|difference/i, ids: [] },
    { pattern: /보험.{0,12}(누가|책임|준비)|who.{0,15}insurance/i, ids: ["incoterms-cif"] },
    { pattern: /잔류허용|잔류.{0,8}기준|mrl/i, ids: ["mrl"] },
    { pattern: /성분|유효성분|active ingredient/i, ids: ["active-ingredient"] },
    { pattern: /제형|희석|혼용|formulation/i, ids: ["formulation"] },
    { pattern: /등록|허가|registration/i, ids: ["product-registration"] },
    { pattern: /납기|리드타임|lead.?time/i, ids: ["lead-time"] },
    { pattern: /인코텀|incoterms/i, ids: ["incoterms-cif", "incoterms-fob"] },
    { pattern: /신용장|l\/c|letter of credit/i, ids: ["letter-of-credit"] },
  ];
  shortcuts.forEach((shortcut) => {
    if (shortcut.pattern.test(query) && shortcut.ids.includes(term.id)) score += 30;
  });
  return score;
}

function rankTerms(query) {
  const ranked = terms
    .map((term) => ({ term, score: searchScore(term, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const minimumScore = Math.max(8, (ranked[0]?.score || 0) * 0.28);
  return ranked
    .filter((item) => item.score >= minimumScore)
    .map((item) => item.term);
}

function appendGlossaryText(target, content, language, emphasizedTerms = []) {
  const text = String(content || "");
  const glossaryTerms = jargonGlossary.map(({ term }) => term);
  const emphasisTerms = emphasizedTerms.map((term) => String(term || "").trim()).filter(Boolean);
  const candidates = (items) => [...new Set(items)]
    .sort((left, right) => right.length - left.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const glossaryPattern = candidates(glossaryTerms).join("|");
  const emphasisPattern = candidates(emphasisTerms).join("|");
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])(?:(?<glossary>${glossaryPattern})(?=$|[^\\p{L}\\p{N}])${emphasisPattern ? `|(?<emphasis>${emphasisPattern})` : ""})`,
    "giu",
  );
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    const token = match.groups.glossary || match.groups.emphasis;
    const tokenStart = start + match[1].length;
    if (tokenStart < lastIndex) continue;
    const item = jargonGlossary.find((entry) => entry.term.toLocaleLowerCase() === token.toLocaleLowerCase());
    const emphasized = emphasisTerms.some((term) => term.toLocaleLowerCase() === token.toLocaleLowerCase());
    if (!item && !emphasized) continue;

    const preceding = item ? text.slice(Math.max(0, tokenStart - item.en.length - 4), tokenStart) : "";
    if (item && language === "en" && new RegExp(`${item.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\($`, "i").test(preceding)) continue;
    const between = text.slice(lastIndex, tokenStart);
    target.append(document.createTextNode(between));

    if (!item) {
      const important = document.createElement("strong");
      important.className = "definition-highlight";
      important.textContent = token;
      target.append(important);
      lastIndex = tokenStart + token.length;
      continue;
    }

    const abbreviation = document.createElement("abbr");
    abbreviation.className = "jargon-abbreviation";
    abbreviation.textContent = token;
    abbreviation.title = `${item.en} · ${item.ko}`;
    const expansionText = answerLanguage === "ko" ? item.ko : answerLanguage === "en" ? item.en : `${item.en} · ${item.ko}`;
    abbreviation.setAttribute("aria-label", `${token}: ${expansionText}`);

    const expansion = document.createElement("span");
    expansion.className = "jargon-expansion";
    expansion.textContent = ` (${expansionText})`;
    if (emphasizedTerms.length) {
      const important = document.createElement("strong");
      important.className = "definition-highlight";
      important.append(abbreviation, expansion);
      target.append(important);
    } else {
      target.append(abbreviation, expansion);
    }
    lastIndex = tokenStart + token.length;
  }
  target.append(document.createTextNode(text.slice(lastIndex)));
}

function renderAnswer(query, matches, contextual = false) {
  const language = answerLanguage === "en" ? "en" : "ko";
  const compare = comparePattern.test(query);
  const action = actionPattern.test(query);
  const top = matches.slice(0, 4);
  answerContent.replaceChildren();

  if (!top.length) {
    const heading = document.createElement("p");
    heading.className = "answer-lead";
    heading.textContent = answerLanguage === "en"
      ? "I couldn't find a sufficiently relevant entry in the current sample knowledge base."
      : "현재 샘플 지식베이스에서 질문과 직접 관련된 자료를 찾지 못했어요.";
    const note = document.createElement("p");
    note.className = "answer-paragraph";
    note.textContent = answerLanguage === "en"
      ? "No company policy or process has been inferred. Try another term, select a category, or ask your internal subject-matter expert."
      : "등록되지 않은 사내 규정이나 절차를 추측해 안내하지 않습니다. 용어나 분야를 바꿔 검색하거나 해당 업무 담당자에게 확인해 주세요.";
    answerContent.append(heading, note);
    $("#source-panel").replaceChildren();
    $("#source-panel").hidden = currentMode !== "expert";
    $("#related-panel").replaceChildren();
    $("#expert-mode-note").hidden = currentMode === "expert";
    return [];
  }

  if (compare && top.length >= 2) {
    const intro = document.createElement("p");
    intro.className = "answer-lead";
    intro.textContent = answerLanguage === "en"
      ? "Here are the key differences based on the sample knowledge base."
      : "두 용어의 핵심 차이를 샘플 지식 기준으로 비교했어요.";
    answerContent.append(intro, createComparisonTable(top.slice(0, 2), language));
    top.slice(0, 2).forEach((term) => answerContent.append(createTermDetail(term, language, action)));
  } else {
    top.forEach((term, index) => {
      answerContent.append(createTermDetail(term, language, action, index === 0));
    });
  }

  if (contextual) {
    const contextNote = document.createElement("p");
    contextNote.className = "context-note";
    contextNote.textContent = answerLanguage === "en"
      ? "This follow-up is interpreted in the context of your previous question."
      : "이전 질문의 맥락을 이어서 답변했어요.";
    answerContent.prepend(contextNote);
  }
  renderSources(top, answerLanguage);
  renderRelated(top, language);
  $("#source-panel").hidden = currentMode !== "expert";
  $("#expert-mode-note").hidden = currentMode === "expert";
  return top.map((term) => term.id);
}

function createComparisonTable(items, language) {
  const wrap = document.createElement("div");
  wrap.className = "comparison-wrap";
  const table = document.createElement("table");
  table.className = "comparison-table";
  const rows = [
    [answerLanguage === "en" ? "Meaning" : "정의", "definition"],
    [answerLanguage === "en" ? "In practice" : "업무에서", "scenario"],
    [answerLanguage === "en" ? "Caution" : "주의사항", "cautions"],
  ];
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const blank = document.createElement("th");
  blank.textContent = answerLanguage === "en" ? "Compare" : "구분";
  headerRow.append(blank);
  items.forEach((item) => {
    const cell = document.createElement("th");
    cell.textContent = `${item.term}${item.english ? ` · ${item.english}` : ""}`;
    headerRow.append(cell);
  });
  head.append(headerRow);
  const body = document.createElement("tbody");
  rows.forEach(([label, key]) => {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.textContent = label;
    row.append(heading);
    items.forEach((item) => {
      const cell = document.createElement("td");
      appendAnswerContent(cell, item[key], item.translations?.[key], language, key === "definition" ? item.keyTerms : {});
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

function createTermDetail(term, language, action, primary = false) {
  const section = document.createElement("section");
  section.className = `answer-term${primary ? " is-primary" : ""}`;
  const heading = document.createElement("div");
  heading.className = "term-answer-heading";
  const titleGroup = document.createElement("div");
  const title = document.createElement("h2");
  appendGlossaryText(title, term.term, language);
  const english = document.createElement("span");
  english.className = "english-name";
  english.textContent = term.english;
  titleGroup.append(title, english);
  const category = document.createElement("span");
  category.className = "category-tag";
  category.textContent = categoryLabel(term.category);
  heading.append(titleGroup, category);
  section.append(heading);

  const block = (key, title, caution = false) => addAnswerBlock(
    section,
    title,
    term[key],
    term.translations?.[key],
    language,
    caution,
    key === "definition" ? term.keyTerms : {},
  );

  const addDefinition = () => {
    block("definition", sectionLabel("정확한 정의", "Definition"));
  };
  const addCaution = () => {
    block("cautions", sectionLabel("먼저 확인해 주세요", "Key caution"), true);
  };

  if (currentMode === "beginner") {
    block("simple", sectionLabel("쉽게 설명하면", "In plain language"));
    addCaution();
    addDefinition();
    if (action) block("scenario", sectionLabel("실무에서는", "In practice"));
  } else {
    addDefinition();
    block("simple", sectionLabel("쉽게 설명하면", "In plain language"));
    block("scenario", sectionLabel("실무에서 쓰이는 상황", "Work scenario"));
  }
  if (currentMode === "expert") block("steps", sectionLabel("업무 확인 순서", "Suggested checks"));
  if (currentMode === "expert") addCaution();
  const visualGuide = createVisualGuide(term);
  if (visualGuide) section.append(visualGuide);
  return section;
}

function createVisualGuide(term) {
  const guide = getVisualGuide(term.id);
  if (!guide) return null;
  const section = document.createElement("figure");
  section.className = "visual-guide";
  const heading = document.createElement("h3");
  heading.textContent = answerLanguage === "en" ? guide.titleEn : guide.title;
  const caption = document.createElement("figcaption");
  caption.textContent = answerLanguage === "en" ? guide.captionEn : guide.caption;
  section.append(heading, caption, guide.content);
  return section;
}

function getVisualGuide(termId) {
  if (termId.startsWith("incoterms-")) return createIncotermVisual(termId);
  if (["bill-of-lading", "sea-waybill", "surrender-bl"].includes(termId)) return createShippingDocumentVisual(termId);
  if (["letter-of-credit", "dp-da", "dp", "da", "open-account"].includes(termId)) return createPaymentVisual(termId);
  if (["formulation", "formulation-ec", "formulation-sc", "formulation-wp"].includes(termId)) return createFormulationVisual(termId);
  if (["pre-harvest-interval", "re-entry-interval"].includes(termId)) return createAgroIntervalVisual(termId);
  return null;
}

function makeVisualGuide(title, titleEn, caption, captionEn, content) {
  return { title, titleEn, caption, captionEn, content };
}

function makeVisualFlow(steps, className = "") {
  const flow = document.createElement("div");
  flow.className = `visual-flow${className ? ` ${className}` : ""}`;
  steps.forEach((step, index) => {
    if (index) {
      const arrow = document.createElement("span");
      arrow.className = "visual-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      flow.append(arrow);
    }
    const node = document.createElement("div");
    node.className = `visual-step${step.emphasis ? " is-emphasis" : ""}`;
    const title = document.createElement("strong");
    title.textContent = step.title;
    const description = document.createElement("span");
    description.textContent = step.description;
    node.append(title, description);
    flow.append(node);
  });
  return flow;
}

function createIncotermVisual(termId) {
  const terms = {
    exw: { risk: ["매도인 장소에서 인도 시", "At seller's premises"], freight: ["매수인", "Buyer"] },
    fca: { risk: ["지정 장소에서 운송인에게 인도 시", "When handed to carrier at named place"], freight: ["매수인", "Buyer"] },
    cpt: { risk: ["첫 운송인에게 인도 시", "When handed to first carrier"], freight: ["매도인", "Seller"] },
    cip: { risk: ["첫 운송인에게 인도 시", "When handed to first carrier"], freight: ["매도인", "Seller"] },
    dap: { risk: ["목적지에서 하역 준비 완료 시", "At destination, ready for unloading"], freight: ["매도인", "Seller"] },
    dpu: { risk: ["목적지에서 하역 완료 시", "At destination, after unloading"], freight: ["매도인", "Seller"] },
    ddp: { risk: ["목적지에서 하역 준비 완료 시", "At destination, ready for unloading"], freight: ["매도인", "Seller"] },
    fas: { risk: ["선적항에서 선측에 둘 때", "When placed alongside at port"], freight: ["매수인", "Buyer"] },
    fob: { risk: ["선적항에서 본선 적재 시", "When loaded on board at port"], freight: ["매수인", "Buyer"] },
    cfr: { risk: ["선적항에서 본선 적재 시", "When loaded on board at port"], freight: ["매도인", "Seller"] },
    cif: { risk: ["선적항에서 본선 적재 시", "When loaded on board at port"], freight: ["매도인", "Seller"] },
  };
  const key = termId.replace("incoterms-", "");
  const detail = terms[key];
  if (!detail) return null;
  const content = document.createElement("div");
  content.className = "visual-facts";
  [
    [answerLanguage === "en" ? "Risk transfers" : "위험 이전", detail.risk[answerLanguage === "en" ? 1 : 0]],
    [answerLanguage === "en" ? "Main-carriage cost" : "주 운송비 부담", detail.freight[answerLanguage === "en" ? 1 : 0]],
  ].forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "visual-fact";
    const labelNode = document.createElement("span");
    labelNode.className = "visual-fact-label";
    labelNode.textContent = label;
    const valueNode = document.createElement("strong");
    valueNode.textContent = value;
    row.append(labelNode, valueNode);
    content.append(row);
  });
  const flow = makeVisualFlow([
    { title: answerLanguage === "en" ? "Seller" : "매도인", description: answerLanguage === "en" ? "Export side" : "수출 측" },
    { title: answerLanguage === "en" ? "Delivery point" : "인도 지점", description: detail.risk[answerLanguage === "en" ? 1 : 0], emphasis: true },
    { title: answerLanguage === "en" ? "Buyer" : "매수인", description: answerLanguage === "en" ? "Risk after transfer" : "이후 위험 부담" },
  ]);
  content.append(flow);
  return makeVisualGuide(
    "운송 흐름에서 보는 핵심 책임",
    "Key responsibilities along the route",
    "개념을 단순화한 도식입니다. 정확한 지정 장소와 계약 조건을 확인하세요.",
    "Simplified illustration. Confirm the named place and contract terms.",
    content,
  );
}

function createShippingDocumentVisual(termId) {
  const isSurrender = termId === "surrender-bl";
  const isWaybill = termId === "sea-waybill";
  const steps = isSurrender
    ? [
      { title: answerLanguage === "en" ? "Origin" : "선적지", description: answerLanguage === "en" ? "Originals returned to carrier" : "원본을 선사에 반납" },
      { title: answerLanguage === "en" ? "Carrier" : "운송인", description: answerLanguage === "en" ? "Release instruction sent" : "도착지에 인도 지시 전달", emphasis: true },
      { title: answerLanguage === "en" ? "Destination" : "도착지", description: answerLanguage === "en" ? "Release per carrier rules" : "선사 조건에 따라 인도" },
    ]
    : isWaybill
      ? [
        { title: answerLanguage === "en" ? "Named shipper" : "송하인", description: answerLanguage === "en" ? "Shipment details confirmed" : "선적 정보 확인" },
        { title: answerLanguage === "en" ? "Sea Waybill" : "Sea Waybill", description: answerLanguage === "en" ? "Non-negotiable transport record" : "비유통성 운송서류", emphasis: true },
        { title: answerLanguage === "en" ? "Named consignee" : "지정 수하인", description: answerLanguage === "en" ? "Identity/release checks apply" : "신원·인도 조건 확인" },
      ]
      : [
        { title: answerLanguage === "en" ? "Shipper" : "송하인", description: answerLanguage === "en" ? "Requests B/L" : "B/L 발행 요청" },
        { title: answerLanguage === "en" ? "Carrier" : "운송인", description: answerLanguage === "en" ? "Issues transport document" : "운송서류 발행", emphasis: true },
        { title: answerLanguage === "en" ? "Consignee" : "수하인", description: answerLanguage === "en" ? "Presents documents as required" : "요구 서류에 따라 화물 인도" },
      ];
  return makeVisualGuide(
    "서류와 화물 인도 흐름",
    "Document and cargo-release flow",
    "실제 인도 요건은 B/L 형식, 운송인, 계약 및 현지 규정에 따라 달라집니다.",
    "Actual release requirements depend on the document form, carrier, contract, and local rules.",
    makeVisualFlow(steps),
  );
}

function createPaymentVisual(termId) {
  let title = "대금 결제 흐름";
  let titleEn = "Payment flow";
  let caption = "은행의 역할과 서류 인도 시점은 결제 방식과 약정에 따라 달라집니다.";
  let captionEn = "Bank roles and document-release timing depend on the payment method and agreed terms.";
  if (termId === "dp-da") {
    const content = document.createElement("div");
    content.className = "visual-payment-comparison";
    [
      {
        title: "D/P",
        titleEn: "D/P",
        steps: [
          { title: answerLanguage === "en" ? "Exporter ships" : "수출자 선적", description: answerLanguage === "en" ? "Documents sent via banks" : "은행 경유 서류 송부" },
          { title: answerLanguage === "en" ? "Importer pays" : "수입자 지급", description: answerLanguage === "en" ? "Documents released" : "대금 지급 후 서류 인도", emphasis: true },
        ],
      },
      {
        title: "D/A",
        titleEn: "D/A",
        steps: [
          { title: answerLanguage === "en" ? "Exporter ships" : "수출자 선적", description: answerLanguage === "en" ? "Documents sent via banks" : "은행 경유 서류 송부" },
          { title: answerLanguage === "en" ? "Importer accepts draft" : "수입자 환어음 인수", description: answerLanguage === "en" ? "Documents released" : "대금 지급 전 서류 인도", emphasis: true },
          { title: answerLanguage === "en" ? "Due date" : "만기일", description: answerLanguage === "en" ? "Importer pays" : "수입자 대금 지급" },
        ],
      },
    ].forEach((method) => {
      const row = document.createElement("div");
      row.className = "visual-payment-row";
      const methodTitle = document.createElement("strong");
      methodTitle.textContent = answerLanguage === "en" ? method.titleEn : method.title;
      row.append(methodTitle, makeVisualFlow(method.steps, "is-payment-flow"));
      content.append(row);
    });
    const note = document.createElement("p");
    note.className = "visual-note";
    note.textContent = answerLanguage === "en"
      ? "Collection banks generally do not guarantee the buyer's payment. Confirm the collection instruction and contract."
      : "추심은행은 통상 수입자의 지급을 보증하지 않습니다. 실제 추심 지시서와 계약을 확인하세요.";
    content.append(note);
    return makeVisualGuide(
      "D/P와 D/A의 서류 인도 시점",
      "When documents are released: D/P vs D/A",
      "D/P는 지급 후, D/A는 환어음 인수 후 서류가 인도되는 방식입니다.",
      "D/P releases documents against payment; D/A releases them against acceptance of a draft.",
      content,
    );
  }
  let steps;
  if (termId === "dp") {
    steps = [
      { title: answerLanguage === "en" ? "Exporter ships" : "수출자 선적", description: answerLanguage === "en" ? "Documents sent via banks" : "은행 경유 서류 송부" },
      { title: answerLanguage === "en" ? "Importer pays" : "수입자 지급", description: answerLanguage === "en" ? "Payment against documents" : "대금 지급 후 서류 수령", emphasis: true },
      { title: answerLanguage === "en" ? "Documents released" : "서류 인도", description: answerLanguage === "en" ? "Importer arranges cargo" : "수입자 화물 인도 진행" },
    ];
  } else if (termId === "da") {
    steps = [
      { title: answerLanguage === "en" ? "Exporter ships" : "수출자 선적", description: answerLanguage === "en" ? "Documents sent via banks" : "은행 경유 서류 송부" },
      { title: answerLanguage === "en" ? "Importer accepts draft" : "수입자 환어음 인수", description: answerLanguage === "en" ? "Documents released" : "대금 지급 전 서류 인도", emphasis: true },
      { title: answerLanguage === "en" ? "Due date" : "만기일", description: answerLanguage === "en" ? "Importer pays" : "수입자 대금 지급" },
    ];
  } else if (termId === "open-account") {
    steps = [
      { title: answerLanguage === "en" ? "Exporter ships" : "수출자 선적", description: answerLanguage === "en" ? "Goods sent first" : "물품 먼저 선적" },
      { title: answerLanguage === "en" ? "Credit period" : "외상 기간", description: answerLanguage === "en" ? "Buyer receives goods" : "수입자 물품 수령" },
      { title: answerLanguage === "en" ? "Due date" : "약정 만기", description: answerLanguage === "en" ? "Buyer pays seller" : "수입자 대금 지급", emphasis: true },
    ];
  } else {
    title = "신용장 결제 흐름";
    titleEn = "Documentary-credit flow";
    caption = "은행은 물품 자체가 아니라 신용장 조건에 맞는 제시 서류를 심사합니다.";
    captionEn = "Banks examine a complying presentation of documents, not the goods themselves.";
    steps = [
      { title: answerLanguage === "en" ? "Buyer" : "수입자", description: answerLanguage === "en" ? "Requests credit" : "신용장 개설 신청" },
      { title: answerLanguage === "en" ? "Issuing bank" : "개설은행", description: answerLanguage === "en" ? "Issues credit" : "신용장 발행" },
      { title: answerLanguage === "en" ? "Seller ships" : "수출자 선적", description: answerLanguage === "en" ? "Presents documents" : "서류 제시", emphasis: true },
      { title: answerLanguage === "en" ? "Bank examines" : "은행 심사", description: answerLanguage === "en" ? "Pays if compliant" : "일치 제시 시 지급" },
    ];
  }
  const content = document.createElement("div");
  content.className = "visual-payment-content";
  content.append(makeVisualFlow(steps, "is-payment-flow"));
  const note = document.createElement("p");
  note.className = "visual-note";
  note.textContent = answerLanguage === "en"
    ? "Illustrative only; confirm the credit or collection instructions and contract."
    : "개념도입니다. 실제 신용장·추심 지시서와 계약 조건을 확인하세요.";
  content.append(note);
  return makeVisualGuide(title, titleEn, caption, captionEn, content);
}

function createFormulationVisual(termId) {
  const formulations = [
    { id: "formulation-ec", title: "EC", titleEn: "EC", medium: ["유기 용매", "Organic solvent"], particles: ["유효성분 용해", "Active ingredient dissolved"], result: ["물에 넣으면 유화액", "Emulsion when added to water"] },
    { id: "formulation-sc", title: "SC", titleEn: "SC", medium: ["물 기반 액상", "Water-based liquid"], particles: ["고체 입자 분산", "Solid particles dispersed"], result: ["현탁액", "Suspension"] },
    { id: "formulation-wp", title: "WP", titleEn: "WP", medium: ["건조 분말", "Dry powder"], particles: ["물에 녹지 않는 입자", "Insoluble particles"], result: ["물에 분산해 사용", "Dispersed in water for use"] },
  ];
  const selected = formulations.find((item) => item.id === termId);
  const list = termId === "formulation" ? formulations : selected ? [selected] : [];
  if (!list.length) return null;
  const content = document.createElement("div");
  content.className = "formulation-visual-grid";
  list.forEach((item) => {
    const card = document.createElement("div");
    card.className = "formulation-visual-card";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const body = document.createElement("span");
    body.textContent = answerLanguage === "en" ? item.particles[1] : item.particles[0];
    const result = document.createElement("small");
    result.textContent = answerLanguage === "en" ? item.result[1] : item.result[0];
    card.append(title, body, result);
    content.append(card);
  });
  return makeVisualGuide(
    termId === "formulation" ? "제형의 차이를 단순화해 보기" : "제형 구조를 단순화해 보기",
    termId === "formulation" ? "Simplified formulation comparison" : "Simplified formulation concept",
    "개념을 위한 그림이며 실제 제품의 입자 크기·조성·혼화성을 나타내지 않습니다. 제품 라벨과 SDS를 확인하세요.",
    "Conceptual illustration only; it does not represent actual particle size, composition, or compatibility. Check the product label and SDS.",
    content,
  );
}

function createAgroIntervalVisual(termId) {
  const isPhi = termId === "pre-harvest-interval";
  const content = document.createElement("div");
  content.className = "visual-timeline";
  const labels = isPhi
    ? answerLanguage === "en"
      ? ["Last application", "PHI period", "Harvest"]
      : ["마지막 처리", "PHI 기간", "수확"]
    : answerLanguage === "en"
      ? ["Application", "REI period", "Worker re-entry"]
      : ["처리", "REI 기간", "작업자 재출입"];
  labels.forEach((label, index) => {
    const node = document.createElement("div");
    node.className = `visual-timeline-node${index === 1 ? " is-wait" : ""}`;
    node.textContent = label;
    content.append(node);
    if (index < labels.length - 1) {
      const line = document.createElement("span");
      line.className = "visual-timeline-line";
      line.setAttribute("aria-hidden", "true");
      content.append(line);
    }
  });
  const note = document.createElement("p");
  note.className = "visual-note";
  note.textContent = answerLanguage === "en"
    ? "No duration is implied. Follow the locally approved product label."
    : "기간을 표시한 그림이 아닙니다. 현지 승인 라벨의 제품·작물별 기준을 따르세요.";
  content.append(note);
  return makeVisualGuide(
    isPhi ? "마지막 처리부터 수확까지" : "처리 후 작업자 재출입까지",
    isPhi ? "From last application to harvest" : "From application to worker re-entry",
    isPhi
      ? "PHI는 수확 시점과 관련된 대기기간입니다."
      : "REI는 작업자가 처리 구역에 다시 들어가기 전의 제한기간입니다.",
    isPhi
      ? "PHI is the waiting period related to harvest timing."
      : "REI is the restricted period before workers may re-enter a treated area.",
    content,
  );
}

function sectionLabel(korean, english) {
  return answerLanguage === "en" ? english : korean;
}

function addAnswerBlock(parent, title, korean, english, language, caution = false, emphasizedTerms = []) {
  if (!korean && !english) return;
  const block = document.createElement("div");
  block.className = `answer-block${caution ? " caution-box" : ""}`;
  const header = document.createElement("div");
  header.className = "answer-block-header";
  const heading = document.createElement(caution ? "strong" : "h3");
  heading.textContent = title;
  header.append(heading);
  const body = document.createElement("div");
  body.className = "answer-block-body";
  block.append(header, body);
  appendAnswerContent(body, korean, english, language, emphasizedTerms);
  if (caution) block.classList.toggle("caution-box-empty", body.childElementCount === 0);
  parent.append(block);
}

function appendAnswerContent(parent, korean, english, language, emphasizedTerms = {}) {
  const hasKorean = Boolean(Array.isArray(korean) ? korean.length : String(korean || "").trim());
  const hasEnglish = Boolean(Array.isArray(english) ? english.length : String(english || "").trim());
  const showKorean = answerLanguage === "ko";
  const showEnglish = answerLanguage === "en";

  if (showKorean) {
    if (hasKorean) appendLanguageCopy(parent, korean, "", "ko", true, emphasizedTerms.ko || []);
  }
  if (showEnglish) {
    if (hasEnglish) appendLanguageCopy(parent, english, "", "en", true, emphasizedTerms.en || []);
  }

  if ((answerLanguage === "ko" && !hasKorean) || (answerLanguage === "en" && !hasEnglish)) {
    const missing = document.createElement("p");
    missing.className = "translation-missing";
    missing.textContent = answerLanguage === "ko"
      ? "한국어 번역이 등록되지 않았어요."
      : "English translation hasn’t been added yet.";
    parent.append(missing);
  }
}

function appendLanguageCopy(parent, content, label, language, available, emphasizedTerms = []) {
  const copy = document.createElement("div");
  copy.className = "language-copy";
  if (label) {
    const languageLabel = document.createElement("span");
    languageLabel.className = "language-copy-label";
    languageLabel.textContent = label;
    copy.append(languageLabel);
  }
  if (available) {
    if (Array.isArray(content)) {
      const list = document.createElement("ol");
      content.forEach((item) => {
        const row = document.createElement("li");
        appendGlossaryText(row, item, language, emphasizedTerms);
        list.append(row);
      });
      copy.append(list);
    } else {
      const paragraph = document.createElement("p");
      appendGlossaryText(paragraph, content, language, emphasizedTerms);
      copy.append(paragraph);
    }
  }
  parent.append(copy);
}

function renderSources(matches, language) {
  const panel = $("#source-panel");
  panel.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = language === "en" ? "Evidence & references" : "근거 및 참고자료";
  const intro = document.createElement("p");
  intro.className = "source-intro";
  intro.textContent = language === "en"
    ? "These references are listed in the sample knowledge base. Verify the current official source and shipment-specific requirements before acting."
    : "아래 항목은 이 샘플 지식베이스에 등록된 참고자료입니다. 공식 기준 및 실제 선적 조건은 원문과 담당 기관에서 재확인하세요.";
  const list = document.createElement("ul");
  const sourceRows = matches.flatMap((item) => item.sources.map((source, index) => ({
    source,
    translated: item.translations?.sources?.[index] || localizeSource(source),
  })));
  const uniqueRows = [...new Map(sourceRows.map((row) => [`${row.source}|${row.translated}`, row])).values()];
  uniqueRows.forEach(({ source, translated }) => {
    const li = document.createElement("li");
    const hasTranslation = translated !== source;
    const displaySource = language === "en" ? (hasTranslation ? translated : "English translation hasn’t been added yet.") : source;
    const url = source.match(/https:\/\/\S+/)?.[0];
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = displaySource;
      li.append(link);
    } else {
      appendGlossaryText(li, displaySource, language);
    }
    list.append(li);
  });
  panel.append(heading, intro, list);
}

function localizeSource(source) {
  const knownTranslations = {
    "샘플 업무 지식: 일반적인 해상운송 실무 예시 (사내 규정 아님)": "Sample knowledge: general sea freight practice example (not company policy)",
    "운송인·포워더의 해당 선적건별 서면 지침": "Written shipment-specific instructions from the carrier or forwarder",
    "해당 운송인의 Sea Waybill 약관 및 인도 안내": "The carrier's Sea Waybill terms and cargo-release guidance",
    "샘플 업무 지식: 일반적인 국제 해상운송 문서 설명": "Sample knowledge: general overview of international sea transport documents",
    "샘플 업무 지식: 공급망 용어 설명 (회사별 기준 확인 필요)": "Sample knowledge: supply-chain terminology overview (confirm company-specific definitions)",
    "샘플 업무 지식: 일반적인 수출 서류 예시": "Sample knowledge: general export-document example",
    "목적지 세관 및 거래 은행의 문서 요건": "Document requirements from the destination customs authority and transaction bank",
    "목표 국가의 공식 규제기관 및 현행 법령": "Official regulatory authority and current legislation in the target country",
    "제품별 승인 라벨 및 SDS": "The product's approved label and Safety Data Sheet",
    "목표 국가의 공식 MRL 데이터베이스": "The target country's official MRL database",
    "샘플 업무 지식: 일반적인 계약 용어 설명 (법률 자문 아님)": "Sample knowledge: general contract terminology (not legal advice)",
    "회사 법무/계약 담당자의 현행 정책": "Current policy from the company's legal or contracts team",
  };
  return knownTranslations[source] || source;
}

function renderRelated(matches, language) {
  const panel = $("#related-panel");
  panel.replaceChildren();
  const relatedNames = [...new Set(matches.flatMap((item) => item.related))];
  const relatedTerms = relatedNames.map((name) => terms.find((item) => normalize(item.term) === normalize(name))).filter(Boolean);
  if (!relatedTerms.length) return;
  const heading = document.createElement("h3");
  heading.textContent = answerLanguage === "en" ? "Related terms" : answerLanguage === "ko" ? "함께 보면 좋은 용어" : "함께 보면 좋은 용어 / Related terms";
  const list = document.createElement("div");
  list.className = "related-chips";
  relatedTerms.slice(0, 6).forEach((term) => {
    const button = document.createElement("button");
    button.type = "button";
    appendGlossaryText(button, term.term, language);
    button.addEventListener("click", () => runQuestion(term.term));
    list.append(button);
  });
  panel.append(heading, list);
}

function answerPlainText() {
  return `${$("#asked-question").textContent}\n\n${answerContent.innerText}\n\n${$("#source-panel").innerText}\n${$("#related-panel").innerText}`.trim();
}

function runQuestion(rawQuestion, options = {}) {
  const query = rawQuestion.trim();
  if (!query) return;
  const contextual = options.contextual ?? (!options.noContext && Boolean(lastQuestion) && followUpPattern.test(query));
  const searchQuery = options.searchQuery || (contextual ? `${lastQuestion} ${query}` : query);
  let matches = rankTerms(searchQuery);
  if (contextual && matches.length === 0) matches = rankTerms(lastQuestion);
  if (selectedCategory !== "all" && matches.length) {
    const inCategory = matches.filter((term) => term.category === selectedCategory);
    if (inCategory.length) matches = inCategory;
  }

  $("#asked-question").textContent = query;
  const matchedIds = renderAnswer(query, matches, contextual);
  $("#answer-meta").textContent = `${matchedIds.length ? `${matchedIds.length}개 샘플 항목 참조` : "일치하는 샘플 자료 없음"} · 생성형 AI 연결 없음`;
  currentAnswer = { question: query, matchedIds, contextual, searchQuery, text: answerPlainText() };
  answerArea.hidden = false;
  $("#welcome").hidden = true;
  activeView = "home";
  if (!options.noHistory) lastQuestion = contextual ? `${lastQuestion} ${query}` : query;
  renderTerms();
  renderSavedCount();
  renderSaveButton();
    closeMobileMenu();
  if (!options.noScroll) answerArea.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderSavedCount() {
  $("#saved-count").textContent = String(savedAnswers.length);
}

async function applyAuthSession(user) {
  if (user?.id === authUser?.id) return;
  if (!user) {
    accountLoadVersion += 1;
    authUser = null;
    isPasswordRecovery = false;
    updateAccountUI();
    restoreLocalData();
    return;
  }
  try {
    await loadAccountData(user);
    notify("로그인했어요. 개인 용어와 저장 답변을 불러왔습니다.");
  } catch (error) {
    console.error("계정 데이터를 불러오지 못했습니다.", error);
    terms = sharedTerms;
    savedAnswers = [];
    refreshDictionary();
    notify("로그인은 되었지만 계정 데이터를 불러오지 못했습니다. Supabase 테이블과 정책 설정을 확인해 주세요.", true);
  }
}

async function initializeAuth() {
  updateAccountUI();
  if (!supabaseConfigured || !supabaseClient) return;
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      isPasswordRecovery = true;
      authMode = "sign-in";
      updateAccountUI();
      if (!$("#auth-dialog").open) $("#auth-dialog").showModal();
    }
    setTimeout(() => void applyAuthSession(session?.user || null), 0);
  });
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  await applyAuthSession(data.session?.user || null);
}

function renderTerms() {
  const grid = $("#term-grid");
  const query = normalize(browseQuery);
  const queryTokens = tokens(browseQuery);
  const collectionToolbar = $("#collection-toolbar");
  const activeCollection = collections.find((collection) => collection.id === openCollectionId);
  grid.classList.toggle("is-collection-view", Boolean(activeCollection));
  const collectionTermIds = activeCollection
    ? new Set(activeCollection.termIds || activeCollection.groups.flatMap((group) => group.ids))
    : new Set();
  const homeTopics = isHomeLanding && !activeCollection && !query ? collections : [];
  const eligibleTerms = activeCollection
    ? terms.filter((term) => collectionTermIds.has(term.id))
    : terms.filter((term) => selectedCategory === "all" || term.category === selectedCategory);
  const filtered = eligibleTerms.filter((term) => {
    const content = normalize([term.term, term.english, ...term.aliases, ...term.keywords, term.definition].join(" "));
    const queryMatches = !query || content.includes(query) || queryTokens.every((token) => content.includes(token));
    return queryMatches;
  });
  const ungroupedTerms = homeTopics.length ? [] : filtered;
  const collectionCards = activeCollection?.groups
    ? activeCollection.groups.flatMap((group) => {
      const groupTerms = group.ids
        .map((id) => filtered.find((term) => term.id === id))
        .filter(Boolean);
      if (!groupTerms.length) return [];
      const heading = document.createElement("h3");
      heading.className = "collection-group-heading";
      heading.textContent = `${answerLanguage === "en" ? group.titleEn : group.title} · ${groupTerms.length}`;
      return [heading, ...groupTerms.map((term) => createTermCard(term, activeCollection))];
    })
    : filtered.map((term) => createTermCard(term, activeCollection));
  grid.classList.toggle("is-topic-landing", homeTopics.length > 0);
  $("#browse-area").classList.toggle("is-topic-landing", homeTopics.length > 0);
  $("#show-all").hidden = homeTopics.length > 0;
  grid.replaceChildren(
    ...homeTopics.map((collection) => createTopicCard(collection)),
    ...(activeCollection ? collectionCards : ungroupedTerms.map((term) => createTermCard(term))),
  );
  collectionToolbar.hidden = !activeCollection;
  if (activeCollection) {
    $("#collection-title").textContent = answerLanguage === "en" ? activeCollection.titleEn : activeCollection.title;
    $("#collection-description").textContent = answerLanguage === "en" ? activeCollection.descriptionEn : activeCollection.description;
    $("#browse-title").textContent = answerLanguage === "en" ? activeCollection.titleEn : activeCollection.title;
    $("#browse-description").textContent = answerLanguage === "en" ? activeCollection.descriptionEn : activeCollection.description;
    $("#term-count").textContent = answerLanguage === "en" ? `${filtered.length} terms` : `${filtered.length}개 용어`;
  } else {
    if (homeTopics.length) {
      $("#browse-eyebrow").textContent = answerLanguage === "en" ? "TOPIC COLLECTIONS" : "주제별 모음";
      $("#browse-title").textContent = answerLanguage === "en" ? "Explore a topic" : "주제별로 둘러보기";
      $("#browse-description").textContent = answerLanguage === "en"
        ? "Choose a topic to compare related terms and practical guidance."
        : "결제조건, Incoterms®처럼 관련 용어를 모아 한눈에 비교해 보세요.";
    } else if (isHomeLanding && query) {
      $("#browse-title").textContent = answerLanguage === "en" ? "Search results" : "검색 결과";
      $("#browse-description").textContent = answerLanguage === "en"
        ? "Matches from all work categories."
        : "모든 업무 분야에서 일치하는 용어를 찾아요.";
    }
    $("#term-count").textContent = homeTopics.length
      ? answerLanguage === "en" ? `${homeTopics.length} topics` : `${homeTopics.length}개 주제`
      : answerLanguage === "en" ? `${ungroupedTerms.length} terms` : `${ungroupedTerms.length}개 용어`;
  }
  $("#browse-empty").hidden = filtered.length !== 0 || homeTopics.length !== 0;
  $("#browse-empty").textContent = answerLanguage === "en"
    ? "No terms have been added to this category yet."
    : "이 분야에는 아직 등록된 용어가 없습니다.";
}

function createTopicCard(collection) {
  const memberIds = new Set(collection.termIds || collection.groups.flatMap((group) => group.ids));
  const members = terms.filter((term) => memberIds.has(term.id));
  const card = document.createElement("button");
  card.type = "button";
  card.className = "topic-card";
  const title = answerLanguage === "en" ? collection.titleEn : collection.title;
  card.setAttribute("aria-label", `${title} ${answerLanguage === "en" ? "topic" : "주제 열기"}`);

  const top = document.createElement("span");
  top.className = "topic-card-top";
  const area = document.createElement("span");
  area.className = "category-tag";
  area.textContent = categoryLabel(collection.category);
  const count = document.createElement("span");
  count.className = "topic-card-count";
  count.textContent = answerLanguage === "en" ? `${members.length} terms` : `${members.length}개 용어`;
  top.append(area, count);

  const titleNode = document.createElement("strong");
  titleNode.className = "topic-card-title";
  titleNode.textContent = title;
  const description = document.createElement("span");
  description.className = "topic-card-description";
  description.textContent = answerLanguage === "en" ? collection.descriptionEn : collection.description;
  const preview = document.createElement("span");
  preview.className = "topic-card-preview";
  preview.textContent = members.slice(0, 4).map((term) => term.term).join(" · ")
    + (members.length > 4 ? ` +${members.length - 4}` : "");
  const arrow = document.createElement("span");
  arrow.className = "topic-card-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  card.append(top, titleNode, description, preview, arrow);
  card.addEventListener("click", () => selectCollection(collection.id));
  return card;
}

function createTermCard(term, collection = null) {
  const card = document.createElement("article");
  card.className = `term-card${collection ? " is-collection-term" : ""}`;
  const top = document.createElement("div");
  top.className = "term-card-top";
  const tag = document.createElement("span");
  tag.className = "category-tag";
  tag.textContent = categoryLabel(term.category);
  const arrow = document.createElement("span");
  arrow.className = "term-arrow";
  arrow.textContent = "↗";
  top.append(tag, arrow);
  const title = document.createElement("h3");
  title.textContent = term.term;
  const english = document.createElement("p");
  english.className = "term-card-english";
  english.textContent = term.english;
  const definition = document.createElement("p");
  definition.className = "term-card-definition";
  const collectionSummary = collection?.summaries?.[term.id];
  definition.textContent = collectionSummary
    ? answerLanguage === "en" ? collectionSummary.en : collectionSummary.ko
    : answerLanguage === "en"
      ? term.translations?.simple || term.translations?.definition || "English translation hasn’t been added yet."
      : term.simple || term.definition;
  card.append(top, title, english, definition);
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${term.term} 설명 보기`);
  card.addEventListener("click", () => runQuestion(term.term));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      runQuestion(term.term);
    }
  });
  return card;
}

function renderSaveButton() {
  const button = $("#save-answer");
  const saved = currentAnswer && savedAnswers.some((item) => item.question === currentAnswer.question);
  button.classList.toggle("is-saved", Boolean(saved));
  button.firstChild.textContent = saved ? "★" : "☆";
  button.lastChild.textContent = saved ? "저장됨" : "저장";
}

function showSavedAnswers() {
  activeView = "saved";
  openCollectionId = null;
  $("#collection-toolbar").hidden = true;
  $("#welcome").hidden = true;
  answerArea.hidden = true;
  $("#current-view").textContent = "저장한 답변";
  $("#browse-title").textContent = "저장한 답변";
  $("#browse-description").textContent = "다시 참고하고 싶은 업무 답변을 모아두었어요.";
  $("#browse-eyebrow").textContent = "SAVED ANSWERS";
  document.querySelectorAll(".nav-link").forEach((button) => button.classList.remove("is-current"));
  $("#favorites-link").classList.add("is-current");
  const grid = $("#term-grid");
  grid.replaceChildren();
  $("#term-count").textContent = `${savedAnswers.length}개 답변`;
  $("#browse-empty").hidden = savedAnswers.length > 0;
  $("#browse-empty").textContent = "저장한 답변이 없습니다. 검색 결과에서 ☆ 저장을 눌러보세요.";
  savedAnswers.forEach((saved) => {
    const card = document.createElement("article");
    card.className = "term-card saved-card";
    const badge = document.createElement("span");
    badge.className = "category-tag";
    badge.textContent = "저장한 답변";
    const question = document.createElement("h3");
    question.textContent = saved.question;
    const summary = document.createElement("p");
    summary.className = "term-card-definition";
    summary.textContent = saved.summary;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "저장 해제";
    remove.addEventListener("click", async (event) => {
      event.stopPropagation();
      try {
        if (authUser) await removeSavedAnswerFromAccount(saved.question);
        else if (!persist(STORAGE.saved, savedAnswers.filter((item) => item.question !== saved.question))) return;
        savedAnswers = savedAnswers.filter((item) => item.question !== saved.question);
      } catch (error) {
        console.error("저장한 답변을 삭제하지 못했습니다.", error);
        notify("저장 답변을 삭제하지 못했습니다. 다시 시도해 주세요.", true);
        return;
      }
      renderSavedCount();
      showSavedAnswers();
    });
    card.append(badge, question, summary, remove);
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.addEventListener("click", () => runQuestion(saved.question, { noContext: true }));
    grid.append(card);
  });
  closeMobileMenu();
}

function renderAdminTable() {
  const body = $("#admin-terms");
  body.replaceChildren(...terms.map((term) => {
    const row = document.createElement("tr");
    const termCell = document.createElement("td");
    const title = document.createElement("strong");
    title.textContent = term.term;
    const english = document.createElement("small");
    english.textContent = term.english;
    termCell.append(title, english);
    const categoryCell = document.createElement("td");
    categoryCell.textContent = categoryLabel(term.category);
    const definitionCell = document.createElement("td");
    definitionCell.textContent = term.definition;
    const actions = document.createElement("td");
    actions.className = "table-actions";
    if (!authUser || !isSharedTerm(term)) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "수정";
      edit.addEventListener("click", () => openTermForm(term));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "삭제";
      remove.addEventListener("click", async () => {
        if (!confirm(`"${term.term}" 용어를 삭제할까요?`)) return;
        try {
          await deletePersonalTerm(term.id);
          terms = terms.filter((item) => item.id !== term.id);
          renderAdminTable();
          renderTerms();
          notify("개인 용어를 삭제했습니다.");
        } catch (error) {
          console.error("개인 용어를 삭제하지 못했습니다.", error);
          notify("개인 용어를 삭제하지 못했습니다. 다시 시도해 주세요.", true);
        }
      });
      actions.append(edit, remove);
    } else {
      actions.textContent = "공용 용어 · 읽기 전용";
    }
    row.append(termCell, categoryCell, definitionCell, actions);
    return row;
  }));
}

function openTermForm(term) {
  const form = $("#term-form");
  form.reset();
  form.hidden = false;
  $("#term-form-title").textContent = term ? "용어 수정" : "용어 추가";
  const data = term || {};
  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (!field) return;
    field.value = Array.isArray(value) ? value.join(" | ") : value;
  });
  form.elements.namedItem("key_terms").value = term?.keyTerms?.ko?.join(" | ") || definitionKeyTerms[term?.id]?.ko?.join(" | ") || "";
  form.elements.namedItem("key_terms_en").value = term?.keyTerms?.en?.join(" | ") || definitionKeyTerms[term?.id]?.en?.join(" | ") || "";
  Object.entries(data.translations || {}).forEach(([key, value]) => {
    const field = form.elements.namedItem(`${key}_en`);
    if (field) field.value = Array.isArray(value) ? value.join(" | ") : value;
  });
  $("#term-form").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function makeCsv(rows) {
  return rows.map((row) => row.map((field) => {
    const value = String(field ?? "");
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(",")).join("\r\n");
}

function downloadFile(filename, content, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new Error("가져올 데이터 행이 없습니다.");
  const headers = rows[0].map((header) => header.trim().toLocaleLowerCase());
  const required = ["category", "term", "definition"];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`필수 열이 없습니다: ${missing.join(", ")}`);
  const seenIds = new Set();
  const parsed = rows.slice(1).map((cells, index) => {
    const values = Object.fromEntries(headers.map((header, column) => [header, cells[column] || ""]));
    const record = normalizeTerm(values);
    if (!record.term || !record.definition || !categories.some((category) => category.id === record.category)) {
      throw new Error(`${index + 2}행의 용어·정의·카테고리를 확인해 주세요.`);
    }
    if (seenIds.has(record.id)) throw new Error(`${index + 2}행의 id가 중복되었습니다: ${record.id}`);
    seenIds.add(record.id);
    return record;
  });
  return parsed;
}

function closeMobileMenu() {
  $("#sidebar").classList.remove("is-open");
  $("#mobile-scrim").classList.remove("is-visible");
}

function migrateGroupedSeedTerms() {
  const migrationKey = "fieldnotes-agro-terms-v7";
  try {
    if (localStorage.getItem(migrationKey) === "complete") return;
  } catch (error) {
    console.error("그룹 용어 데이터 이전 상태를 확인하지 못했습니다.", error);
    return;
  }
  const knownIds = new Set(terms.map((term) => term.id));
  const newAgroTermIds = new Set([
    "glyphosate",
    "methomyl",
    "glufosinate",
    "pendimethalin",
    "s-metolachlor",
    "imidacloprid",
    "chlorantraniliprole",
    "azoxystrobin",
    "tebuconazole",
    "mancozeb",
    "rice-nursery",
    "rice-land-preparation",
    "rice-irrigation-water-management",
    "rice-water-management",
    "rice-seeding-transplanting",
    "rice-transplanting",
    "rice-nutrient-management",
    "rice-weed-management",
    "rice-pest-disease-monitoring",
    "rice-harvest-postharvest",
  ]);
  const missingGroupedTerms = seedTerms
    .filter((term) => !knownIds.has(term.id) && (
      newAgroTermIds.has(term.id)
      || collections.some((collection) => (collection.termIds || collection.groups.flatMap((group) => group.ids)).includes(term.id))
    ))
    .map(normalizeTerm);
  const riceTermLabels = {
    "rice-cultivation-cycle": ["Rice Crop Cycle", "Rice Crop Cycle"],
    "rice-nursery": ["Nursery", "Nursery"],
    "rice-land-preparation": ["Land Preparation", "Land Preparation"],
    "rice-seeding-transplanting": ["Seeding", "Seeding"],
    "rice-irrigation-water-management": ["Irrigation", "Irrigation"],
    "rice-water-management": ["Water Management", "Water Management"],
    "rice-nutrient-management": ["Nutrient Management", "Nutrient Management"],
    "rice-transplanting": ["Transplanting", "Transplanting"],
    "rice-weed-management": ["Weed Management", "Weed Management"],
    "rice-pest-disease-monitoring": ["Pest & Disease Monitoring", "Pest & Disease Monitoring"],
    "rice-harvest-postharvest": ["Harvest", "Harvest"],
  };
  const riceTermUpdates = terms.map((term) => {
    const labels = riceTermLabels[term.id];
    if (!labels || (term.term === labels[0] && term.english === labels[1])) return term;
    return { ...term, term: labels[0], english: labels[1] };
  });
  const keyTermUpdates = terms.map((term) => {
    const seed = seedTerms.find((item) => item.id === term.id);
    const riceUpdate = riceTermUpdates.find((item) => item.id === term.id);
    const base = riceUpdate || term;
    if (!seed || base.keyTerms.ko.length || base.keyTerms.en.length) return base;
    return { ...base, keyTerms: normalizeTerm(seed).keyTerms };
  });
  const updatedIds = keyTermUpdates.filter((term, index) => term !== terms[index]).length;
  if (missingGroupedTerms.length || updatedIds) {
    terms = [...keyTermUpdates, ...missingGroupedTerms];
    if (!persist(STORAGE.terms, terms)) return;
  }
  try {
    localStorage.setItem(migrationKey, "complete");
  } catch (error) {
    console.error("그룹 용어 데이터 이전 상태를 저장하지 못했습니다.", error);
    notify("새 주제 용어는 불러왔지만 다음 방문을 위해 이전 상태를 저장하지 못했습니다.", true);
  }
}

function migrateSeedAdditions() {
  const migrationKey = "fieldnotes-practical-expansion-v2";
  try {
    if (localStorage.getItem(migrationKey) === "complete") return;
  } catch (error) {
    console.error("신규 샘플 용어 이전 상태를 확인하지 못했습니다.", error);
    return;
  }
  const knownIds = new Set(terms.map((term) => term.id));
  const newTerms = seedAdditions
    .filter((term) => !knownIds.has(term.id))
    .map(normalizeTerm);
  if (newTerms.length) {
    terms = [...terms, ...newTerms];
    if (!persist(STORAGE.terms, terms)) return;
  }
  try {
    localStorage.setItem(migrationKey, "complete");
  } catch (error) {
    console.error("신규 샘플 용어 이전 상태를 저장하지 못했습니다.", error);
    notify("새 샘플 용어는 불러왔지만 다음 방문을 위해 이전 상태를 저장하지 못했습니다.", true);
  }
}

migrateGroupedSeedTerms();
migrateSeedAdditions();
renderCategories();
renderSavedCount();
renderTerms();

$("#brand-home").addEventListener("click", (event) => {
  event.preventDefault();
  showHome();
});
askForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runQuestion(questionInput.value);
});
questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    askForm.requestSubmit();
  }
});
document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    questionInput.value = button.dataset.question;
    runQuestion(button.dataset.question);
  });
});
document.querySelectorAll(".mode-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;
    persist(STORAGE.mode, currentMode);
    document.querySelectorAll(".mode-switch button").forEach((item) => item.classList.toggle("is-selected", item === button));
    if (currentAnswer && !answerArea.hidden) runQuestion(currentAnswer.question, { noHistory: true, noScroll: true, contextual: currentAnswer.contextual, searchQuery: currentAnswer.searchQuery });
  });
});
document.querySelectorAll(".language-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    answerLanguage = button.dataset.language;
    persist(STORAGE.answerLanguage, answerLanguage);
    updateLanguageSwitch();
    renderTerms();
    if (currentAnswer && !answerArea.hidden) {
      runQuestion(currentAnswer.question, { noHistory: true, noScroll: true, contextual: currentAnswer.contextual, searchQuery: currentAnswer.searchQuery });
    }
  });
});
$("#home-link").addEventListener("click", () => {
  showHome();
});
$("#favorites-link").addEventListener("click", showSavedAnswers);
$("#topics-toggle").addEventListener("click", () => {
  const topicNav = $("#topic-nav");
  topicNav.hidden = !topicNav.hidden;
  updateTopicNavigation();
});
$("#new-question").addEventListener("click", () => {
  showHome();
  questionInput.value = "";
  questionInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeMobileMenu();
});
$("#follow-up-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const field = $("#follow-up-question");
  const followUp = field.value.trim();
  if (!followUp) return;
  runQuestion(followUp);
  field.value = "";
});
$("#browse-search").addEventListener("input", (event) => {
  browseQuery = event.target.value;
  renderTerms();
});
$("#show-all").addEventListener("click", () => selectCategory("all"));
$("#copy-answer").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(answerPlainText());
    notify("답변을 클립보드에 복사했어요.");
  } catch (error) {
    const copyField = document.createElement("textarea");
    copyField.value = answerPlainText();
    copyField.setAttribute("readonly", "");
    copyField.style.position = "fixed";
    copyField.style.opacity = "0";
    document.body.append(copyField);
    copyField.select();
    const copied = typeof document.execCommand === "function" && document.execCommand("copy");
    copyField.remove();
    if (copied) notify("답변을 클립보드에 복사했어요.");
    else {
      console.error("답변 복사에 실패했습니다.", error);
      notify("클립보드 복사 권한이 없습니다. 브라우저 권한을 확인해 주세요.", true);
    }
  }
});
$("#save-answer").addEventListener("click", async () => {
  if (!currentAnswer) return;
  const exists = savedAnswers.some((item) => item.question === currentAnswer.question);
  const saved = { question: currentAnswer.question, summary: currentAnswer.text.slice(0, 240), time: Date.now() };
  try {
    if (authUser) {
      if (exists) await removeSavedAnswerFromAccount(currentAnswer.question);
      else await saveAnswerToAccount(saved);
    } else {
      const nextSaved = exists
        ? savedAnswers.filter((item) => item.question !== currentAnswer.question)
        : [saved, ...savedAnswers];
      if (!persist(STORAGE.saved, nextSaved)) return;
    }
    savedAnswers = exists
      ? savedAnswers.filter((item) => item.question !== currentAnswer.question)
      : [saved, ...savedAnswers];
  } catch (error) {
    console.error("답변 저장 상태를 변경하지 못했습니다.", error);
    notify("답변을 저장하지 못했습니다. 다시 시도해 주세요.", true);
    return;
  }
  renderSavedCount();
  renderSaveButton();
  notify(exists ? "저장한 답변에서 삭제했어요." : "답변을 저장했어요.");
});
function openKnowledgeManager() {
  $(".admin-notice strong").textContent = authUser ? "개인 용어 관리" : "브라우저 임시 데이터 안내";
  $(".admin-notice span").textContent = authUser
    ? "기본 사전은 공용 읽기 전용입니다. 여기서 추가한 용어는 로그인한 본인 계정에만 저장되며 다른 사용자에게 공개되지 않습니다."
    : "로그인하지 않은 상태에서 추가·수정한 데이터는 이 브라우저에만 저장됩니다. 로그인 후에는 개인 계정에 별도로 저장됩니다.";
  renderAdminTable();
  $("#admin-dialog").showModal();
  closeMobileMenu();
}

$("#admin-open").addEventListener("click", openKnowledgeManager);
$("#edit-knowledge").addEventListener("click", openKnowledgeManager);
$("#admin-close").addEventListener("click", () => $("#admin-dialog").close());
$("#add-term").addEventListener("click", () => openTermForm());
$("#term-form-close").addEventListener("click", () => { $("#term-form").hidden = true; });
$("#term-form-cancel").addEventListener("click", () => { $("#term-form").hidden = true; });
$("#term-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const term = normalizeTerm(Object.fromEntries(formData.entries()));
  if (!term.term || !term.definition || !categories.some((item) => item.id === term.category)) {
    notify("용어, 정의, 분야를 확인해 주세요.", true);
    return;
  }
  if (authUser && sharedTermIds.has(term.id)) {
    notify("공용 사전 용어는 수정할 수 없습니다. 새 개인 용어로 추가해 주세요.", true);
    return;
  }
  const exists = terms.some((item) => item.id === term.id);
  const previousTerm = terms.find((item) => item.id === term.id);
  terms = exists ? terms.map((item) => item.id === term.id ? term : item) : [term, ...terms];
  try {
    await savePersonalTerm(term);
  } catch (error) {
    terms = exists
      ? terms.map((item) => item.id === term.id ? previousTerm : item)
      : terms.filter((item) => item.id !== term.id);
    console.error("개인 용어를 저장하지 못했습니다.", error);
    notify("개인 용어를 저장하지 못했습니다. 다시 시도해 주세요.", true);
    return;
  }
  event.currentTarget.hidden = true;
  renderAdminTable();
  renderTerms();
  notify(exists ? "개인 용어를 수정했어요." : "개인 용어를 등록했어요.");
});
$("#download-template").addEventListener("click", () => {
  const headers = ["id", "category", "term", "english", "aliases", "definition", "definition_en", "key_terms", "key_terms_en", "simple", "simple_en", "scenario", "scenario_en", "steps", "steps_en", "cautions", "cautions_en", "related", "sources", "sources_en", "keywords"];
  const sample = ["new-term", "trade", "용어 이름", "English name", "별칭1|별칭2", "정확한 정의", "Accurate definition", "핵심 한국어 구절1|핵심 구절2", "key English phrase 1|key phrase 2", "쉽게 설명", "Plain-language explanation", "업무 사례", "Work scenario", "확인 1|확인 2", "Check 1|Check 2", "주의 사항", "Important caution", "관련 용어", "참고 출처", "References", "검색어"];
  downloadFile("fieldnotes-knowledge-template.csv", makeCsv([headers, sample]));
});
$("#export-csv").addEventListener("click", () => {
  const headers = ["id", "category", "term", "english", "aliases", "definition", "definition_en", "key_terms", "key_terms_en", "simple", "simple_en", "scenario", "scenario_en", "steps", "steps_en", "cautions", "cautions_en", "related", "sources", "sources_en", "keywords"];
  const translationHeaders = new Set(["definition_en", "simple_en", "scenario_en", "steps_en", "cautions_en", "sources_en"]);
  const rows = terms.map((term) => headers.map((header) => {
    const value = header === "key_terms"
      ? term.keyTerms.ko
      : header === "key_terms_en"
        ? term.keyTerms.en
        : translationHeaders.has(header)
          ? term.translations?.[header.slice(0, -3)]
          : term[header];
    return Array.isArray(value) ? value.join(" | ") : value || "";
  }));
  downloadFile("fieldnotes-knowledge.csv", makeCsv([headers, ...rows]));
});
$("#csv-upload").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = parseCsv(await file.text());
    if (authUser) {
      const sharedImport = imported.find((term) => sharedTermIds.has(term.id));
      if (sharedImport) {
        throw new Error(`공용 용어 "${sharedImport.term}"은 수정할 수 없습니다. CSV에서 해당 행을 제외해 주세요.`);
      }
      const shouldReplace = confirm(`${imported.length}개 개인 용어를 계정에 가져옵니다.\n확인: 같은 ID의 개인 용어는 업데이트\n취소: 가져오기를 중단`);
      if (!shouldReplace) return;
      const { error } = await supabaseClient.from("personal_terms").upsert(
        imported.map((term) => ({ user_id: authUser.id, term_id: term.id, term_data: term })),
        { onConflict: "user_id,term_id" },
      );
      if (error) throw error;
      const importedIds = new Set(imported.map((term) => term.id));
      terms = [...terms.filter((term) => !importedIds.has(term.id)), ...imported];
    } else {
      const shouldReplace = confirm(`${imported.length}개 용어를 가져옵니다.\n확인: 기존 데이터 교체\n취소: 기존 데이터에 추가`);
      if (shouldReplace) terms = imported;
      else {
        const ids = new Set(terms.map((term) => term.id));
        terms = [...imported.map((term) => ids.has(term.id) ? { ...term, id: crypto.randomUUID() } : term), ...terms];
      }
      persist(STORAGE.terms, terms);
    }
    renderAdminTable();
    renderTerms();
    notify(`${imported.length}개 용어를 가져왔어요.`);
  } catch (error) {
    console.error("CSV 가져오기에 실패했습니다.", error);
    notify(error instanceof Error ? error.message : "CSV를 읽지 못했습니다.", true);
  } finally {
    event.target.value = "";
  }
});
$("#mobile-menu").addEventListener("click", () => {
  $("#sidebar").classList.toggle("is-open");
  $("#mobile-scrim").classList.toggle("is-visible");
});
$("#mobile-scrim").addEventListener("click", closeMobileMenu);

$("#account-open").addEventListener("click", () => {
  authMode = "sign-in";
  updateAccountUI();
  $("#auth-dialog").showModal();
});
$("#auth-close").addEventListener("click", () => $("#auth-dialog").close());
$("#auth-toggle-mode").addEventListener("click", () => {
  authMode = authMode === "sign-in" ? "sign-up" : "sign-in";
  $("#auth-form").reset();
  updateAccountUI();
});
$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) {
    notify("먼저 Supabase 프로젝트 설정을 완료해 주세요.", true);
    return;
  }
  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  if ((authMode === "sign-up" || isPasswordRecovery) && password.length < 8) {
    notify("비밀번호는 8자 이상으로 입력해 주세요.", true);
    return;
  }
  $("#auth-submit").disabled = true;
  try {
    if (isPasswordRecovery) {
      const { error } = await supabaseClient.auth.updateUser({ password });
      if (error) throw error;
      isPasswordRecovery = false;
      updateAccountUI();
      $("#auth-dialog").close();
      notify("비밀번호를 변경했어요.");
    } else if (authMode === "sign-up") {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.href.split("#")[0] },
      });
      if (error) throw error;
      if (data.session?.user) {
        $("#auth-dialog").close();
        notify("계정을 만들고 로그인했어요.");
      } else {
        notify("가입 확인 이메일을 보냈습니다. 이메일의 인증 링크를 눌러 주세요.");
      }
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      $("#auth-dialog").close();
    }
  } catch (error) {
    console.error("계정 인증에 실패했습니다.", error);
    notify(error instanceof Error ? error.message : "인증에 실패했습니다. 입력 정보를 확인해 주세요.", true);
  } finally {
    $("#auth-submit").disabled = !supabaseConfigured;
  }
});
$("#auth-reset-password").addEventListener("click", async () => {
  if (!supabaseClient) {
    notify("먼저 Supabase 프로젝트 설정을 완료해 주세요.", true);
    return;
  }
  const email = $("#auth-email").value.trim();
  if (!email) {
    $("#auth-email").focus();
    notify("비밀번호 재설정 이메일을 받을 주소를 입력해 주세요.", true);
    return;
  }
  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href.split("#")[0],
    });
    if (error) throw error;
    notify("비밀번호 재설정 안내를 이메일로 보냈습니다.");
  } catch (error) {
    console.error("비밀번호 재설정 이메일을 보내지 못했습니다.", error);
    notify(error instanceof Error ? error.message : "재설정 이메일을 보내지 못했습니다.", true);
  }
});
$("#auth-sign-out").addEventListener("click", async () => {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.auth.signOut({ scope: "local" });
    if (error) throw error;
    await applyAuthSession(null);
    $("#auth-dialog").close();
    notify("로그아웃했어요.");
  } catch (error) {
    console.error("로그아웃하지 못했습니다.", error);
    notify("로그아웃하지 못했습니다. 다시 시도해 주세요.", true);
  }
});
void initializeAuth().catch((error) => {
  console.error("Supabase 인증을 초기화하지 못했습니다.", error);
  notify("로그인 서비스를 초기화하지 못했습니다. Supabase 설정과 네트워크를 확인해 주세요.", true);
});
