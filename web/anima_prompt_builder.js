import { app } from "../../scripts/app.js";

const NODE_CLASS_TYPE = "AnimaPromptBuilder";
const STATE_WIDGET = "state";
const SETTING_URL = "AnimaPromptBuilder.URL";
const DEFAULT_URL = "https://anipro.shibadog.day/";
const APP_MESSAGE_SOURCE = "anima-prompt-builder";
const HOST_MESSAGE_SOURCE = "anima-prompt-builder-host";
const MIN_WIDTH = 900;
const MIN_HEIGHT = 640;

app.registerExtension({
  name: "AnimaPromptBuilder",
  settings: [
    {
      id: SETTING_URL,
      category: ["AniPro Builder", "Connection", "URL"],
      name: "App URL",
      tooltip:
        'URL of the AniPro Builder app shown in the node. Click "Reload" on the node to apply changes.',
      type: "text",
      defaultValue: DEFAULT_URL,
    },
  ],
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS_TYPE) return;
    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function (...args) {
      const result = onNodeCreated?.apply(this, args);
      setupNode(this);
      return result;
    };
  },
});

function appUrl() {
  const value =
    app.extensionManager?.setting?.get?.(SETTING_URL) ??
    app.ui?.settings?.getSettingValue?.(SETTING_URL);
  const text = typeof value === "string" && value.trim() !== "" ? value.trim() : DEFAULT_URL;
  const url = new URL(text, window.location.href);
  url.searchParams.set("embed", "comfyui");
  return url;
}

function setupNode(node) {
  const stateWidget = node.widgets?.find((widget) => widget.name === STATE_WIDGET);
  if (!stateWidget) return;
  hideWidget(stateWidget);

  const container = document.createElement("div");
  container.style.cssText =
    "display:flex;flex-direction:column;width:100%;height:100%;min-height:0;gap:4px";

  const toolbar = document.createElement("div");
  toolbar.style.cssText = "display:flex;gap:4px;align-items:center;font-size:12px";
  const reloadButton = toolbarButton("Reload");
  const openButton = toolbarButton("Open in new tab");
  const urlLabel = document.createElement("span");
  urlLabel.style.cssText =
    "margin-left:auto;opacity:0.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
  toolbar.append(reloadButton, openButton, urlLabel);

  const iframe = document.createElement("iframe");
  iframe.allow = "clipboard-write";
  iframe.style.cssText =
    "flex:1;width:100%;min-height:0;border:0;border-radius:4px;background:#fff";
  container.append(toolbar, iframe);

  let url = appUrl();
  const load = () => {
    url = appUrl();
    urlLabel.textContent = url.origin;
    iframe.src = url.href;
  };

  const onMessage = (event) => {
    if (event.source !== iframe.contentWindow || event.origin !== url.origin) return;
    const data = event.data;
    if (typeof data !== "object" || data === null || data.source !== APP_MESSAGE_SOURCE) return;
    if (data.type === "ready") {
      const state = typeof stateWidget.value === "string" ? stateWidget.value : "";
      iframe.contentWindow.postMessage(
        { source: HOST_MESSAGE_SOURCE, type: "init", state },
        url.origin,
      );
    } else if (data.type === "change" && typeof data.state === "string") {
      if (stateWidget.value === data.state) return;
      stateWidget.value = data.state;
      node.setDirtyCanvas?.(true, true);
      markWorkflowChanged();
    }
  };
  window.addEventListener("message", onMessage);

  reloadButton.addEventListener("click", load);
  openButton.addEventListener("click", () => {
    const plain = new URL(url.href);
    plain.searchParams.delete("embed");
    window.open(plain.href, "_blank", "noopener");
  });

  const widget = node.addDOMWidget("builder", "anima_prompt_builder", container, {
    serialize: false,
    hideOnZoom: false,
    getMinHeight: () => MIN_HEIGHT - 80,
  });
  const cleanup = () => window.removeEventListener("message", onMessage);
  const onRemove = widget.onRemove;
  widget.onRemove = function (...args) {
    cleanup();
    return onRemove?.apply(this, args);
  };
  const onRemoved = node.onRemoved;
  node.onRemoved = function (...args) {
    cleanup();
    return onRemoved?.apply(this, args);
  };

  node.setSize([Math.max(node.size[0], MIN_WIDTH), Math.max(node.size[1], MIN_HEIGHT)]);
  load();
}

function markWorkflowChanged() {
  const tracker = app.extensionManager?.workflow?.activeWorkflow?.changeTracker;
  if (typeof tracker?.captureCanvasState === "function") tracker.captureCanvasState();
  else tracker?.checkState?.();
}

function hideWidget(widget) {
  widget.hidden = true;
  widget.computeSize = () => [0, -4];
}

function toolbarButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.style.cssText = "padding:2px 8px;cursor:pointer";
  return button;
}
