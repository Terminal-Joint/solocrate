
const API_BASE = "https://solocrate.onrender.com";

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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
    ? sandboxes.map((sandbox) => `
        <article class="sandbox">
          <p class="sandbox-name">${escapeHtml(sandbox.name)}</p>
          <p class="sandbox-slug">${escapeHtml(sandbox.slug)}</p>
        </article>
      `).join("")
    : '<p class="empty">No sandboxes created yet.</p>';

  renderSandboxOptions();
}

function renderResources() {
  resourceCount.textContent = String(resources.length);

  resourceList.innerHTML = resources.length
    ? resources.map((resource) => `
        <article class="sandbox">
          <p class="sandbox-name">${escapeHtml(resource.title)}</p>
          <p class="sandbox-slug">
            ${escapeHtml(resource.type)} ·
            ${escapeHtml(resource.visibility)}
          </p>

          <label>
            Upload a file
            <input
              type="file"
              data-upload="${escapeHtml(resource.id)}"
            />
          </label>

          <button
            type="button"
            data-download="${escapeHtml(resource.id)}"
          >
            Download latest file
          </button>

          <p class="status" data-file-status="${escapeHtml(resource.id)}"></p>
        </article>
      `).join("")
    : '<p class="empty">No resources created yet.</p>';
}

async function loadSandboxes() {
  try {
    const response = await fetch(`${API_BASE}/sandboxes`);
    if (!response.ok) throw new Error("Failed to load sandboxes");

    const body = await response.json();
    sandboxes.length = 0;
    sandboxes.push(...body.sandboxes);
    render();
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
  }
}

async function loadResources() {
  try {
    const response = await fetch(`${API_BASE}/resources`);
    if (!response.ok) throw new Error("Failed to load resources");

    const body = await response.json();
    resources.length = 0;
    resources.push(...body.resources);
    renderResources();
  } catch (error) {
    resourceStatus.className = "status error";
    resourceStatus.textContent = error.message;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  button.disabled = true;
  status.className = "status";
  status.textContent = "Creating…";

  try {
    const response = await fetch(`${API_BASE}/sandboxes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameInput.value,
        description: descriptionInput.value,
      }),
    });

    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to create sandbox");

    sandboxes.unshift(body.sandbox);
    render();
    form.reset();
    status.textContent = "Sandbox created.";
  } catch (error) {
    status.className = "status error";
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

resourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  resourceButton.disabled = true;
  resourceStatus.className = "status";
  resourceStatus.textContent = "Creating…";

  try {
    const response = await fetch(`${API_BASE}/resources`, {
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

    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to create resource");

    resources.unshift(body.resource);
    renderResources();
    resourceForm.reset();
    resourceStatus.textContent = "Resource created.";
  } catch (error) {
    resourceStatus.className = "status error";
    resourceStatus.textContent = error.message;
  } finally {
    resourceButton.disabled = false;
  }
});

// Selecting a file uploads it to the chosen resource.
resourceList.addEventListener("change", async (event) => {
  const input = event.target;

  if (!(input instanceof HTMLInputElement) || !input.matches("[data-upload]")) {
    return;
  }

  const file = input.files?.[0];
  if (!file) return;

  const resourceId = input.dataset.upload;
  const fileStatus = resourceList.querySelector(
    `[data-file-status="${CSS.escape(resourceId)}"]`,
  );

  fileStatus.className = "status";
  fileStatus.textContent = `Uploading ${file.name}…`;
  input.disabled = true;

  try {
    const response = await fetch(
      `${API_BASE}/resources/${encodeURIComponent(resourceId)}/content`,
      {
        method: "POST",
        headers: { "X-File-Name": file.name },
        body: file,
      },
    );

    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Upload failed");

    fileStatus.textContent = `Uploaded ${file.name} (${file.size} bytes).`;
  } catch (error) {
    fileStatus.className = "status error";
    fileStatus.textContent = error.message;
  } finally {
    input.disabled = false;
    input.value = "";
  }
});

// Download the latest uploaded file for a resource.
resourceList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-download]");
  if (!button) return;

  const resourceId = button.dataset.download;
  const resource = resources.find((item) => item.id === resourceId);
  const fileStatus = resourceList.querySelector(
    `[data-file-status="${CSS.escape(resourceId)}"]`,
  );

  button.disabled = true;
  fileStatus.className = "status";
  fileStatus.textContent = "Downloading…";

  try {
    const response = await fetch(
      `${API_BASE}/resources/${encodeURIComponent(resourceId)}/content`,
    );

    if (!response.ok) {
      let message = "Download failed";
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {}
      throw new Error(message);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${resource?.title || "resource"}.bin`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);

    fileStatus.textContent = "Download started.";
  } catch (error) {
    fileStatus.className = "status error";
    fileStatus.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

render();
renderResources();
loadSandboxes();
loadResources();
