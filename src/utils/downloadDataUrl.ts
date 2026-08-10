/**
 * Saves a data URL to the user's machine under a given filename.
 *
 * A synthetic link click is the only way to name a download from the page —
 * the anchor's `download` attribute carries the filename, and nothing has to
 * be added to the document for the click to register.
 * @param dataUrl - The encoded contents to save
 * @param filename - Name to save under, extension included
 * @returns Nothing; a no-op when there is nothing to save
 */
export const downloadDataUrl = (dataUrl: string, filename: string): void => {
  if (!dataUrl) return
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}
