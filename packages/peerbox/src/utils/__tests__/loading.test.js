// ...new file...
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import Loading from "../loading.js";

beforeEach(() => {
  document.body.innerHTML = ""; // clean DOM
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("Loading overlay util", () => {
  it("creates and shows overlay with provided text", () => {
    Loading.show("Connecting…");
    const el = document.getElementById("pb-framework-loading-overlay");
    expect(el).toBeTruthy();
    const txt = el.querySelector("#pb-loading-overlay-text");
    expect(txt).toBeTruthy();
    expect(txt.textContent).toBe("Connecting…");
    expect(el.style.visibility).toBe("visible");
    expect(el.style.opacity).toBe("1");
  });

  it("hide() sets opacity immediately and hides visibility after timeout", () => {
    Loading.show("X");
    // call hide -> opacity set to 0, visibility hidden after 200ms
    Loading.hide();

    const el = document.getElementById("pb-framework-loading-overlay");
    expect(el).toBeTruthy();
    // immediate changes
    expect(el.style.opacity).toBe("0");
    // advance timers to allow visibility hidden to run
    vi.advanceTimersByTime(250);
    expect(el.style.visibility).toBe("hidden");
  });

  it("calling show multiple times does not duplicate element and updates text", () => {
    Loading.show("First");
    Loading.show("Second");
    const nodes = document.querySelectorAll("#pb-framework-loading-overlay");
    expect(nodes.length).toBe(1);
    const txt = document.getElementById("pb-loading-overlay-text");
    expect(txt.textContent).toBe("Second");
  });
});