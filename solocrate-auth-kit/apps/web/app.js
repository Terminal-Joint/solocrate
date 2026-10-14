const API_BASE = "https://solocrate.onrender.com";
// This is a public browser key. Never put the Supabase service-role key here.
const SUPABASE_URL = "https://wcnfajciipuimcvueynx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dhNii81ZWPeCjV1oiqsubw_1ZotY3fN";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const authForm = document.querySelector("#auth-form");
const authEmail = document.querySelector("#auth-email");
const authPassword = document.querySelector("#auth-password");
const authStatus = document.querySelector("#auth-status");
const signupButton = document.querySelector("#signup-button");
const signinButton = document.querySelector("#signin-button");
const signoutButton = document.querySelector("#signout-button");
const signedInPanel = document.querySelector("#signed-in-panel");
const signedInEmail = document.querySelector("#signed-in-email");
const appContent = document.querySelector("#app-content");

const form = document.querySelector("#sandbox-form");
const nameInput = document.querySelector("#name");
const descriptionInput = document.querySelector("#description");
const button = document.querySelector("#create-button");
const status = document.querySelector("#status");
const list = document.querySelector("#sandbox-list");
const count = document.querySelector("#count");
const resourceForm = document.querySelector("#resource-form");
const resourceSandbox = document.querySelector("#resource-sandbox");
const resourceTitle = document.querySelector("#resource-title");
const resourceType = document.querySelector("#resource-type");
const resourceDescription = document.querySelector("#resource-description");
const resourceVisibility = document.querySelector("#resource-visibility");
const resourceButton = document.querySelector("#resource-create-button");
const resourceStatus = document.querySelector("#resource-status");
const resourceList = document.querySelector("#resource-list");
const resourceCount = document.querySelector("#resource-count");
const sandboxes = [];
const resources = [];

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function showStatus(element, message, isError = false) {
  element.className = isError ? "status error" : "status";
  element.textContent = message;
}
async function apiFetch(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Please sign in to continue.");
  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 401) {
    await supabase.auth.signOut();
    updateAuthUI(null);
    throw new Error("Your session expired. Please sign in again.");
  }
  return response;
}
function renderSandboxOptions() {
  resourceSandbox.innerHTML = sandboxes.length
    ? sandboxes.map((sandbox) => `<option value="${escapeHtml(sandbox.id)}">${escapeHtml(sandbox.name)}</option>`).join("")
    : '<option value="">No sandboxes available</option>';
}
function render() {
  count.textContent = String(sandboxes.length);
  list.innerHTML = sandboxes.length ? sandboxes.map((sandbox) => `<article class="sandbox"><p class="sandbox-name">${escapeHtml(sandbox.name)}</p><p class="sandbox-slug">${escapeHtml(sandbox.slug)}</p></article>`).join("") : '<p class="empty">No sandboxes created yet.</p>';
  renderSandboxOptions();
}
function renderResources() {
  resourceCount.textContent = String(resources.length);
  resourceList.innerHTML = resources.length ? resources.map((resource) => `<article class="sandbox">
    <p class="sandbox-name">${escapeHtml(resource.title)}</p><p class="sandbox-slug">${escapeHtml(resource.type)} · ${escapeHtml(resource.visibility)}</p>
    <label>Upload a file<input type="file" data-upload="${escapeHtml(resource.id)}"></label>
    <button type="button" data-download="${escapeHtml(resource.id)}">Download latest file</button>
    <p class="status" data-file-status="${escapeHtml(resource.id)}"></p></article>`).join("") : '<p class="empty">No resources created yet.</p>';
}
async function loadSandboxes() {
  try {
    const response = await apiFetch("/sandboxes");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to load sandboxes");
    sandboxes.length = 0; sandboxes.push(...body.sandboxes); render();
  } catch (error) { showStatus(status, error.message, true); }
}
async function loadResources() {
  try {
    const response = await apiFetch("/resources");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to load resources");
    resources.length = 0; resources.push(...body.resources); renderResources();
  } catch (error) { showStatus(resourceStatus, error.message, true); }
}
function updateAuthUI(session) {
  const signedIn = Boolean(session?.user);
  authForm.hidden = signedIn;
  signedInPanel.hidden = !signedIn;
  appContent.hidden = !signedIn;
  if (signedIn) {
    signedInEmail.textContent = `Signed in as ${session.user.email || "your account"}`;
    loadSandboxes(); loadResources();
  } else {
    sandboxes.length = 0; resources.length = 0; render(); renderResources();
    showStatus(status, "Sign in to view your sandboxes.");
    showStatus(resourceStatus, "Sign in to view your resources.");
  }
}
authForm.addEventListener("submit", async (event) => {
  event.preventDefault(); signinButton.disabled = true; signupButton.disabled = true;
  showStatus(authStatus, "Signing in…");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail.value.trim(), password: authPassword.value });
    if (error) throw error;
    showStatus(authStatus, "Signed in successfully."); updateAuthUI(data.session);
  } catch (error) { showStatus(authStatus, error.message || "Sign-in failed.", true); }
  finally { signinButton.disabled = false; signupButton.disabled = false; }
});
signupButton.addEventListener("click", async () => {
  signupButton.disabled = true; signinButton.disabled = true; showStatus(authStatus, "Creating account…");
  try {
    const { data, error } = await supabase.auth.signUp({ email: authEmail.value.trim(), password: authPassword.value });
    if (error) throw error;
    if (data.session) {
      showStatus(authStatus, "Account created and signed in."); updateAuthUI(data.session);
    } else {
      showStatus(authStatus, "Account created. Check your email to confirm it, then sign in.");
    }
  } catch (error) { showStatus(authStatus, error.message || "Sign-up failed.", true); }
  finally { signupButton.disabled = false; signinButton.disabled = false; }
});
signoutButton.addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) showStatus(authStatus, error.message, true);
  else { showStatus(authStatus, "Signed out."); updateAuthUI(null); }
});
supabase.auth.onAuthStateChange((_event, session) => updateAuthUI(session));

form.addEventListener("submit", async (event) => {
  event.preventDefault(); button.disabled = true; showStatus(status, "Creating…");
  try {
    const response = await apiFetch("/sandboxes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameInput.value, description: descriptionInput.value }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "Failed to create sandbox");
    sandboxes.unshift(body.sandbox); render(); form.reset(); showStatus(status, "Sandbox created.");
  } catch (error) { showStatus(status, error.message, true); }
  finally { button.disabled = false; }
});
resourceForm.addEventListener("submit", async (event) => {
  event.preventDefault(); resourceButton.disabled = true; showStatus(resourceStatus, "Creating…");
  try {
    const response = await apiFetch("/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sandboxId: resourceSandbox.value, title: resourceTitle.value, type: resourceType.value, description: resourceDescription.value, visibility: resourceVisibility.value }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "Failed to create resource");
    resources.unshift(body.resource); renderResources(); resourceForm.reset(); showStatus(resourceStatus, "Resource created.");
  } catch (error) { showStatus(resourceStatus, error.message, true); }
  finally { resourceButton.disabled = false; }
});
resourceList.addEventListener("change", async (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.matches("[data-upload]")) return;
  const file = input.files?.[0]; if (!file) return;
  const resourceId = input.dataset.upload;
  const fileStatus = resourceList.querySelector(`[data-file-status="${CSS.escape(resourceId)}"]`);
  showStatus(fileStatus, `Uploading ${file.name}…`); input.disabled = true;
  try {
    const response = await apiFetch(`/resources/${encodeURIComponent(resourceId)}/content`, { method: "POST", headers: { "X-File-Name": file.name }, body: file });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "Upload failed");
    showStatus(fileStatus, `Uploaded ${file.name} (${file.size} bytes).`);
  } catch (error) { showStatus(fileStatus, error.message, true); }
  finally { input.disabled = false; input.value = ""; }
});
resourceList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-download]"); if (!button) return;
  const resourceId = button.dataset.download;
  const resource = resources.find((item) => item.id === resourceId);
  const fileStatus = resourceList.querySelector(`[data-file-status="${CSS.escape(resourceId)}"]`);
  button.disabled = true; showStatus(fileStatus, "Downloading…");
  try {
    const response = await apiFetch(`/resources/${encodeURIComponent(resourceId)}/content`);
    if (!response.ok) { let message = "Download failed"; try { message = (await response.json()).error || message; } catch {} throw new Error(message); }
    const blob = await response.blob(); const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = objectUrl; link.download = `${resource?.title || "resource"}.bin`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(objectUrl);
    showStatus(fileStatus, "Download started.");
  } catch (error) { showStatus(fileStatus, error.message, true); }
  finally { button.disabled = false; }
});

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  updateAuthUI(session);
})();
