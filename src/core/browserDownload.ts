// Safari can fail to save a blob: URL triggered via a synthetic <a download>
// click once the click happens after an `await` (WebKitBlobResource error 1) —
// the browser loses the "trusted user gesture" association with the blob and
// falls back to trying to navigate to it instead of downloading it. Converting
// the blob to a data: URL first avoids that entirely, since data: URLs aren't
// tied to the originating document/activation window the way blob: URLs are.
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function triggerBlobDownload(blob: Blob, fileName: string): Promise<void> {
  const dataUrl = await blobToDataUrl(blob);
  const anchor = window.document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function openBlobInNewTab(blob: Blob, tab: Window | null): Promise<void> {
  const dataUrl = await blobToDataUrl(blob);
  if (tab) {
    tab.location.href = dataUrl;
  }
}
