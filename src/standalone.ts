import extension from "./extension.ts";
import { renderFooter } from "./footer.ts";
import { installPhotoFallback } from "./photo-fallback.ts";
import type { CanvasExtensionHost, CanvasExtensionPageMount } from "./host.ts";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Missing #app root");
let mountPage: CanvasExtensionPageMount | null = null;let cleanup:void|(()=>void);
function dismissSplash():void{const splash=document.querySelector<HTMLElement>("#shelfie-splash");if(!splash)return;const animation=splash.querySelector<HTMLImageElement>(".shelfie-splash__animation");const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;const fadeDuration=reduced?0:360;const dismissAfter=reduced?500:6080-fadeDuration;const startTimer=()=>{window.setTimeout(()=>{splash.classList.add("is-leaving");document.documentElement.classList.remove("shelfie-splash-active");window.setTimeout(()=>splash.remove(),fadeDuration);},dismissAfter);};if(animation?.complete)startTimer();else if(animation){animation.addEventListener("load",startTimer,{once:true});animation.addEventListener("error",startTimer,{once:true});}else startTimer();}
function routePath():string{const hash=location.hash.replace(/^#\/?/,"");return hash||"";}
function mountFooter():void{document.querySelector(".cs-footer")?.remove();root.insertAdjacentElement("afterend",renderFooter());}
async function render():Promise<void>{if(!mountPage)return;if(typeof cleanup==="function")cleanup();root.replaceChildren();cleanup=await mountPage({container:root,path:routePath(),navigate(path:string){const marker="/collection";const index=path.indexOf(marker);const relative=index>=0?path.slice(index+marker.length).replace(/^\//,""):"";location.hash=relative?`#/${relative}`:"#/";}});mountFooter();}
const host:CanvasExtensionHost={apiVersion:"1",extension:{name:"collector-scan",version:"0.3.2",resolvedRef:null},backend:{id:"standalone",kind:"local",orgId:null},registerPage(_contributionId,mount){mountPage=mount;void render();return()=>{mountPage=null;if(typeof cleanup==="function")cleanup();cleanup=undefined;};},navigate(path){const marker="/collection";const index=path.indexOf(marker);const relative=index>=0?path.slice(index+marker.length).replace(/^\//,""):"";location.hash=relative?`#/${relative}`:"#/";},agentServer:{async request<T>():Promise<T>{throw new Error("Agent server is unavailable in the standalone web build.");}}};
extension.activate(host);dismissSplash();installPhotoFallback();window.addEventListener("hashchange",()=>void render());
