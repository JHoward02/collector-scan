function applyShelfieLogo(): void {
  const title = document.querySelector<HTMLElement>(".cs-title");
  if (!title) return;

  // Keep the app's existing title element and force the known-good logo onto
  // that one element. Do not inject a second image or second title.
  title.textContent = "Shelfie";
  title.style.setProperty("background", 'url("/collector-scan/LogoV3.png?v=single-logo-1") center / contain no-repeat', "important");
  title.style.setProperty("font-size", "0", "important");
  title.style.setProperty("text-indent", "-9999px", "important");
  title.style.setProperty("display", "block", "important");
  title.style.setProperty("height", "92px", "important");
  title.style.setProperty("width", "100%", "important");
  title.style.setProperty("cursor", "pointer", "important");

  if (title.dataset.shelfieLogoBound !== "1") {
    title.dataset.shelfieLogoBound = "1";
    title.addEventListener("click", () => {
      location.hash = "#/";
    });
  }
}

const observer = new MutationObserver(applyShelfieLogo);
observer.observe(document.getElementById("app") ?? document.body, { childList: true, subtree: true });
applyShelfieLogo();
