function installShelfieLogo(): void {
  const title = document.querySelector<HTMLElement>(".cs-title");
  if (!title || title.querySelector("img")) return;
  title.textContent = "";
  title.style.backgroundImage = "none";
  title.style.textIndent = "0";
  title.style.overflow = "visible";
  const img = document.createElement("img");
  img.src = "/collector-scan/LogoV3.png?v=logo-20260927";
  img.alt = "Shelfie";
  img.style.cssText = "display:block;width:100%;height:100%;object-fit:contain;object-position:left center";
  title.appendChild(img);
}

const logoObserver = new MutationObserver(installShelfieLogo);
logoObserver.observe(document.documentElement, { childList: true, subtree: true });
installShelfieLogo();
