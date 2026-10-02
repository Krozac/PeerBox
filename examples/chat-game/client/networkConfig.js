const defaultSignalProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

export const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL
  || `${defaultSignalProtocol}//${window.location.hostname || "localhost"}:5501`;

const defaultApiUrl = new URL(SIGNALING_URL);
defaultApiUrl.protocol = defaultApiUrl.protocol === "wss:" ? "https:" : "http:";
defaultApiUrl.port = "5502";
defaultApiUrl.pathname = "";
defaultApiUrl.search = "";
defaultApiUrl.hash = "";

export const API_URL = import.meta.env.VITE_API_URL || defaultApiUrl.origin;
