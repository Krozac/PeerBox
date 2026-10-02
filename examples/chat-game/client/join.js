import { API_URL } from "./networkConfig.js";

const form = document.querySelector("#join-form");
const usernameInput = document.querySelector("#username");
const roomInput = document.querySelector("#room-id");
const status = document.querySelector("#lobby-status");
const submitButton = form.querySelector("button[type=submit]");

const params = new URLSearchParams(window.location.search);
if (params.has("token")) {
  window.location.replace(`./game.html${window.location.search}`);
}

if (params.has("room")) roomInput.value = params.get("room");
usernameInput.value = localStorage.getItem("username") || "";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Getting an invite for this room…");
  submitButton.disabled = true;

  const username = usernameInput.value.trim();
  const roomId = roomInput.value.trim();
  if (!username || username.length > 16 || !roomId) {
    setStatus("Enter a name (up to 16 characters) and a room code.", true);
    submitButton.disabled = false;
    return;
  }

  try {
    const response = await fetch(`${API_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, username }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not join that room.");

    localStorage.setItem("username", username);
    const gameUrl = new URL("./game.html", window.location.href);
    gameUrl.searchParams.set("token", result.token);
    window.location.assign(gameUrl);
  } catch (error) {
    setStatus(error.message || "Could not reach the room service.", true);
    submitButton.disabled = false;
  }
});

function setStatus(message, isError = false) {
  status.textContent = message;
  status.dataset.error = String(isError);
}
