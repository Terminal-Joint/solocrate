
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_BASE = "https://solocrate.onrender.com";
const SUPABASE_URL = "https://wcnfajciipuimcvueynx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_dhNii81ZWPeCjV1oiqsubw_1ZotY3fN";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (selector) => document.querySelector(selector);

const authForm = $("#auth-form");
const authEmail = $("#auth-email");
const authPassword = $("#auth-password");
const signInButton = $("#signin-button");
const signUpButton = $("#signup-button");
const signOutButton = $("#signout-button");
const googleSignInButton = $("#google-signin-button");
const adminNav = $("#admin-nav");
const roleSummary = $("#role-summary");
const roleFoot = $("#role-foot");
const accountLabel = $("#account-label");
const accountAvatar = $("#account-avatar");
const platformRoleBadge = $("#platform-role-badge");
const overviewSandboxList = $("#overview-sandbox-list");
const overviewResourceList = $("#overview-resource-list");
const sandboxCountChip = $("#sandbox-count-chip");
const resourceCountChip = $("#resource-count-chip");
const detailResourceList = $("#detail-resource-list");
const detailSandboxName = $("#detail-sandbox-name");
const detailSandboxDescription = $("#detail-sandbox-description");
const detailSandboxRole = $("#detail-sandbox-role");
const membershipRoleSummary = $("#membership-role-summary");
let platformRole = "user";
let selectedSandboxId = null;
const authStatus = $("#auth-status");
const authUser = $("#auth-user");

const form = $("#sandbox-form");
const nameInput = $("#name");
const descriptionInput = $("#description");
const button = $("#create-button");
const status = $("#status");
const list = $("#sandbox-list");
const count = $("#count");

const resourceForm = $("#resource-form");
const resourceSandbox = $("#resource-sandbox");
const resourceTitle = $("#resource-title");
const resourceType = $("#resource-type");
const resourceDescription = $("#resource-description");
const resourceVisibility = $("#resource-visibility");
const resourceButton = $("#resource-create-button");
const resourceStatus = $("#resource-status");
const resourceList = $("#resource-list");
const resourceCount = $("#resource-count");

const sandboxes = [];
const resources = [];

let currentUser = null;
let authOperationInProgress = false;

function setStatus(element, message, isError = false) {
  element.className = isError ? "status error" : "status";
  element.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const safePlatformRoles = new Set(["user", "moderator", "admin"]);
function switchView(view) {
  const panel = document.querySelector(`[data-view-panel="${view}"]`);
  if (!panel) return;
  document.querySelectorAll("[data-view-panel]").forEach((item) => item.classList.toggle("active", item === panel));
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  $("#breadcrumb-current").textContent = ({overview:"Overview",sandboxes:"Sandboxes",resources:"Resources","sandbox-detail":"Sandbox",administration:"Administration"})[view] || "Overview";
  if (view === "sandbox-detail") renderSelectedSandbox();
}
function resourceCard(resource) {
  const parent = sandboxes.find((item) => item.id === resource.sandboxId);
  return `<article class="resource-item"><p class="sandbox-name">${escapeHtml(resource.title)}</p><p class="sandbox-slug"><span class="resource-type-chip">${escapeHtml(resource.type)}</span> <span class="visibility-chip">${escapeHtml(resource.visibility)}</span></p>${resource.description ? `<p class="resource-description-text">${escapeHtml(resource.description)}</p>` : ""}<p class="resource-parent">Sandbox: ${escapeHtml(parent?.name || "Unknown")}</p><label class="upload-control">Upload a file<input type="file" data-upload="${escapeHtml(resource.id)}" ${currentUser ? "" : "disabled"}></label><button type="button" class="secondary download-button" data-download="${escapeHtml(resource.id)}" ${currentUser ? "" : "disabled"}>↓ Download latest file</button><p class="status" data-file-status="${escapeHtml(resource.id)}"></p></article>`;
}
function renderSelectedSandbox() {
  const sandbox = sandboxes.find((item) => item.id === selectedSandboxId);
  if (!sandbox) { switchView("sandboxes"); return; }
  detailSandboxName.textContent = sandbox.name;
  detailSandboxDescription.textContent = sandbox.description || "Resources and community materials in this space.";
  const membershipRole = sandbox.membership?.role || sandbox.role || "member";
  detailSandboxRole.textContent = membershipRole;
  membershipRoleSummary.textContent = `Your sandbox role: ${membershipRole}. Permissions are checked by the API. Role assignment remains unavailable until the API has a tested membership-management endpoint.`;
  const own = resources.filter((item) => item.sandboxId === sandbox.id);
  detailResourceList.innerHTML = own.length ? own.map(resourceCard).join("") : '<div class="empty-state"><strong>No resources in this sandbox yet</strong><p>Create a resource for this space.</p></div>';
}
function renderWorkspaceExtras() {
  const sandboxMarkup = sandboxes.length ? sandboxes.map((item) => `<button type="button" class="sandbox-card" data-open-sandbox="${escapeHtml(item.id)}"><span>▦</span><span class="sandbox-card-body"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || "Community sandbox")}</small><em>Open workspace →</em></span></button>`).join("") : '<div class="empty-state"><strong>Your workspace starts here</strong><p>Sign in, then create a sandbox for your community or project.</p></div>';
  overviewSandboxList.innerHTML = sandboxMarkup;
  overviewResourceList.innerHTML = resources.length ? resources.slice(0,4).map(resourceCard).join("") : '<p class="empty">Resources you create will appear here, inside their sandboxes.</p>';
  $("#nav-sandbox-count").textContent = String(sandboxes.length);
  $("#nav-resource-count").textContent = String(resources.length);
  sandboxCountChip.textContent = `${sandboxes.length} spaces`;
  resourceCountChip.textContent = `${resources.length} resources`;
  roleSummary.textContent = platformRole === "admin" ? "Admin" : platformRole === "moderator" ? "Moderator" : currentUser ? "Member" : "Guest";
  roleFoot.textContent = platformRole === "admin" ? "Platform-wide role" : platformRole === "moderator" ? "Platform moderation role" : currentUser ? "Standard account" : "Sign in to see your role";
  adminNav.hidden = !currentUser || !["admin","moderator"].includes(platformRole);
  accountLabel.textContent = currentUser ? (currentUser.email || "Signed in") : "Not signed in";
  accountAvatar.textContent = currentUser ? (currentUser.email || "S").slice(0,1).toUpperCase() : "S";
  platformRoleBadge.textContent = platformRole === "admin" ? "Platform administrator" : platformRole === "moderator" ? "Platform moderator" : "Not authorized";
  if (selectedSandboxId) renderSelectedSandbox();
}
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.go)));
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("[data-open-sandbox]");
  if (button) { selectedSandboxId = button.dataset.openSandbox; switchView("sandbox-detail"); }
});
$("#detail-create-resource").addEventListener("click", () => {
  switchView("resources"); resourceSandbox.value = selectedSandboxId || ""; resourceTitle.focus();
});
document.querySelectorAll("[data-detail-tab]").forEach((button) => button.addEventListener("click", () => {
  const members = button.dataset.detailTab === "members";
  $("#detail-resources-panel").hidden = members; $("#detail-members-panel").hidden = !members;
  document.querySelectorAll("[data-detail-tab]").forEach((tab) => tab.classList.toggle("active", tab === button));
}));

function renderSandboxOptions() {
  resourceSandbox.innerHTML = sandboxes.length
    ? sandboxes.map((sandbox) =>
        `<option value="${escapeHtml(sandbox.id)}">${escapeHtml(sandbox.name)}</option>`
      ).join("")
    : '<option value="">No sandboxes available</option>';
}

function render() {
  count.textContent = String(sandboxes.length);
  list.innerHTML = sandboxes.length
    ? sandboxes.map((item) => `<button type="button" class="sandbox-card" data-open-sandbox="${escapeHtml(item.id)}"><span>▦</span><span class="sandbox-card-body"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.description || "Community sandbox")}</small><em>Open workspace →</em></span></button>`).join("")
    : '<div class="empty-state"><strong>No sandboxes yet</strong><p>Create a space for your community or project.</p></div>';
  renderSandboxOptions();
  renderWorkspaceExtras();
}
function renderResources() {
  resourceCount.textContent = String(resources.length);
  resourceList.innerHTML = resources.length ? resources.map(resourceCard).join("") : '<div class="empty-state"><strong>No resources yet</strong><p>Create a resource inside one of your sandboxes.</p></div>';
  renderWorkspaceExtras();
}

function updateAuthUI() {
  const signedIn = Boolean(currentUser);
  googleSignInButton.hidden = signedIn;
  authEmail.closest("label").hidden = signedIn;
  authPassword.closest("label").hidden = signedIn;

  authEmail.disabled = signedIn || authOperationInProgress;
  authPassword.disabled = signedIn || authOperationInProgress;
  signInButton.hidden = signedIn;
  signUpButton.hidden = signedIn;
  signOutButton.hidden = !signedIn;

  authUser.textContent = signedIn
    ? `Signed in as ${currentUser.email || currentUser.id}`
    : "You are not signed in.";

  form.querySelectorAll("input, textarea, button").forEach((element) => {
    element.disabled = !signedIn;
  });

  resourceForm.querySelectorAll("input, textarea, select, button").forEach((element) => {
    element.disabled = !signedIn;
  });

  renderResources();
}

async function apiFetch(path, options = {}) {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw new Error("Could not retrieve your session. Please sign in again.");

  const token = data.session?.access_token;

  if (!token) {
    throw new Error("Please sign in before using Solocrate.");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    throw new Error("Your session is invalid or expired. Please sign in again.");
  }

  return response;
}

async function readResponse(response, fallbackMessage) {
  let body = {};

  try {
    body = await response.json();
  } catch {
    // The API may return a non-JSON error response.
  }

  if (!response.ok) {
    throw new Error(body.error || fallbackMessage);
  }

  return body;
}

async function loadSandboxes() {
  if (!currentUser) return;

  try {
    const response = await apiFetch("/sandboxes");
    const body = await readResponse(response, "Failed to load sandboxes.");

    sandboxes.length = 0;
    sandboxes.push(...(body.sandboxes || []));
    render();
  } catch (error) {
    setStatus(status, error.message, true);
  }
}

async function loadResources() {
  if (!currentUser) return;

  try {
    const response = await apiFetch("/resources");
    const body = await readResponse(response, "Failed to load resources.");

    resources.length = 0;
    resources.push(...(body.resources || []));
    renderResources();
  } catch (error) {
    setStatus(resourceStatus, error.message, true);
  }
}

async function refreshAccountData() {
  if (!currentUser) {
    sandboxes.length = 0;
    resources.length = 0;
    render();
    renderResources();
    return;
  }

  try {
    const profileResponse = await apiFetch("/me");
    const profile = await readResponse(profileResponse, "Could not load account permissions.");
    platformRole = safePlatformRoles.has(profile.platformRole) ? profile.platformRole : "user";
  } catch (error) {
    platformRole = "user";
    setStatus(authStatus, error.message || "Could not load account permissions.", true);
  }
  renderWorkspaceExtras();
  await Promise.all([loadSandboxes(), loadResources()]);
}

googleSignInButton.addEventListener("click", async () => {
  if (authOperationInProgress || currentUser) return;
  authOperationInProgress = true;
  googleSignInButton.disabled = true;
  setStatus(authStatus, "Redirecting to Google…");
  try {
    const redirectTo = new URL("./", window.location.href).href;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) throw error;
  } catch (error) {
    setStatus(authStatus, error.message || "Google sign-in failed.", true);
    authOperationInProgress = false;
    googleSignInButton.disabled = false;
  }
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authOperationInProgress || currentUser) return;

  authOperationInProgress = true;
  updateAuthUI();
  setStatus(authStatus, "Signing in…");

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.value.trim(),
      password: authPassword.value,
    });

    if (error) throw error;

    setStatus(authStatus, "Signed in successfully.");
  } catch (error) {
    setStatus(authStatus, error.message || "Sign-in failed.", true);
  } finally {
    authOperationInProgress = false;
    updateAuthUI();
  }
});

signUpButton.addEventListener("click", async () => {
  if (authOperationInProgress || currentUser) return;

  if (!authForm.reportValidity()) return;

  authOperationInProgress = true;
  updateAuthUI();
  setStatus(authStatus, "Creating your account…");

  try {
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.value.trim(),
      password: authPassword.value,
    });

    if (error) throw error;

    if (data.session) {
      setStatus(authStatus, "Account created and signed in.");
    } else {
      setStatus(
        authStatus,
        "Account created. Check your email to confirm your account, then sign in."
      );
    }
  } catch (error) {
    setStatus(authStatus, error.message || "Account creation failed.", true);
  } finally {
    authOperationInProgress = false;
    updateAuthUI();
  }
});

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  setStatus(authStatus, "Signing out…");

  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setStatus(authStatus, "Signed out.");
  } catch (error) {
    setStatus(authStatus, error.message || "Sign-out failed.", true);
  } finally {
    signOutButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    setStatus(status, "Please sign in first.", true);
    return;
  }

  button.disabled = true;
  setStatus(status, "Creating sandbox…");

  try {
    const response = await apiFetch("/sandboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameInput.value,
        description: descriptionInput.value,
      }),
    });

    const body = await readResponse(response, "Failed to create sandbox.");

    sandboxes.unshift(body.sandbox);
    render();
    form.reset();
    setStatus(status, "Sandbox created.");
  } catch (error) {
    setStatus(status, error.message, true);
  } finally {
    button.disabled = !currentUser;
  }
});

resourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) {
    setStatus(resourceStatus, "Please sign in first.", true);
    return;
  }

  resourceButton.disabled = true;
  setStatus(resourceStatus, "Creating resource…");

  try {
    const response = await apiFetch("/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sandboxId: resourceSandbox.value,
        title: resourceTitle.value,
        type: resourceType.value,
        description: resourceDescription.value,
        visibility: resourceVisibility.value,
      }),
    });

    const body = await readResponse(response, "Failed to create resource.");

    resources.unshift(body.resource);
    renderResources();
    resourceForm.reset();
    setStatus(resourceStatus, "Resource created.");
  } catch (error) {
    setStatus(resourceStatus, error.message, true);
  } finally {
    resourceButton.disabled = !currentUser;
  }
});

resourceList.addEventListener("change", async (event) => {
  const input = event.target;

  if (!(input instanceof HTMLInputElement) || !input.matches("[data-upload]")) {
    return;
  }

  const file = input.files?.[0];
  if (!file) return;

  const resourceId = input.dataset.upload;
  const fileStatus = resourceList.querySelector(
    `[data-file-status="${CSS.escape(resourceId)}"]`
  );

  input.disabled = true;
  setStatus(fileStatus, `Uploading ${file.name}…`);

  try {
    const response = await apiFetch(
      `/resources/${encodeURIComponent(resourceId)}/content`,
      {
        method: "POST",
        headers: { "X-File-Name": file.name },
        body: file,
      }
    );

    await readResponse(response, "Upload failed.");
    setStatus(fileStatus, `Uploaded ${file.name} (${file.size} bytes).`);
  } catch (error) {
    setStatus(fileStatus, error.message, true);
  } finally {
    input.disabled = !currentUser;
    input.value = "";
  }
});

resourceList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const downloadButton = target.closest("[data-download]");
  if (!downloadButton) return;

  const resourceId = downloadButton.dataset.download;
  const resource = resources.find((item) => item.id === resourceId);
  const fileStatus = resourceList.querySelector(
    `[data-file-status="${CSS.escape(resourceId)}"]`
  );

  downloadButton.disabled = true;
  setStatus(fileStatus, "Downloading…");

  let objectUrl;

  try {
    const response = await apiFetch(
      `/resources/${encodeURIComponent(resourceId)}/content`
    );

    if (!response.ok) {
      await readResponse(response, "Download failed.");
    }

    const blob = await response.blob();
    objectUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${resource?.title || "resource"}.bin`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setStatus(fileStatus, "Download started.");
  } catch (error) {
    setStatus(fileStatus, error.message, true);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    downloadButton.disabled = !currentUser;
  }
});


supabase.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user ?? null;
  platformRole = "user";
  updateAuthUI();

  if (
    event === "SIGNED_IN" ||
    event === "INITIAL_SESSION" ||
    event === "TOKEN_REFRESHED" ||
    event === "SIGNED_OUT"
  ) {
    setTimeout(() => {
      void refreshAccountData();
    }, 0);
  }
});


updateAuthUI();
render();
renderWorkspaceExtras();
switchView("overview");
